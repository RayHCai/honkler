import logging
import time
from dataclasses import dataclass

import httpx

from app.config import Settings

logger = logging.getLogger("app.clients.elevenlabs")


@dataclass
class OutboundCallResult:
    conversation_id: str
    call_sid: str


@dataclass
class TranscriptEntry:
    role: str
    text: str


@dataclass
class ConversationDetails:
    conversation_id: str
    status: str
    transcript: list[TranscriptEntry]


class ElevenLabsClient:
    BASE_URL = "https://api.elevenlabs.io/v1"

    def __init__(self, settings: Settings):
        self.api_key = settings.elevenlabs_api_key
        self.agent_id = settings.elevenlabs_agent_id
        self.phone_number_id = settings.elevenlabs_agent_phone_number_id
        self._http = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={"xi-api-key": self.api_key},
            timeout=30.0,
        )

    async def outbound_call(
        self,
        to_number: str,
        agent_config_override: dict | None = None,
        conversation_initiation_data: dict | None = None,
        status_callback_url: str | None = None,
    ) -> OutboundCallResult:
        """Initiate an outbound call via ElevenLabs native Twilio integration."""
        logger.info("ElevenLabs outbound_call to %s (agent=%s)", to_number, self.agent_id)

        payload: dict = {
            "agent_id": self.agent_id,
            "agent_phone_number_id": self.phone_number_id,
            "to_number": to_number,
        }
        if status_callback_url:
            payload["twilio_config"] = {
                "status_callback": status_callback_url,
                "status_callback_event": [
                    "initiated", "ringing", "answered", "completed", "failed",
                ],
            }
            logger.info("  Status callback: %s", status_callback_url)
        if agent_config_override:
            payload["conversation_initiation_client_data"] = {
                "conversation_config_override": {"agent": agent_config_override}
            }
            # Log prompt override (truncated)
            prompt_text = agent_config_override.get("prompt", {}).get("prompt", "")
            if prompt_text:
                logger.info("  Agent prompt override (%d chars): %s...", len(prompt_text), prompt_text[:200])
        if conversation_initiation_data:
            payload.setdefault("conversation_initiation_client_data", {}).update(
                conversation_initiation_data
            )
            logger.info("  Dynamic variables: %s", conversation_initiation_data.get("dynamic_variables", {}))

        logger.debug("  Full payload keys: %s", list(payload.keys()))

        start = time.time()
        resp = await self._http.post("/convai/twilio/outbound-call", json=payload)
        duration = time.time() - start

        logger.info("  ElevenLabs API responded: %d (%.1fs)", resp.status_code, duration)
        resp.raise_for_status()
        data = resp.json()

        result = OutboundCallResult(
            conversation_id=data["conversation_id"],
            call_sid=data.get("callSid", ""),
        )
        logger.info("  Call initiated — conversation_id=%s, call_sid=%s", result.conversation_id, result.call_sid)

        return result

    async def get_conversation(self, conversation_id: str) -> ConversationDetails:
        """Fetch conversation details including transcript."""
        logger.info("ElevenLabs get_conversation: %s", conversation_id)

        start = time.time()
        resp = await self._http.get(f"/convai/conversations/{conversation_id}")
        duration = time.time() - start

        logger.info("  ElevenLabs API responded: %d (%.1fs)", resp.status_code, duration)
        resp.raise_for_status()
        data = resp.json()

        transcript = [
            TranscriptEntry(role=entry["role"], text=entry["message"])
            for entry in data.get("transcript", [])
        ]

        logger.info(
            "  Conversation %s: status=%s, transcript_entries=%d",
            conversation_id, data.get("status", "unknown"), len(transcript),
        )

        # Log the transcript content
        for i, entry in enumerate(transcript):
            logger.info("  [%d] %s: %s", i, entry.role.upper(), entry.text[:150])

        return ConversationDetails(
            conversation_id=data["conversation_id"],
            status=data.get("status", "unknown"),
            transcript=transcript,
        )
