import asyncio
import logging
import time
from collections.abc import Awaitable, Callable

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import Settings

logger = logging.getLogger("app.clients.gemini")

# Optional callback type for streaming thinking tokens
ThinkingCallback = Callable[[str], Awaitable[None]] | None


def _truncate(text: str, max_len: int = 500) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len] + f"... ({len(text) - max_len} chars truncated)"


def _log_response_metadata(response) -> None:
    """Log usage metadata from Gemini response if available."""
    if hasattr(response, "usage_metadata") and response.usage_metadata:
        meta = response.usage_metadata
        logger.info(
            "  Gemini usage — prompt_tokens: %s, candidates_tokens: %s, total_tokens: %s",
            getattr(meta, "prompt_token_count", "?"),
            getattr(meta, "candidates_token_count", "?"),
            getattr(meta, "total_token_count", "?"),
        )

    # Log thinking/reasoning if present in candidates
    if hasattr(response, "candidates") and response.candidates:
        for candidate in response.candidates:
            if hasattr(candidate, "content") and candidate.content:
                for part in candidate.content.parts:
                    if hasattr(part, "thought") and part.thought:
                        logger.info(
                            "  Gemini THINKING:\n%s",
                            _truncate(part.text, 1000),
                        )


THINKING_CONFIG = types.ThinkingConfig(include_thoughts=True)


class GeminiClient:
    def __init__(self, settings: Settings):
        self._api_key = settings.gemini_api_key
        self._client: genai.Client | None = None
        self.search_tool = types.Tool(google_search=types.GoogleSearch())

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def analyze_document(
        self, document_data: bytes, mime_type: str, prompt: str
    ) -> str:
        """Multimodal document analysis (bill/receipt from local file bytes)."""
        logger.info("Gemini analyze_document — mime=%s, doc_size=%d bytes", mime_type, len(document_data))
        logger.debug("  Prompt: %s", _truncate(prompt))

        start = time.time()
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=document_data, mime_type=mime_type),
                prompt,
            ],
        )
        duration = time.time() - start

        logger.info("  Gemini responded in %.1fs (%d chars)", duration, len(response.text))
        logger.info("  Response preview: %s", _truncate(response.text, 300))
        _log_response_metadata(response)

        return response.text

    async def research_with_search(self, prompt: str) -> str:
        """Research with Google Search grounding for real-time data."""
        logger.info("Gemini research_with_search — using Google Search grounding")
        logger.info("  Prompt: %s", _truncate(prompt, 300))

        start = time.time()
        config = types.GenerateContentConfig(tools=[self.search_tool])
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
            config=config,
        )
        duration = time.time() - start

        logger.info("  Gemini search responded in %.1fs (%d chars)", duration, len(response.text))
        logger.info("  Response preview: %s", _truncate(response.text, 300))
        _log_response_metadata(response)

        # Log grounding metadata if available
        if hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "grounding_metadata") and candidate.grounding_metadata:
                gm = candidate.grounding_metadata
                if hasattr(gm, "search_entry_point") and gm.search_entry_point:
                    logger.debug("  Grounding search entry point available")
                if hasattr(gm, "grounding_chunks") and gm.grounding_chunks:
                    logger.info("  Grounding sources: %d chunks", len(gm.grounding_chunks))
                    for i, chunk in enumerate(gm.grounding_chunks[:5]):
                        if hasattr(chunk, "web") and chunk.web:
                            logger.info("    [%d] %s — %s", i, chunk.web.title, chunk.web.uri)

        return response.text

    async def generate_structured[T: BaseModel](
        self, prompt: str, response_schema: type[T]
    ) -> T:
        """Generate structured JSON output matching a Pydantic schema."""
        schema_name = response_schema.__name__
        logger.info("Gemini generate_structured — schema=%s", schema_name)
        logger.info("  Prompt: %s", _truncate(prompt, 300))

        start = time.time()
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
        )
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
            config=config,
        )
        duration = time.time() - start

        logger.info("  Gemini structured responded in %.1fs (%d chars)", duration, len(response.text))
        logger.info("  Raw JSON: %s", _truncate(response.text, 500))
        _log_response_metadata(response)

        result = response_schema.model_validate_json(response.text)
        logger.info("  Parsed %s successfully", schema_name)

        return result

    async def analyze_document_structured[T: BaseModel](
        self,
        document_data: bytes,
        mime_type: str,
        prompt: str,
        response_schema: type[T],
    ) -> T:
        """Multimodal document analysis with structured JSON output."""
        schema_name = response_schema.__name__
        logger.info(
            "Gemini analyze_document_structured — schema=%s, mime=%s, doc_size=%d bytes",
            schema_name, mime_type, len(document_data),
        )
        logger.debug("  Prompt: %s", _truncate(prompt))

        start = time.time()
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
        )
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=document_data, mime_type=mime_type),
                prompt,
            ],
            config=config,
        )
        duration = time.time() - start

        logger.info("  Gemini doc+structured responded in %.1fs (%d chars)", duration, len(response.text))
        logger.info("  Raw JSON: %s", _truncate(response.text, 500))
        _log_response_metadata(response)

        result = response_schema.model_validate_json(response.text)
        logger.info("  Parsed %s successfully", schema_name)

        return result

    # ── Streaming variants (emit thinking tokens via callback) ──────────

    async def analyze_document_streaming(
        self,
        document_data: bytes,
        mime_type: str,
        prompt: str,
        on_thinking: ThinkingCallback = None,
    ) -> str:
        """Multimodal document analysis with streaming thinking tokens."""
        logger.info("Gemini analyze_document_streaming — mime=%s, doc_size=%d bytes", mime_type, len(document_data))
        start = time.time()

        config = types.GenerateContentConfig(thinking_config=THINKING_CONFIG)
        response_text = ""

        async for chunk in await self.client.aio.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=document_data, mime_type=mime_type),
                prompt,
            ],
            config=config,
        ):
            if not chunk.candidates:
                continue
            candidate = chunk.candidates[0]
            if not candidate.content or not candidate.content.parts:
                continue
            for part in candidate.content.parts:
                if not part.text:
                    continue
                if part.thought:
                    if on_thinking:
                        await on_thinking(part.text)
                else:
                    response_text += part.text

        logger.info("  Streaming complete in %.1fs (%d chars)", time.time() - start, len(response_text))
        return response_text

    async def research_with_search_streaming(
        self,
        prompt: str,
        on_thinking: ThinkingCallback = None,
    ) -> str:
        """Research with Google Search grounding and streaming thinking."""
        logger.info("Gemini research_with_search_streaming — using Google Search grounding")
        start = time.time()

        config = types.GenerateContentConfig(
            tools=[self.search_tool],
            thinking_config=THINKING_CONFIG,
        )
        response_text = ""

        async for chunk in await self.client.aio.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=prompt,
            config=config,
        ):
            if not chunk.candidates:
                continue
            candidate = chunk.candidates[0]
            if not candidate.content or not candidate.content.parts:
                continue
            for part in candidate.content.parts:
                if not part.text:
                    continue
                if part.thought:
                    if on_thinking:
                        await on_thinking(part.text)
                else:
                    response_text += part.text

        logger.info("  Streaming search complete in %.1fs (%d chars)", time.time() - start, len(response_text))
        return response_text

    async def generate_structured_streaming[T: BaseModel](
        self,
        prompt: str,
        response_schema: type[T],
        on_thinking: ThinkingCallback = None,
    ) -> T:
        """Structured JSON output with streaming thinking tokens."""
        schema_name = response_schema.__name__
        logger.info("Gemini generate_structured_streaming — schema=%s", schema_name)
        start = time.time()

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            thinking_config=THINKING_CONFIG,
        )
        json_text = ""

        async for chunk in await self.client.aio.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=prompt,
            config=config,
        ):
            if not chunk.candidates:
                continue
            candidate = chunk.candidates[0]
            if not candidate.content or not candidate.content.parts:
                continue
            for part in candidate.content.parts:
                if not part.text:
                    continue
                if part.thought:
                    if on_thinking:
                        await on_thinking(part.text)
                else:
                    json_text += part.text

        logger.info("  Streaming structured complete in %.1fs (%d chars)", time.time() - start, len(json_text))
        result = response_schema.model_validate_json(json_text)
        logger.info("  Parsed %s successfully", schema_name)
        return result

    async def analyze_document_structured_streaming[T: BaseModel](
        self,
        document_data: bytes,
        mime_type: str,
        prompt: str,
        response_schema: type[T],
        on_thinking: ThinkingCallback = None,
    ) -> T:
        """Multimodal structured output with streaming thinking tokens."""
        schema_name = response_schema.__name__
        logger.info("Gemini analyze_document_structured_streaming — schema=%s", schema_name)
        start = time.time()

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            thinking_config=THINKING_CONFIG,
        )
        json_text = ""

        async for chunk in await self.client.aio.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=document_data, mime_type=mime_type),
                prompt,
            ],
            config=config,
        ):
            if not chunk.candidates:
                continue
            candidate = chunk.candidates[0]
            if not candidate.content or not candidate.content.parts:
                continue
            for part in candidate.content.parts:
                if not part.text:
                    continue
                if part.thought:
                    if on_thinking:
                        await on_thinking(part.text)
                else:
                    json_text += part.text

        logger.info("  Streaming doc+structured complete in %.1fs (%d chars)", time.time() - start, len(json_text))
        result = response_schema.model_validate_json(json_text)
        logger.info("  Parsed %s successfully", schema_name)
        return result
