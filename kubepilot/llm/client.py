from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from kubepilot.core.redaction import redact_text
from kubepilot.core.settings import Settings

logger = logging.getLogger(__name__)


class LLMClient:
    """HTTP client for self-hosted OpenAI-compatible inference (vLLM/TGI)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def complete_json_sync(self, system: str, user: str) -> dict[str, Any]:
        user_safe = redact_text(user)
        if not self._settings.llm_enabled or not self._settings.llm_endpoint:
            return {
                "summary": user_safe[:2000],
                "note": "LLM disabled; returning truncated redacted context only.",
            }
        url = self._settings.llm_endpoint.rstrip("/") + "/v1/chat/completions"
        payload = {
            "model": "local",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_safe},
            ],
            "temperature": 0.2,
        }
        with httpx.Client(timeout=120.0) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
        text = data["choices"][0]["message"]["content"]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"summary": text}


def embed_stub_sync(text: str, dimensions: int = 8) -> list[float]:
    """Deterministic pseudo-embedding for tests when no model is configured."""
    import hashlib

    h = hashlib.sha256(text.encode()).digest()
    return [((h[i % len(h)] - 128) / 128.0) for i in range(dimensions)]
