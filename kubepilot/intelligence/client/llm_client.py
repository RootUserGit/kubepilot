from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from kubepilot.core.redaction import redact_text
from kubepilot.core.settings import Settings
from kubepilot.intelligence.client.json_parse import parse_llm_json

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
        try:
            return self._complete_json_attempt(system, user_safe, _retry=False)
        except httpx.HTTPError as exc:
            url = self._settings.llm_endpoint.rstrip("/") + "/v1/chat/completions"  # type: ignore[union-attr]
            logger.warning("LLM request failed (%s): %s", url, exc)
            return {
                "summary": user_safe[:2000],
                "note": (
                    "LLM request failed; using deterministic remediation template. "
                    f"Check KUBEPILOT_LLM_ENDPOINT (current: {self._settings.llm_endpoint}) "
                    "points to an OpenAI-compatible server (vLLM/TGI), not the KubePilot API."
                ),
            }
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Unexpected LLM response shape: %s", exc)
            return {
                "summary": user_safe[:2000],
                "note": "LLM returned an unexpected response; using deterministic remediation template.",
            }

    def _parse_completion_text(
        self,
        text: str,
        system: str,
        user_safe: str,
        *,
        _retry: bool,
    ) -> dict[str, Any]:
        parsed, trailing = parse_llm_json(text)
        if parsed and parsed.get("steps"):
            if trailing:
                parsed["_llm_trailing_note"] = trailing
            return parsed
        if not _retry:
            logger.info("LLM JSON missing steps or invalid; retrying once with stricter prompt")
            retry_system = (
                system
                + "\nIMPORTANT: Reply with ONLY valid JSON. At most 2 steps. "
                "command strings must not contain single or double quotes."
            )
            return self._complete_json_attempt(retry_system, user_safe, _retry=True)
        return {
            "summary": text[:2000],
            "note": (
                "LLM response was not valid JSON or had no steps; "
                "using deterministic remediation template."
            ),
        }

    def _complete_json_attempt(self, system: str, user_safe: str, *, _retry: bool) -> dict[str, Any]:
        """Single HTTP call; used for optional retry."""
        url = self._settings.llm_endpoint.rstrip("/") + "/v1/chat/completions"  # type: ignore[union-attr]
        payload: dict[str, Any] = {
            "model": self._settings.llm_model or "local",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_safe},
            ],
            "temperature": 0.2,
        }
        endpoint = (self._settings.llm_endpoint or "").rstrip("/")
        if ":11434" in endpoint or endpoint.endswith("11434"):
            payload["format"] = "json"
            payload["options"] = {"num_predict": 8192, "temperature": 0.2}
        with httpx.Client(timeout=120.0) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
        text = data["choices"][0]["message"]["content"]
        return self._parse_completion_text(text, system, user_safe, _retry=_retry)


def embed_stub_sync(text: str, dimensions: int = 8) -> list[float]:
    """Deterministic pseudo-embedding for tests when no model is configured."""
    import hashlib

    h = hashlib.sha256(text.encode()).digest()
    return [((h[i % len(h)] - 128) / 128.0) for i in range(dimensions)]
