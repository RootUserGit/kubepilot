from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class AnalysisRunStatus(StrEnum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class RecommendationCategory(StrEnum):
    reliability = "reliability"
    cost = "cost"
    security = "security"
    scaling = "scaling"


class RecommendationSeverity(StrEnum):
    info = "info"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AnalysisRunCreate(BaseModel):
    cluster_id: UUID | None = None
    scope_namespace: str | None = None
    scope_namespaces: list[str] | None = None
    scope_label_selector: str | None = None
    time_range_start: datetime
    time_range_end: datetime
    question: str | None = None


class AnalysisRun(BaseModel):
    id: UUID
    cluster_id: UUID | None = None
    status: AnalysisRunStatus
    scope_namespace: str | None = None
    scope_namespaces: list[str] | None = None
    scope_label_selector: str | None = None
    time_range_start: datetime
    time_range_end: datetime
    question: str | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
    recommendation_ids: list[UUID] = Field(default_factory=list)
    investigation_answer: str | None = None


class EvidenceRef(BaseModel):
    id: str
    kind: str
    label: str | None = None


class Recommendation(BaseModel):
    id: UUID
    analysis_run_id: UUID | None = None
    category: RecommendationCategory
    severity: RecommendationSeverity
    title: str
    detail: str | None = None
    evidence: list[EvidenceRef] = Field(default_factory=list)
    created_at: datetime


class RecommendationList(BaseModel):
    items: list[Recommendation]
    total: int


class ClusterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    kubeconfig_yaml: str | None = None


class ClusterPublic(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    kubeconfig_configured: bool


class HealthResponse(BaseModel):
    status: str = "ok"
