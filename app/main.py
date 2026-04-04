import logging
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api import calls, health, research, stream, webhooks, ws
from app.clients.elevenlabs import ElevenLabsClient
from app.clients.express_backend import ExpressBackendClient
from app.clients.gemini import GeminiClient
from app.clients.twilio import TwilioClient
from app.config import settings
from app.logging_config import setup_logging
from app.models.call_state import CallStateManager
from app.models.task_events import TaskEventManager

# Initialize logging before anything else
setup_logging(debug=settings.debug)
logger = logging.getLogger("app.main")


class HonklerError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code


class ResearchError(HonklerError):
    pass


class CallError(HonklerError):
    pass


class PaymentError(HonklerError):
    pass


class UpstreamError(HonklerError):
    def __init__(self, service: str, message: str, status_code: int = 502):
        super().__init__(f"{service}: {message}", status_code)
        self.service = service


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Honkler Agent Runtime...")
    logger.info("Express backend URL: %s", settings.express_backend_url)
    logger.info("Base URL: %s", settings.base_url)
    logger.info("Debug mode: %s", settings.debug)

    http_client = httpx.AsyncClient(timeout=30.0)
    app.state.http_client = http_client
    app.state.gemini_client = GeminiClient(settings)
    app.state.elevenlabs_client = ElevenLabsClient(settings)
    app.state.twilio_client = TwilioClient(settings)
    app.state.backend_client = ExpressBackendClient(settings, http_client)
    app.state.call_state_manager = CallStateManager()
    app.state.task_event_manager = TaskEventManager()
    # Wire module-level global references
    from app.api.ws import set_call_state_manager
    set_call_state_manager(app.state.call_state_manager)
    from app.api.stream import set_task_event_manager
    set_task_event_manager(app.state.task_event_manager)

    logger.info("All clients initialized successfully")
    yield
    logger.info("Shutting down Honkler Agent Runtime...")
    await http_client.aclose()


app = FastAPI(title="Honkler Agent Runtime", lifespan=lifespan)


# Request/response logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    method = request.method
    path = request.url.path

    # Skip health checks from cluttering logs
    if path == "/health":
        return await call_next(request)

    logger.info("→ %s %s", method, path)

    response = await call_next(request)

    duration_ms = (time.time() - start) * 1000
    level = logging.WARNING if response.status_code >= 400 else logging.INFO
    logger.log(level, "← %s %s %d (%.0fms)", method, path, response.status_code, duration_ms)

    return response


@app.exception_handler(HonklerError)
async def honkler_error_handler(request: Request, exc: HonklerError):
    logger.error("HonklerError on %s %s: [%d] %s", request.method, request.url.path, exc.status_code, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "type": type(exc).__name__},
    )


@app.exception_handler(httpx.HTTPStatusError)
async def upstream_http_handler(request: Request, exc: httpx.HTTPStatusError):
    logger.error("Upstream HTTP error on %s %s: %d", request.method, request.url.path, exc.response.status_code)
    return JSONResponse(
        status_code=502,
        content={"error": f"Upstream error: {exc.response.status_code}", "type": "UpstreamError"},
    )


app.include_router(health.router)
app.include_router(research.router, prefix="/api/v1")
app.include_router(calls.router, prefix="/api/v1")
app.include_router(stream.router, prefix="/stream")
app.include_router(webhooks.router, prefix="/webhooks")
app.include_router(ws.router, prefix="/ws")
