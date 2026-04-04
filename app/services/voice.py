import logging

from app.clients.elevenlabs import ElevenLabsClient, OutboundCallResult
from app.config import settings
from app.models.call_state import CallStateManager
from app.prompts.negotiation import build_first_message, build_negotiation_prompt
from app.schemas.calls import CallRequest

logger = logging.getLogger("app.services.voice")


class VoiceService:
    def __init__(
        self,
        elevenlabs: ElevenLabsClient,
        call_state_manager: CallStateManager,
    ):
        self.elevenlabs = elevenlabs
        self.calls = call_state_manager

    async def start_call(self, req: CallRequest) -> OutboundCallResult:
        logger.info("=" * 60)
        logger.info("VOICE CALL START — call_id=%s", req.call_id)
        logger.info("  Phone: %s", req.phone_number)
        logger.info("  Plan: %s — %s", req.negotiation_plan.company_name, req.negotiation_plan.service_type)
        logger.info("  Prices: current=$%s, target=$%s, floor=$%s",
                     req.negotiation_plan.current_price, req.negotiation_plan.target_price, req.negotiation_plan.floor_price)
        logger.info("  User: %s, Wallet: %s", req.user_id, req.wallet_address or "none")
        logger.info("=" * 60)

        system_prompt = build_negotiation_prompt(req.negotiation_plan)
        first_message = build_first_message(req.negotiation_plan)
        logger.info("Built negotiation system prompt (%d chars)", len(system_prompt))
        logger.info("First message: %s", first_message)
        logger.debug("System prompt:\n%s", system_prompt)

        status_callback_url = f"{settings.base_url}/webhooks/twilio/status"
        logger.info("Initiating outbound call via ElevenLabs...")

        result = await self.elevenlabs.outbound_call(
            to_number=req.phone_number,
            agent_config_override={
                "prompt": {"prompt": system_prompt},
                "first_message": first_message,
            },
            conversation_initiation_data={
                "dynamic_variables": {
                    "target_price": str(req.negotiation_plan.target_price),
                    "current_price": str(req.negotiation_plan.current_price),
                },
            },
            status_callback_url=status_callback_url,
        )

        logger.info("Call registered in state manager: call_id=%s, conv_id=%s, call_sid=%s",
                     req.call_id, result.conversation_id, result.call_sid)

        self.calls.register(
            call_id=req.call_id,
            conversation_id=result.conversation_id,
            call_sid=result.call_sid,
            plan=req.negotiation_plan,
            wallet_address=req.wallet_address,
        )

        return result
