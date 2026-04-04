import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.call_state import CallStateManager

logger = logging.getLogger("app.api.ws")
router = APIRouter()

# Global reference set in main.py lifespan
_call_state_manager: CallStateManager | None = None


def set_call_state_manager(manager: CallStateManager):
    global _call_state_manager
    _call_state_manager = manager


@router.websocket("/transcription/{call_id}")
async def transcription_stream(websocket: WebSocket, call_id: str):
    await websocket.accept()
    logger.info("WebSocket connection accepted for call %s", call_id)

    if not _call_state_manager:
        logger.warning("WebSocket rejected — server not ready (call %s)", call_id)
        await websocket.close(code=4000, reason="Server not ready")
        return

    # Wait up to 15s for call state to be registered (handles race condition
    # when frontend connects before Python registers the call)
    call_state = _call_state_manager.get(call_id)
    if not call_state:
        logger.info("Call %s not yet registered, waiting...", call_id)
        for _ in range(15):
            await asyncio.sleep(1)
            call_state = _call_state_manager.get(call_id)
            if call_state:
                break
    if not call_state:
        logger.warning("WebSocket rejected — call %s not found after waiting", call_id)
        await websocket.close(code=4004, reason="Call not found")
        return

    call_state.add_listener(websocket)
    listener_count = len(call_state.listeners)
    logger.info("WebSocket listener connected for call %s (total listeners: %d)", call_id, listener_count)

    try:
        while True:
            data = await websocket.receive_text()
            logger.info("WebSocket message from client for call %s: %s", call_id, data)
            if data == "end_call":
                logger.info("End call requested via WebSocket for %s", call_id)
                call_state.status = "ending"
    except WebSocketDisconnect:
        call_state.remove_listener(websocket)
        logger.info("WebSocket listener disconnected for call %s (remaining: %d)",
                     call_id, len(call_state.listeners))
