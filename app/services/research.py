import logging
import mimetypes
import time
from pathlib import Path

from app.clients.gemini import GeminiClient
from app.config import settings
from app.models.task_events import TaskEventManager
from app.prompts.research import (
    BILL_ANALYSIS_PROMPT,
    BILL_EXTRACTION_PROMPT,
    COMPETITOR_RESEARCH_PROMPT,
    STRATEGY_PROMPT,
)
from app.schemas.research import BillExtraction, NegotiationPlan, ResearchRequest

logger = logging.getLogger("app.services.research")


class ResearchService:
    def __init__(self, gemini: GeminiClient, event_manager: TaskEventManager | None = None):
        self.gemini = gemini
        self.events = event_manager

    async def _emit(self, task_id: str, event: dict) -> None:
        if self.events:
            await self.events.emit(task_id, event)

    @staticmethod
    def _read_document(relative_path: str) -> tuple[bytes, str]:
        """Read a document from the shared uploads directory."""
        file_path = Path(settings.upload_dir) / relative_path
        if not file_path.is_file():
            logger.error("Document not found at: %s", file_path)
            raise FileNotFoundError(f"Document not found: {file_path}")
        mime_type = mimetypes.guess_type(str(file_path))[0] or "application/pdf"
        size = file_path.stat().st_size
        logger.info("Read document: %s (%s, %d bytes)", file_path.name, mime_type, size)
        return file_path.read_bytes(), mime_type

    async def execute(self, req: ResearchRequest) -> NegotiationPlan:
        overall_start = time.time()
        logger.info("=" * 60)
        logger.info("RESEARCH PIPELINE START — task_id=%s", req.task_id)
        logger.info("  Input: company=%s, service=%s, price=%s, doc=%s",
                     req.company_name, req.service_type, req.current_price, req.bill_document_path)
        logger.info("=" * 60)

        doc_data: bytes | None = None
        doc_mime: str | None = None
        bill_analysis: str | None = None
        company_name = req.company_name
        service_type = req.service_type
        current_price = req.current_price
        customer_service_phone: str | None = None

        # Helper to build thinking callback for a given step
        def _thinking_cb(step: str):
            async def cb(text: str):
                await self._emit(req.task_id, {
                    "event": "gemini_thinking",
                    "step": step,
                    "content": text,
                })
            return cb

        # Step 1: If bill provided, read it from disk
        if req.bill_document_path:
            logger.info("[Step 1/3] Reading bill document from disk...")
            doc_data, doc_mime = self._read_document(req.bill_document_path)

            # Step 1a: Extract structured details from the bill (always run to get phone number)
            logger.info("[Step 1a/3] Extracting bill details via Gemini (structured)...")
            await self._emit(req.task_id, {
                "event": "step_start",
                "step": "bill_extraction",
                "label": "Extracting bill details...",
            })
            step_start = time.time()
            extraction = await self.gemini.analyze_document_structured_streaming(
                document_data=doc_data,
                mime_type=doc_mime,
                prompt=BILL_EXTRACTION_PROMPT,
                response_schema=BillExtraction,
                on_thinking=_thinking_cb("bill_extraction"),
            )
            logger.info("  Bill extraction complete (%.1fs)", time.time() - step_start)
            logger.info("  Extracted: company=%s, service=%s, price=$%s, phone=%s",
                        extraction.company_name, extraction.service_type,
                        extraction.current_price, extraction.customer_service_phone)
            if hasattr(extraction, 'line_items') and extraction.line_items:
                for item in extraction.line_items:
                    logger.info("    Line item: %s", item)

            company_name = company_name or extraction.company_name
            service_type = service_type or extraction.service_type
            current_price = current_price if current_price is not None else extraction.current_price
            customer_service_phone = extraction.customer_service_phone

            await self._emit(req.task_id, {
                "event": "step_complete",
                "step": "bill_extraction",
                "data": {
                    "company_name": company_name,
                    "service_type": service_type,
                    "current_price": current_price,
                    "customer_service_phone": customer_service_phone,
                },
            })

            # Step 1b: Detailed bill analysis for negotiation context
            logger.info("[Step 1b/3] Detailed bill analysis via Gemini...")
            await self._emit(req.task_id, {
                "event": "step_start",
                "step": "bill_analysis",
                "label": "Analyzing bill in detail...",
            })
            step_start = time.time()
            bill_analysis = await self.gemini.analyze_document_streaming(
                document_data=doc_data,
                mime_type=doc_mime,
                prompt=BILL_ANALYSIS_PROMPT.format(
                    company=company_name,
                    service=service_type,
                ),
                on_thinking=_thinking_cb("bill_analysis"),
            )
            logger.info("  Bill analysis complete (%.1fs, %d chars)", time.time() - step_start, len(bill_analysis))
            await self._emit(req.task_id, {
                "event": "step_complete",
                "step": "bill_analysis",
            })

        # Step 2: Research competing prices and current deals
        logger.info("[Step 2/3] Market research via Gemini + Google Search...")
        logger.info("  Researching competitors for %s %s at $%s/mo", company_name, service_type, current_price)
        await self._emit(req.task_id, {
            "event": "step_start",
            "step": "market_research",
            "label": "Researching competitors & promotions...",
        })
        step_start = time.time()
        research_result = await self.gemini.research_with_search_streaming(
            prompt=COMPETITOR_RESEARCH_PROMPT.format(
                company=company_name,
                service=service_type,
                current_price=current_price,
                bill_details=bill_analysis or "No bill provided",
            ),
            on_thinking=_thinking_cb("market_research"),
        )
        logger.info("  Market research complete (%.1fs, %d chars)", time.time() - step_start, len(research_result))
        await self._emit(req.task_id, {
            "event": "step_complete",
            "step": "market_research",
        })

        # Step 3: Build argumentation strategy as structured output
        logger.info("[Step 3/3] Building negotiation strategy via Gemini (structured)...")
        await self._emit(req.task_id, {
            "event": "step_start",
            "step": "strategy",
            "label": "Building negotiation strategy...",
        })
        step_start = time.time()
        phone_context = (
            f"\nPhone number found on bill: {customer_service_phone} — "
            "USE THIS NUMBER. It is the official support/call-us number printed on the bill "
            "and MUST be used as customer_service_phone in the plan."
            if customer_service_phone
            else "\nNo phone number found on bill — you MUST find it from the research above."
        )
        plan = await self.gemini.generate_structured_streaming(
            prompt=STRATEGY_PROMPT.format(
                company=company_name,
                service=service_type,
                current_price=current_price,
                research=research_result,
                bill_details=bill_analysis or "No bill provided",
                additional_context=req.additional_context or "",
            )
            + phone_context,
            response_schema=NegotiationPlan,
            on_thinking=_thinking_cb("strategy"),
        )
        logger.info("  Strategy complete (%.1fs)", time.time() - step_start)

        # Hard override: bill phone number always takes priority
        if customer_service_phone and plan.customer_service_phone != customer_service_phone:
            logger.info("  Overriding strategy phone %s with bill phone %s",
                        plan.customer_service_phone, customer_service_phone)
            plan.customer_service_phone = customer_service_phone

        await self._emit(req.task_id, {
            "event": "step_complete",
            "step": "strategy",
        })

        total_duration = time.time() - overall_start
        logger.info("=" * 60)
        logger.info("RESEARCH PIPELINE COMPLETE — task_id=%s (%.1fs total)", req.task_id, total_duration)
        logger.info("  Company: %s", plan.company_name)
        logger.info("  Service: %s", plan.service_type)
        logger.info("  Phone: %s", plan.customer_service_phone)
        logger.info("  Current price: $%s → Target: $%s (Floor: $%s)", plan.current_price, plan.target_price, plan.floor_price)
        logger.info("  Talking points: %d", len(plan.talking_points))
        for i, tp in enumerate(plan.talking_points):
            logger.info("    [%d] %s", i + 1, tp)
        logger.info("  Fallback positions: %d", len(plan.fallback_positions))
        for i, fp in enumerate(plan.fallback_positions):
            logger.info("    [%d] %s", i + 1, fp)
        logger.info("  Competing offers: %d", len(plan.competing_offers))
        for offer in plan.competing_offers:
            logger.info("    - %s: %s @ $%s", offer.provider, offer.service, offer.price)
        logger.info("  Detected promotions: %d", len(plan.detected_promotions))
        for promo in plan.detected_promotions:
            logger.info("    - %s", promo)
        logger.info("=" * 60)

        # Emit completion event with the full plan
        await self._emit(req.task_id, {
            "event": "research_complete",
            "plan": plan.model_dump(),
        })

        return plan
