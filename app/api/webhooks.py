import logging
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from app.clients.elevenlabs import ElevenLabsClient
from app.clients.express_backend import ExpressBackendClient
from app.clients.gemini import GeminiClient
from app.clients.twilio import TwilioClient
from app.config import settings
from app.dependencies import (
    get_backend_client,
    get_call_state_manager,
    get_elevenlabs_client,
    get_gemini_client,
    get_twilio_client,
)
from app.models.call_state import CallStateManager
from app.schemas.calls import CallOutcome
from app.services.analysis import AnalysisService
from app.services.payments import PaymentService

logger = logging.getLogger("app.api.webhooks")
router = APIRouter(tags=["webhooks"])

TERMINAL_FAILURE_STATUSES = {"failed", "busy", "no-answer", "canceled"}


async def post_call_pipeline(
    call_sid: str,
    call_state_manager: CallStateManager,
    gemini: GeminiClient,
    elevenlabs: ElevenLabsClient,
    backend: ExpressBackendClient,
):
    """Background task: analyze transcript, settle payment, report outcome."""
    pipeline_start = time.time()
    logger.info("=" * 60)
    logger.info("POST-CALL PIPELINE START — call_sid=%s", call_sid)
    logger.info("=" * 60)

    call_state = call_state_manager.get_by_call_sid(call_sid)
    if not call_state:
        logger.warning("No call state found for call_sid %s — aborting pipeline", call_sid)
        return

    logger.info("  call_id=%s, conv_id=%s", call_state.call_id, call_state.conversation_id)
    call_state.status = "analyzing"

    # Step 1: Analyze transcript
    logger.info("[Pipeline Step 1/3] Analyzing call transcript...")
    analysis_service = AnalysisService(gemini, elevenlabs)
    outcome = await analysis_service.analyze_call(call_state)

    # Step 2: Settle payment
    logger.info("[Pipeline Step 2/3] Settling payment...")
    payment_service = PaymentService(settings)
    settlement = await payment_service.settle_call_payment(
        call_outcome=outcome,
        wallet_address=call_state.wallet_address,
    )

    # Step 3: Report to Express backend
    logger.info("[Pipeline Step 3/3] Reporting outcome to Express backend...")
    await backend.report_call_outcome(call_state.call_id, outcome)

    # Notify WebSocket listeners
    logger.info("Broadcasting call_complete to %d WebSocket listeners", len(call_state.listeners))
    await call_state.broadcast({
        "type": "call_complete",
        "outcome": outcome.model_dump(),
        "settlement": settlement.model_dump(),
    })

    call_state.status = "completed"

    # Close all WebSocket connections and clean up state
    logger.info("Closing %d WebSocket connections for call %s", len(call_state.listeners), call_state.call_id)
    await call_state.close_listeners(code=1000, reason="Call completed")
    call_state_manager.remove(call_state.call_id)

    total_duration = time.time() - pipeline_start
    logger.info("=" * 60)
    logger.info("POST-CALL PIPELINE COMPLETE — call_id=%s (%.1fs total)", call_state.call_id, total_duration)
    logger.info("  Result: success=%s, savings=$%s, charged=$%s",
                outcome.success, outcome.savings_achieved, settlement.amount if settlement.charged else 0)
    logger.info("=" * 60)


async def report_failed_call(
    call_sid: str,
    status: str,
    call_state_manager: CallStateManager,
    backend: ExpressBackendClient,
):
    """Background task: report a failed call to Express."""
    logger.warning("FAILED CALL PIPELINE — call_sid=%s, status=%s", call_sid, status)

    call_state = call_state_manager.get_by_call_sid(call_sid)
    if not call_state:
        logger.warning("No call state found for failed call_sid %s", call_sid)
        return

    logger.info("  call_id=%s, reporting failure to Express", call_state.call_id)

    outcome = CallOutcome(
        call_id=call_state.call_id,
        success=False,
        agreement_summary=f"Call ended with status: {status}",
    )

    await backend.report_call_outcome(call_state.call_id, outcome)

    logger.info("  Broadcasting call_failed to %d WebSocket listeners", len(call_state.listeners))
    await call_state.broadcast({
        "type": "call_failed",
        "status": status,
    })

    call_state.status = "failed"

    # Close all WebSocket connections and clean up state
    logger.info("  Closing %d WebSocket connections for failed call %s", len(call_state.listeners), call_state.call_id)
    await call_state.close_listeners(code=1000, reason=f"Call {status}")
    call_state_manager.remove(call_state.call_id)

    logger.info("  Failed call %s reported with status: %s", call_state.call_id, status)


@router.post("/twilio/status")
async def twilio_status(
    request: Request,
    background_tasks: BackgroundTasks,
    call_state_manager: CallStateManager = Depends(get_call_state_manager),
    twilio_client: TwilioClient = Depends(get_twilio_client),
    gemini: GeminiClient = Depends(get_gemini_client),
    elevenlabs: ElevenLabsClient = Depends(get_elevenlabs_client),
    backend: ExpressBackendClient = Depends(get_backend_client),
) -> dict:
    form = await request.form()
    params = {k: str(v) for k, v in form.items()}
    call_sid = params.get("CallSid", "")
    status = params.get("CallStatus", "")

    logger.info("Twilio status webhook: CallSid=%s, CallStatus=%s", call_sid, status)
    logger.debug("  Full params: %s", params)

    # Validate Twilio signature
    signature = request.headers.get("x-twilio-signature", "")
    url = str(request.url)
    if settings.twilio_auth_token and not twilio_client.validate_request(
        signature, url, params
    ):
        logger.warning("Invalid Twilio signature for CallSid=%s", call_sid)
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")

    if status == "completed":
        logger.info("Call completed — scheduling post-call pipeline for %s", call_sid)
        background_tasks.add_task(
            post_call_pipeline,
            call_sid,
            call_state_manager,
            gemini,
            elevenlabs,
            backend,
        )
    elif status in TERMINAL_FAILURE_STATUSES:
        logger.warning("Call failed with terminal status '%s' — scheduling failure report for %s", status, call_sid)
        background_tasks.add_task(
            report_failed_call,
            call_sid,
            status,
            call_state_manager,
            backend,
        )
    else:
        logger.info("Twilio intermediate status: %s for %s", status, call_sid)

    return {"received": True}


@router.post("/elevenlabs/transcript")
async def elevenlabs_transcript(
    request: Request,
    call_state_manager: CallStateManager = Depends(get_call_state_manager),
) -> dict:
    """Receive live transcript events from ElevenLabs webhook."""
    data = await request.json()
    conversation_id = data.get("conversation_id", "")
    role = data.get("role", "")
    text = data.get("text", "")

    logger.info("ElevenLabs transcript event: conv=%s, role=%s, text=%s",
                conversation_id, role, text[:100] if text else "")

    call_state = call_state_manager.get_by_conversation_id(conversation_id)
    if call_state:
        logger.debug("  Broadcasting to %d listeners for call %s", len(call_state.listeners), call_state.call_id)
        await call_state.broadcast({
            "type": "transcript_update",
            "role": role,
            "text": text,
        })
    else:
        logger.debug("  No active call state for conversation %s", conversation_id)

    return {"ok": True}
