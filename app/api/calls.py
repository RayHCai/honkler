import asyncio
import logging

from fastapi import APIRouter, Depends

from app.clients.elevenlabs import ElevenLabsClient
from app.clients.express_backend import ExpressBackendClient
from app.clients.gemini import GeminiClient
from app.dependencies import (
    get_backend_client,
    get_call_state_manager,
    get_elevenlabs_client,
    get_gemini_client,
)
from app.models.call_state import CallStateManager
from app.schemas.calls import CallRequest, CallResponse, CallStatusResponse
from app.services.voice import VoiceService

logger = logging.getLogger("app.api.calls")
router = APIRouter(tags=["calls"])

# Hold references to monitor tasks so they aren't garbage-collected
_active_monitors: set[asyncio.Task] = set()

TERMINAL_SUCCESS = frozenset({"done", "completed", "ended", "finished"})
TERMINAL_FAILURE = frozenset({"failed", "error", "timeout", "cancelled"})


async def monitor_call_completion(
    call_id: str,
    conversation_id: str,
    call_state_manager: CallStateManager,
    elevenlabs: ElevenLabsClient,
    gemini: GeminiClient,
    backend: ExpressBackendClient,
):
    """Poll ElevenLabs conversation status, stream live transcript, and trigger
    post-call pipeline when done.

    Twilio status callbacks are routed to ElevenLabs (not our backend), so this
    monitor is the only way we learn that a call has ended.  It also broadcasts
    new transcript entries to WebSocket listeners for live transcription.
    """
    logger.info("Call monitor started — call_id=%s, conv_id=%s", call_id, conversation_id)

    POLL_INTERVAL = 3  # seconds
    MAX_DURATION = 30 * 60  # 30 minutes
    elapsed = 0
    last_transcript_len = 0  # track how many entries we've already broadcast

    while elapsed < MAX_DURATION:
        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        # If call state was already cleaned up by another path, stop
        call_state = call_state_manager.get(call_id)
        if not call_state:
            logger.info("Call monitor: call_id=%s already cleaned up, stopping", call_id)
            return
        if call_state.status in ("completed", "failed", "analyzing"):
            logger.info(
                "Call monitor: call_id=%s already being processed (status=%s), stopping",
                call_id,
                call_state.status,
            )
            return

        try:
            conversation = await elevenlabs.get_conversation(conversation_id)
            logger.info(
                "Call monitor poll: conv=%s status=%s transcript_entries=%d (elapsed=%ds)",
                conversation_id,
                conversation.status,
                len(conversation.transcript),
                elapsed,
            )

            # Broadcast any new transcript entries to WebSocket listeners
            new_entries = conversation.transcript[last_transcript_len:]
            if new_entries and call_state.listeners:
                for entry in new_entries:
                    await call_state.broadcast({
                        "type": "transcript_update",
                        "role": entry.role,
                        "text": entry.text,
                    })
                logger.info(
                    "Broadcast %d new transcript entries for call %s",
                    len(new_entries),
                    call_id,
                )
            last_transcript_len = len(conversation.transcript)

            if conversation.status in TERMINAL_SUCCESS:
                logger.info(
                    "Conversation %s done — triggering post-call pipeline",
                    conversation_id,
                )
                from app.api.webhooks import post_call_pipeline

                await post_call_pipeline(
                    call_state.call_sid,
                    call_state_manager,
                    gemini,
                    elevenlabs,
                    backend,
                )
                return

            if conversation.status in TERMINAL_FAILURE:
                logger.warning(
                    "Conversation %s failed (%s) — reporting failure",
                    conversation_id,
                    conversation.status,
                )
                from app.api.webhooks import report_failed_call

                await report_failed_call(
                    call_state.call_sid,
                    conversation.status,
                    call_state_manager,
                    backend,
                )
                return

        except Exception as e:
            logger.warning("Call monitor error for conv=%s: %s", conversation_id, e)

    # Timed out — treat as failed
    logger.warning(
        "Call monitor timed out for call_id=%s after %ds", call_id, MAX_DURATION
    )
    call_state = call_state_manager.get(call_id)
    if call_state:
        from app.api.webhooks import report_failed_call

        await report_failed_call(
            call_state.call_sid, "monitor_timeout", call_state_manager, backend
        )


@router.post("/calls", response_model=CallResponse)
async def initiate_call(
    req: CallRequest,
    elevenlabs: ElevenLabsClient = Depends(get_elevenlabs_client),
    call_state_manager: CallStateManager = Depends(get_call_state_manager),
    gemini: GeminiClient = Depends(get_gemini_client),
    backend: ExpressBackendClient = Depends(get_backend_client),
) -> CallResponse:
    logger.info("Call initiation request — call_id=%s, phone=%s, task_id=%s",
                req.call_id, req.phone_number, req.task_id)
    try:
        service = VoiceService(elevenlabs, call_state_manager)
        result = await service.start_call(req)
        logger.info("Call initiated successfully — call_id=%s, conv_id=%s, call_sid=%s",
                     req.call_id, result.conversation_id, result.call_sid)

        # Monitor the ElevenLabs conversation and trigger post-call pipeline when
        # it ends.  Twilio status callbacks go to ElevenLabs, not our backend, so
        # we poll the conversation status instead.
        task = asyncio.create_task(
            monitor_call_completion(
                call_id=req.call_id,
                conversation_id=result.conversation_id,
                call_state_manager=call_state_manager,
                elevenlabs=elevenlabs,
                gemini=gemini,
                backend=backend,
            )
        )
        _active_monitors.add(task)
        task.add_done_callback(_active_monitors.discard)

        return CallResponse(
            call_id=req.call_id,
            status="initiated",
            conversation_id=result.conversation_id,
            twilio_call_sid=result.call_sid,
        )
    except Exception as e:
        logger.exception("Call initiation FAILED for %s", req.call_id)
        return CallResponse(call_id=req.call_id, status="failed", error=str(e))


@router.get("/calls/{call_id}", response_model=CallStatusResponse)
async def get_call_status(
    call_id: str,
    call_state_manager: CallStateManager = Depends(get_call_state_manager),
) -> CallStatusResponse:
    state = call_state_manager.get(call_id)
    if not state:
        logger.debug("Call status query — %s: not_found", call_id)
        return CallStatusResponse(call_id=call_id, status="not_found")
    logger.debug("Call status query — %s: %s", call_id, state.status)
    return CallStatusResponse(call_id=call_id, status=state.status)
