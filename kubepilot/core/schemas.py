from __future__ import annotations

import re
from datetime import datetime
from enum import StrEnum
from typing import Literal, Self
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
    namespace_scope: str | None = Field(default=None, max_length=1024)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("name")
    @classmethod
    def cluster_dns(cls, v: str) -> str:
        s = v.strip().lower()
        if not re.match(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", s):
            raise ValueError("Use a DNS-safe cluster name (lowercase letters, numbers, hyphens).")
        return s


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
    aws_profile_id: UUID | None = None

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
                "Agent IRSA role ARN must be an IAM role ARN, e.g. "
                "arn:aws:iam::123456789012:role/your-role-name "
                "(not an EKS cluster ARN like arn:aws:eks:...:cluster/...)."
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
    # Install using the chart from GET /v1/clusters/agent-helm-chart.zip (unzip → ./kubepilot-agent).
    helm_install_local_command: str
    created_at: datetime


class ClusterRegistrationStatusResponse(BaseModel):
    cluster_id: UUID
    cluster_name: str
    registration_status: str
    message: str | None = None
    # When True, cluster owner may POST /clusters/{id}/agent/check-in without X-KubePilot-Agent-Token (local dev).
    owner_check_in_available: bool = False


class ClusterPublic(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    kubeconfig_configured: bool
    registration_status: str | None = None
    connectivity_status: str | None = None
    last_scan_at: str | None = None
    provider: str | None = None
    environment: str | None = None
    region: str | None = None


class ResourceCountItem(BaseModel):
    kind: str
    label: str
    count: int


class InventoryItem(BaseModel):
    name: str
    namespace: str | None = None
    status: str | None = None
    detail: str | None = None


class FindingReferenceItem(BaseModel):
    title: str
    url: str


class FindingExplainResult(BaseModel):
    summary: str
    likely_false_positive: str = "uncertain"
    confidence: float = 0.0
    citations: list[dict[str, str]] = Field(default_factory=list)


class FindingTriageResult(BaseModel):
    summary: str
    likely_false_positive: str = "uncertain"
    confidence: float = 0.0
    recommended_disposition: str | None = None
    citations: list[dict[str, str]] = Field(default_factory=list)


class RemediationStepItem(BaseModel):
    order: int
    title: str
    description: str
    command: str | None = None
    command_type: str = "manual"
    dry_run_command: str | None = None
    verify_command: str | None = None


class FindingContextBody(BaseModel):
    """Optional client context when URL insight id is stale (localStorage vs last scan)."""

    namespace: str | None = None
    resource_kind: str | None = None
    resource_name: str | None = None
    check_id: str | None = None
    container_name: str | None = None
    title: str | None = None
    severity: str | None = None
    category: str | None = None
    detail: str | None = None
    remediation: str | None = None
    disposition: str | None = None
    suppression_reason: str | None = None


class RemediationPlanResult(BaseModel):
    summary: str
    steps: list[RemediationStepItem] = Field(default_factory=list)
    impact_level: str = "low"
    impact_summary: str = ""
    downtime_notes: str | None = None
    prerequisites: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    rollback_steps: list[RemediationStepItem] = Field(default_factory=list)
    do_not_remediate: bool = False
    do_not_remediate_reason: str | None = None
    readonly_notice: str = ""
    remediation_source: str = "template"
    llm_note: str | None = None


class ClusterInsightItem(BaseModel):
    id: str
    category: str
    severity: str
    title: str
    detail: str | None = None
    resource_kind: str = "Pod"
    resource_name: str = ""
    namespace: str = "default"
    container_name: str | None = None
    related_pods: list[str] = Field(default_factory=list)
    check_id: str = ""
    remediation: str | None = None
    finding_type: str = "misconfiguration"
    attack_techniques: list[str] = Field(default_factory=list)
    raw_severity: str | None = None
    effective_severity: str | None = None
    disposition: str = "actionable"
    suppression_reason: str | None = None
    references: list[FindingReferenceItem] = Field(default_factory=list)


class NamespaceHealthItem(BaseModel):
    namespace: str
    health_score: int
    health_status: str
    health_label: str
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    workload_count: int = 0


class WorstNamespaceHealth(BaseModel):
    name: str
    health_score: int
    health_status: str


class ClusterHealth(BaseModel):
    health_score: int | None = None
    health_status: str = "unknown"
    health_label: str = "Unknown"
    summary: str = ""
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    aggregation_method: str = "hybrid"
    namespace_health: list[NamespaceHealthItem] = Field(default_factory=list)
    worst_namespace: WorstNamespaceHealth | None = None


class ClusterHealthItem(BaseModel):
    cluster_id: UUID
    cluster_name: str
    health_score: int | None = None
    health_status: str = "unknown"
    health_label: str = "Unknown"
    summary: str = ""
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    kubernetes_version: str | None = None
    provider: str | None = None
    environment: str | None = None
    region: str | None = None
    registration_status: str | None = None
    aggregation_method: str = "hybrid"
    namespace_health: list[NamespaceHealthItem] = Field(default_factory=list)
    worst_namespace: WorstNamespaceHealth | None = None


class ClusterNodeSummary(BaseModel):
    name: str
    ready: bool
    status: str
    roles: list[str] = Field(default_factory=list)
    kubelet_version: str | None = None
    os_image: str | None = None
    cpu_capacity_millicores: float | None = None
    memory_capacity_mebibytes: float | None = None
    cpu_allocatable_millicores: float | None = None
    memory_allocatable_mebibytes: float | None = None
    cpu_usage_millicores: float | None = None
    memory_usage_mebibytes: float | None = None


class TimeSeriesPoint(BaseModel):
    t: str
    v: float


class ClusterSummaryResponse(BaseModel):
    collected_at: str
    kubernetes_version: str | None = None
    from_cache: bool = False
    filtered_from_all_namespaces: bool = False
    connectivity_status: str | None = None
    last_scan_at: str | None = None
    scan_error: str | None = None
    error: str | None = None
    counts: dict[str, int] = Field(default_factory=dict)
    resource_counts: list[ResourceCountItem] = Field(default_factory=list)
    inventory: dict[str, list[InventoryItem]] = Field(default_factory=dict)
    namespaces: list[str] = Field(default_factory=list)
    selected_namespace: str | None = None
    nodes: list[ClusterNodeSummary] = Field(default_factory=list)
    insights: list[ClusterInsightItem] = Field(default_factory=list)
    metrics_available: bool = False
    metrics_message: str | None = None
    timeseries: dict[str, list[TimeSeriesPoint]] = Field(default_factory=dict)
    health: ClusterHealth = Field(default_factory=ClusterHealth)
    namespace_health: list[NamespaceHealthItem] = Field(default_factory=list)


class HealthCheckDetail(BaseModel):
    status: str
    detail: str | None = None


class HealthResponse(BaseModel):
    status: str
    database: HealthCheckDetail | None = None
    redis: HealthCheckDetail | None = None


class OnboardingExternalIdResponse(BaseModel):
    external_id: str


class CloudFormationLaunchResponse(BaseModel):
    external_id: str
    aws_region: str
    cloudformation_quick_create_url: str | None = None
    template_download_path: str = "/v1/onboarding/cloudformation/template"
    kubepilot_aws_account_id: str
    kubepilot_principal_arn: str | None = None
    setup_note: str | None = None


class AwsProfileCreateIamUser(BaseModel):
    connection_type: Literal["iam_user"] = "iam_user"
    profile_name: str = Field(min_length=1, max_length=128)
    aws_account_id: str = Field(min_length=12, max_length=12)
    default_region: str = Field(min_length=1, max_length=64)
    aws_access_key_id: str = Field(min_length=16, max_length=128)
    aws_secret_access_key: str = Field(min_length=1, max_length=256)
    aws_session_token: str | None = Field(default=None, max_length=2048)
    role_arn: str | None = Field(default=None, max_length=512)

    @field_validator("aws_account_id")
    @classmethod
    def twelve_digits(cls, v: str) -> str:
        s = v.strip()
        if not re.match(r"^\d{12}$", s):
            raise ValueError("AWS account ID must be exactly 12 digits.")
        return s

    @field_validator("profile_name")
    @classmethod
    def name_trim(cls, v: str) -> str:
        return v.strip()


class AwsProfileCreateIamRole(BaseModel):
    connection_type: Literal["iam_role"] = "iam_role"
    profile_name: str = Field(min_length=1, max_length=128)
    aws_account_id: str = Field(min_length=12, max_length=12)
    default_region: str = Field(min_length=1, max_length=64)
    role_arn: str = Field(min_length=1, max_length=512)
    external_id: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("aws_account_id")
    @classmethod
    def twelve_digits(cls, v: str) -> str:
        s = v.strip()
        if not re.match(r"^\d{12}$", s):
            raise ValueError("AWS account ID must be exactly 12 digits.")
        return s

    @field_validator("profile_name", "role_arn")
    @classmethod
    def strip_fields(cls, v: str) -> str:
        return v.strip()


class AwsProfilePublic(BaseModel):
    id: UUID
    profile_name: str
    connection_type: str
    aws_account_id: str
    default_region: str
    role_arn: str | None = None
    external_id: str | None = None
    access_key_last4: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class VerifyAwsIamRoleRequest(BaseModel):
    connection_type: Literal["iam_role"] = "iam_role"
    aws_region: str = Field(min_length=1, max_length=64)
    cluster_name: str = Field(min_length=1, max_length=256)
    role_arn: str | None = Field(default=None, max_length=512)
    external_id: str | None = Field(default=None, max_length=128)
    profile_id: UUID | None = None

    @field_validator("cluster_name")
    @classmethod
    def cluster_name_trim(cls, v: str) -> str:
        return v.strip()

    @field_validator("role_arn", "external_id")
    @classmethod
    def strip_fields(cls, v: str) -> str:
        return v.strip()


class VerifyAwsIamUserRequest(BaseModel):
    connection_type: Literal["iam_user"] = "iam_user"
    aws_region: str = Field(min_length=1, max_length=64)
    cluster_name: str = Field(min_length=1, max_length=256)
    aws_access_key_id: str | None = Field(default=None, min_length=16, max_length=128)
    aws_secret_access_key: str | None = Field(default=None, min_length=1, max_length=256)
    aws_session_token: str | None = Field(default=None, max_length=2048)
    profile_id: UUID | None = None

    @field_validator("cluster_name")
    @classmethod
    def cluster_name_trim(cls, v: str) -> str:
        return v.strip()


class VerifyAwsSuccessResponse(BaseModel):
    status: str = "success"
    cluster_arn: str
    cluster_name: str
    aws_account_id: str
    aws_region: str
