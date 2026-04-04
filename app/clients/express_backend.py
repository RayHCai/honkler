import logging
import time

import httpx

from app.config import Settings
from app.schemas.calls import CallOutcome
from app.schemas.research import NegotiationPlan

logger = logging.getLogger("app.clients.express_backend")


class ExpressBackendClient:
    def __init__(self, settings: Settings, http_client: httpx.AsyncClient):
        self.base_url = settings.express_backend_url
        self.http = http_client

    async def report_research_complete(
        self, task_id: str, plan: NegotiationPlan
    ) -> None:
        url = f"{self.base_url}/api/agent/research-complete"
        logger.info("→ POST %s (task_id=%s)", url, task_id)
        logger.info("  Plan summary: %s — %s, target=$%s, phone=%s",
                     plan.company_name, plan.service_type, plan.target_price, plan.customer_service_phone)

        start = time.time()
        try:
            resp = await self.http.post(
                url,
                json={"task_id": task_id, "plan": plan.model_dump()},
            )
            duration = time.time() - start
            logger.info("← %d from research-complete (%.0fms)", resp.status_code, duration * 1000)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            duration = time.time() - start
            logger.error(
                "← %d from research-complete (%.0fms): %s",
                e.response.status_code, duration * 1000, e.response.text,
            )
            raise
        except httpx.HTTPError as e:
            duration = time.time() - start
            logger.error("Network error on research-complete (%.0fms): %s", duration * 1000, e)
            raise

    async def report_call_outcome(
        self, call_id: str, outcome: CallOutcome
    ) -> None:
        url = f"{self.base_url}/api/agent/call-outcome"
        logger.info("→ POST %s (call_id=%s)", url, call_id)
        logger.info("  Outcome: success=%s, savings=$%s, confidence=%.2f",
                     outcome.success, outcome.savings_achieved or 0, outcome.confidence)

        start = time.time()
        try:
            resp = await self.http.post(
                url,
                json={"call_id": call_id, "outcome": outcome.model_dump()},
            )
            duration = time.time() - start
            logger.info("← %d from call-outcome (%.0fms)", resp.status_code, duration * 1000)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            duration = time.time() - start
            logger.error(
                "← %d from call-outcome (%.0fms): %s",
                e.response.status_code, duration * 1000, e.response.text,
            )
            raise
        except httpx.HTTPError as e:
            duration = time.time() - start
            logger.error("Network error on call-outcome (%.0fms): %s", duration * 1000, e)
            raise
