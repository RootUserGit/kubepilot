from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class ImpactLevel(StrEnum):
    none = "none"
    low = "low"
    medium = "medium"
    high = "high"


class RemediationStep(BaseModel):
    order: int
    title: str
    description: str
    command: str | None = None
    command_type: Literal["kubectl", "helm", "manifest", "manual"] = "manual"
    dry_run_command: str | None = None
    verify_command: str | None = None


class RemediationPlanResult(BaseModel):
    summary: str
    steps: list[RemediationStep] = Field(default_factory=list)
    impact_level: ImpactLevel = ImpactLevel.low
    impact_summary: str = ""
    downtime_notes: str | None = None
    prerequisites: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    rollback_steps: list[RemediationStep] = Field(default_factory=list)
    do_not_remediate: bool = False
    do_not_remediate_reason: str | None = None
    readonly_notice: str = (
        "KubePilot has read-only access. Review impact below and run commands in your own terminal. "
        "KubePilot will not apply changes."
    )
    remediation_source: str = "template"
    llm_note: str | None = None


class FindingExplainResult(BaseModel):
    summary: str
    likely_false_positive: Literal["true", "false", "uncertain"] = "uncertain"
    confidence: float = 0.0
    citations: list[dict[str, str]] = Field(default_factory=list)


class FindingTriageResult(BaseModel):
    summary: str
    likely_false_positive: Literal["true", "false", "uncertain"] = "uncertain"
    confidence: float = 0.0
    recommended_disposition: str | None = None
    citations: list[dict[str, str]] = Field(default_factory=list)
