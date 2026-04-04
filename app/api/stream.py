import asyncio
import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.task_events import TaskEventManager

logger = logging.getLogger("app.api.stream")
router = APIRouter(tags=["stream"])

# Global reference set in main.py lifespan
_task_event_manager: TaskEventManager | None = None


def set_task_event_manager(manager: TaskEventManager):
    global _task_event_manager
    _task_event_manager = manager


@router.get("/research/{task_id}")
async def research_stream(task_id: str):
    """SSE endpoint — streams research progress and Gemini reasoning."""
    if not _task_event_manager:
        return StreamingResponse(
            iter([b"data: {\"event\":\"error\",\"message\":\"Server not ready\"}\n\n"]),
            media_type="text/event-stream",
            status_code=503,
        )

    queue = _task_event_manager.subscribe(task_id)
    logger.info("SSE client connected for research task %s", task_id)

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=120.0)
                except asyncio.TimeoutError:
                    # Send keepalive comment
                    yield ": keepalive\n\n"
                    continue

                yield f"data: {json.dumps(event)}\n\n"

                # Close stream on terminal events
                if event.get("event") in ("research_complete", "error"):
                    break
        except asyncio.CancelledError:
            logger.info("SSE client disconnected for task %s", task_id)
        finally:
            _task_event_manager.unsubscribe(task_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
