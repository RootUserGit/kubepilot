from __future__ import annotations

import re
from datetime import datetime
from enum import StrEnum
from typing import Self
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


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


class ClusterRegisterRequest(BaseModel):
    """Dashboard flow: capture EKS metadata before the in-cluster agent checks in."""

    cluster_name: str = Field(min_length=1, max_length=256)
    aws_account_id: str = Field(min_length=1, max_length=32)
    aws_region: str = Field(min_length=1, max_length=64)
    environment: str = Field(min_length=1, max_length=64)
    role_arn: str = Field(min_length=1, max_length=512)
    team_owner_label: str | None = Field(default=None, max_length=256)
    namespace_scope: str | None = Field(default=None, max_length=1024)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("cluster_name")
    @classmethod
    def cluster_dns(cls, v: str) -> str:
        s = v.strip().lower()
        if not re.match(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", s):
            raise ValueError("Use a DNS-safe cluster name (lowercase letters, numbers, hyphens).")
        return s

    @field_validator("aws_account_id")
    @classmethod
    def twelve_digits(cls, v: str) -> str:
        s = v.strip()
        if not re.match(r"^\d{12}$", s):
            raise ValueError("AWS account ID must be exactly 12 digits.")
        return s

    @field_validator("role_arn")
    @classmethod
    def arn_trim(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def role_arn_matches_account(self) -> Self:
        m = re.match(r"^arn:aws:iam::(\d{12}):role/.+", self.role_arn)
        if not m:
            raise ValueError(
                "Role ARN must look like arn:aws:iam::123456789012:role/your-role-name"
            )
        if m.group(1) != self.aws_account_id:
            raise ValueError(
                "The 12-digit account in the role ARN must match the AWS account ID field."
            )
        return self


class ClusterRegistrationResponse(BaseModel):
    id: UUID
    name: str
    registration_status: str
    helm_install_command: str
    created_at: datetime


class ClusterRegistrationStatusResponse(BaseModel):
    cluster_id: UUID
    cluster_name: str
    registration_status: str
    message: str | None = None


class ClusterPublic(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    kubeconfig_configured: bool
    registration_status: str | None = None


class HealthCheckDetail(BaseModel):
    status: str
    detail: str | None = None


class HealthResponse(BaseModel):
    status: str
    database: HealthCheckDetail | None = None
    redis: HealthCheckDetail | None = None
