import logging

from fastapi import APIRouter, BackgroundTasks, Depends

from app.clients.express_backend import ExpressBackendClient
from app.clients.gemini import GeminiClient
from app.dependencies import get_backend_client, get_gemini_client, get_task_event_manager
from app.models.task_events import TaskEventManager
from app.schemas.research import ResearchRequest, ResearchResponse
from app.services.research import ResearchService

logger = logging.getLogger("app.api.research")
router = APIRouter(tags=["research"])


@router.post("/research", response_model=ResearchResponse)
async def run_research(
    req: ResearchRequest,
    background_tasks: BackgroundTasks,
    gemini: GeminiClient = Depends(get_gemini_client),
    backend: ExpressBackendClient = Depends(get_backend_client),
    event_manager: TaskEventManager = Depends(get_task_event_manager),
) -> ResearchResponse:
    logger.info("Research request received — task_id=%s", req.task_id)
    logger.info("  company=%s, service=%s, price=%s, doc=%s",
                req.company_name, req.service_type, req.current_price, req.bill_document_path)

    try:
        service = ResearchService(gemini, event_manager)
        plan = await service.execute(req)

        logger.info("Research completed for task %s — scheduling callback to Express", req.task_id)
        # Async callback to Express backend
        background_tasks.add_task(backend.report_research_complete, req.task_id, plan)

        return ResearchResponse(task_id=req.task_id, status="completed", plan=plan)
    except Exception as e:
        logger.exception("Research FAILED for task %s", req.task_id)
        # Emit error to SSE subscribers
        await event_manager.emit(req.task_id, {"event": "error", "message": str(e)})
        return ResearchResponse(task_id=req.task_id, status="failed", error=str(e))
