from __future__ import annotations

from kubepilot.core.settings import Settings
from kubepilot.intelligence.client import LLMClient
from kubepilot.intelligence.schemas import FindingTriageResult

_SYSTEM = """You triage Kubernetes findings for false positives. JSON only:
{"summary":"...","likely_false_positive":"true|false|uncertain","confidence":0.0-1.0,"recommended_disposition":"actionable|accepted_system_requirement","citations":[{"title":"...","url":"..."}]}
kube-proxy privileged in kube-system is typically expected. Never recommend lowering severity without evidence."""


def run_finding_triage(context_json: str, settings: Settings) -> FindingTriageResult:
    client = LLMClient(settings)
    raw = client.complete_json_sync(_SYSTEM, context_json)
    if raw.get("note"):
        return FindingTriageResult(
            summary=raw.get("summary", "LLM not configured."),
            likely_false_positive="uncertain",
            confidence=0.0,
        )
    return FindingTriageResult(
        summary=str(raw.get("summary", "")),
        likely_false_positive=raw.get("likely_false_positive", "uncertain"),  # type: ignore[arg-type]
        confidence=float(raw.get("confidence", 0.5)),
        recommended_disposition=raw.get("recommended_disposition"),
        citations=list(raw.get("citations") or []),
    )
