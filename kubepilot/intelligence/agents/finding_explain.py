from __future__ import annotations

from typing import Any

from kubepilot.core.settings import Settings
from kubepilot.intelligence.client import LLMClient
from kubepilot.intelligence.schemas import FindingExplainResult

_SYSTEM = """You explain Kubernetes security findings. Respond with JSON only:
{"summary": "...", "likely_false_positive": "true|false|uncertain", "confidence": 0.0-1.0, "citations": [{"title":"...","url":"..."}]}
Do not recommend destructive commands. If disposition is accepted_system_requirement, explain why the finding is expected."""


def run_finding_explain(context_json: str, settings: Settings) -> FindingExplainResult:
    client = LLMClient(settings)
    raw = client.complete_json_sync(_SYSTEM, context_json)
    if raw.get("note"):
        return FindingExplainResult(
            summary=raw.get("summary", "LLM is not configured. See deterministic remediation and references on the finding."),
            likely_false_positive="uncertain",
            confidence=0.0,
        )
    return FindingExplainResult(
        summary=str(raw.get("summary", "")),
        likely_false_positive=raw.get("likely_false_positive", "uncertain"),  # type: ignore[arg-type]
        confidence=float(raw.get("confidence", 0.5)),
        citations=list(raw.get("citations") or []),
    )
