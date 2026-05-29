from __future__ import annotations

from typing import Any

from kubepilot.core.settings import Settings
from kubepilot.intelligence.agents import (
    run_finding_explain,
    run_finding_remediate,
    run_finding_triage,
)
from kubepilot.intelligence.context import build_finding_context
from kubepilot.core.schemas import (
    FindingExplainResult,
    FindingTriageResult,
    RemediationPlanResult,
)


class IntelligenceService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or Settings()

    def explain(self, insight: dict[str, Any], cluster_name: str) -> FindingExplainResult:
        ctx = build_finding_context(insight, cluster_name)
        return FindingExplainResult.model_validate(run_finding_explain(ctx, self._settings).model_dump())

    def triage(self, insight: dict[str, Any], cluster_name: str) -> FindingTriageResult:
        ctx = build_finding_context(insight, cluster_name)
        return FindingTriageResult.model_validate(run_finding_triage(ctx, self._settings).model_dump())

    def remediate(self, insight: dict[str, Any], cluster_name: str) -> RemediationPlanResult:
        ctx = build_finding_context(insight, cluster_name)
        result = run_finding_remediate(ctx, insight, self._settings)
        data = result.model_dump()
        data["impact_level"] = result.impact_level.value if hasattr(result.impact_level, "value") else result.impact_level
        return RemediationPlanResult.model_validate(data)
