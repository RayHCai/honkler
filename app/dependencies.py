from fastapi import Request

from app.clients.elevenlabs import ElevenLabsClient
from app.clients.express_backend import ExpressBackendClient
from app.clients.gemini import GeminiClient
from app.clients.twilio import TwilioClient
from app.models.call_state import CallStateManager
from app.models.task_events import TaskEventManager


def get_gemini_client(request: Request) -> GeminiClient:
    return request.app.state.gemini_client


def get_elevenlabs_client(request: Request) -> ElevenLabsClient:
    return request.app.state.elevenlabs_client


def get_twilio_client(request: Request) -> TwilioClient:
    return request.app.state.twilio_client


def get_backend_client(request: Request) -> ExpressBackendClient:
    return request.app.state.backend_client


def get_call_state_manager(request: Request) -> CallStateManager:
    return request.app.state.call_state_manager


def get_task_event_manager(request: Request) -> TaskEventManager:
    return request.app.state.task_event_manager
