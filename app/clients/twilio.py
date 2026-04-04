import asyncio
import logging

from twilio.rest import Client as TwilioRestClient
from twilio.request_validator import RequestValidator

from app.config import Settings

logger = logging.getLogger("app.clients.twilio")


class TwilioClient:
    def __init__(self, settings: Settings):
        self._account_sid = settings.twilio_account_sid
        self._auth_token = settings.twilio_auth_token
        self._client: TwilioRestClient | None = None
        self._validator = RequestValidator(self._auth_token)

    @property
    def client(self) -> TwilioRestClient:
        if self._client is None:
            self._client = TwilioRestClient(self._account_sid, self._auth_token)
        return self._client

    async def get_call_status(self, call_sid: str) -> str:
        logger.info("Twilio get_call_status: %s", call_sid)
        call = await asyncio.to_thread(self.client.calls(call_sid).fetch)
        logger.info("  Call %s status: %s", call_sid, call.status)
        return call.status

    def validate_request(
        self, signature: str, url: str, params: dict[str, str]
    ) -> bool:
        is_valid = self._validator.validate(url, params, signature)
        if not is_valid:
            logger.warning("Twilio signature validation FAILED for URL: %s", url)
        else:
            logger.debug("Twilio signature validated for URL: %s", url)
        return is_valid
