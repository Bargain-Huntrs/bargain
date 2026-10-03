"""LLM client — minimal async OpenAI-compatible chat-completions wrapper.

Configuration (see ``app.core.config.settings``):
  - ``AI_BASE_URL``  — base URL of any OpenAI-compatible API
                       (default ``https://api.openai.com/v1``; also works with
                       Groq, Together, a local vLLM/Ollama server, etc.)
  - ``AI_API_KEY``   — bearer token. When empty the client is "unconfigured"
                       and every call returns ``None`` so callers can degrade
                       gracefully (routers translate this into a 503).
  - ``AI_MODEL``     — chat model name (default ``gpt-4o-mini``)

Design notes:
  - One POST to ``/chat/completions`` per call, with a single retry on
    transient failures (network errors, 429, 5xx). No client is kept alive —
    these endpoints are low-volume and a fresh ``AsyncClient`` per call keeps
    lifecycle trivial.
  - The API key is only ever sent in the Authorization header. It is never
    logged — error logs contain status codes and exception class names only.
  - ``chat_json`` asks for ``response_format={"type": "json_object"}`` and
    strips Markdown fences before parsing; providers that don't support JSON
    mode still work because we retry once without the response_format field.
"""
import json
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_MAX_RETRIES = 2  # initial attempt + one retry


def is_configured() -> bool:
    """True when an AI API key is set and endpoints should attempt LLM calls."""
    return bool(settings.AI_API_KEY)


def model_name() -> str:
    return settings.AI_MODEL or "gpt-4o-mini"


async def chat(
    messages: list[dict],
    *,
    max_tokens: int = 800,
    temperature: float = 0.4,
    json_mode: bool = False,
) -> Optional[str]:
    """Send a chat-completions request. Returns the assistant message text,
    or ``None`` when unconfigured or the request ultimately fails.

    ``messages`` uses the OpenAI shape: [{"role": "system"|"user"|"assistant",
    "content": "..."}].
    """
    if not settings.AI_API_KEY:
        return None

    base_url = (settings.AI_BASE_URL or "https://api.openai.com/v1").rstrip("/")
    payload = {
        "model": model_name(),
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    headers = {
        "Authorization": f"Bearer {settings.AI_API_KEY}",
        "Content-Type": "application/json",
    }

    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
                resp = await client.post(
                    f"{base_url}/chat/completions", json=payload, headers=headers
                )

            # Some OpenAI-compatible providers reject response_format entirely —
            # drop json_mode and retry rather than failing the request.
            if resp.status_code == 400 and json_mode:
                logger.info("LLM endpoint rejected json_mode — retrying without it")
                payload.pop("response_format", None)
                json_mode = False
                continue

            if resp.status_code == 429 or resp.status_code >= 500:
                logger.warning(
                    "LLM request transient failure: HTTP %s (attempt %d/%d)",
                    resp.status_code, attempt + 1, _MAX_RETRIES,
                )
                continue

            if resp.status_code != 200:
                # Auth errors and other 4xx aren't retryable — but log only the
                # status, never the body (it can echo request details).
                logger.warning("LLM request failed: HTTP %s", resp.status_code)
                return None

            data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                logger.warning("LLM response contained no choices")
                return None
            content = (choices[0].get("message") or {}).get("content")
            return content if isinstance(content, str) else None

        except httpx.HTTPError as e:
            logger.warning(
                "LLM request error (attempt %d/%d): %s",
                attempt + 1, _MAX_RETRIES, type(e).__name__,
            )
        except Exception as e:  # JSON parse errors, etc.
            logger.warning("LLM unexpected error: %s", type(e).__name__)
            return None

    return None


def extract_json(text: str) -> Optional[dict]:
    """Parse a JSON object from an LLM reply, tolerating ```json fences and
    leading/trailing prose. Returns None if no parseable object is found."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Drop the opening fence (``` or ```json) and the closing fence.
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else cleaned
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3]
        cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        pass
    # Last resort: slice out the outermost {...} block.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except (json.JSONDecodeError, TypeError):
            return None
    return None


async def chat_json(
    messages: list[dict],
    *,
    max_tokens: int = 800,
    temperature: float = 0.4,
) -> Optional[dict]:
    """Like ``chat`` but requests JSON output and returns the parsed object.
    Returns None when unconfigured, the call fails, or the reply isn't JSON."""
    text = await chat(
        messages, max_tokens=max_tokens, temperature=temperature, json_mode=True
    )
    return extract_json(text) if text else None
