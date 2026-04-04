import logging
import time

from app.clients.elevenlabs import ElevenLabsClient
from app.clients.gemini import GeminiClient
from app.models.call_state import CallState
from app.prompts.analysis import POST_CALL_PROMPT
from app.schemas.calls import CallOutcome

logger = logging.getLogger("app.services.analysis")


class AnalysisService:
    def __init__(self, gemini: GeminiClient, elevenlabs: ElevenLabsClient):
        self.gemini = gemini
        self.elevenlabs = elevenlabs

    async def analyze_call(self, call_state: CallState) -> CallOutcome:
        logger.info("=" * 60)
        logger.info("POST-CALL ANALYSIS START — call_id=%s, conv_id=%s",
                     call_state.call_id, call_state.conversation_id)
        logger.info("=" * 60)

        # Fetch transcript
        logger.info("[Step 1/2] Fetching transcript from ElevenLabs...")
        start = time.time()
        conversation = await self.elevenlabs.get_conversation(call_state.conversation_id)
        logger.info("  Transcript fetched (%.1fs): %d entries, status=%s",
                     time.time() - start, len(conversation.transcript), conversation.status)

        transcript_text = "\n".join(
            f"{entry.role}: {entry.text}" for entry in conversation.transcript
        )
        logger.info("  Full transcript (%d chars):", len(transcript_text))
        for entry in conversation.transcript:
            logger.info("    %s: %s", entry.role.upper(), entry.text[:200])

        # Analyze with Gemini
        logger.info("[Step 2/2] Analyzing transcript with Gemini...")
        start = time.time()
        outcome = await self.gemini.generate_structured(
            prompt=POST_CALL_PROMPT.format(
                transcript=transcript_text,
                original_plan=call_state.plan.model_dump_json(),
            ),
            response_schema=CallOutcome,
        )
        logger.info("  Analysis complete (%.1fs)", time.time() - start)

        # Ensure call_id and transcript are set
        outcome.call_id = call_state.call_id
        outcome.transcript = transcript_text

        logger.info("=" * 60)
        logger.info("POST-CALL ANALYSIS RESULT — call_id=%s", call_state.call_id)
        logger.info("  Success: %s", outcome.success)
        logger.info("  Agreed price: $%s", outcome.agreed_price)
        logger.info("  Savings: $%s", outcome.savings_achieved)
        logger.info("  Confidence: %.2f", outcome.confidence)
        logger.info("  Summary: %s", outcome.agreement_summary)
        if outcome.next_steps:
            logger.info("  Next steps:")
            for step in outcome.next_steps:
                logger.info("    - %s", step)
        logger.info("=" * 60)

        return outcome
