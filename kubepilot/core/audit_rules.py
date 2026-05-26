from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from kubepilot.core.schemas import (
    EvidenceRef,
    Recommendation,
    RecommendationCategory,
    RecommendationSeverity,
)


@dataclass(frozen=True)
class AuditFinding:
    category: RecommendationCategory
    severity: RecommendationSeverity
    title: str
    detail: str | None
    evidence_key: str


def evaluate_workload_snapshot(snapshot: dict[str, Any]) -> list[AuditFinding]:
    """Deterministic checks on normalized cluster snapshot JSON."""
    findings: list[AuditFinding] = []
    pods = snapshot.get("pods") or []
    for pod in pods:
        name = pod.get("name") or "unknown"
        ns = pod.get("namespace") or "default"
        pod_key = f"k8s:pod:{ns}:{name}"
        for c in pod.get("containers") or []:
            cname = c.get("name") or "container"
            sec = c.get("security_context") or {}
            if sec.get("privileged"):
                findings.append(
                    AuditFinding(
                        category=RecommendationCategory.security,
                        severity=RecommendationSeverity.high,
                        title=f"Privileged container in {ns}/{name}",
                        detail=f"Container {cname} runs privileged.",
                        evidence_key=pod_key,
                    )
                )
            run_as = sec.get("run_as_user")
            if run_as == 0 or (sec.get("run_as_root") is True):
                findings.append(
                    AuditFinding(
                        category=RecommendationCategory.security,
                        severity=RecommendationSeverity.medium,
                        title=f"Container runs as root ({ns}/{name})",
                        detail=f"Container {cname} runAsUser is 0 or flagged root.",
                        evidence_key=pod_key,
                    )
                )
            image = str(c.get("image") or "")
            if image.endswith(":latest"):
                findings.append(
                    AuditFinding(
                        category=RecommendationCategory.reliability,
                        severity=RecommendationSeverity.low,
                        title=f"Image uses :latest tag ({ns}/{name})",
                        detail=f"Container {cname} uses {image}.",
                        evidence_key=pod_key,
                    )
                )
            resources = c.get("resources") or {}
            if not resources.get("requests") and not resources.get("limits"):
                findings.append(
                    AuditFinding(
                        category=RecommendationCategory.cost,
                        severity=RecommendationSeverity.low,
                        title=f"Missing resource requests/limits ({ns}/{name})",
                        detail=f"Container {cname} has no CPU/memory requests or limits.",
                        evidence_key=pod_key,
                    )
                )
            if not c.get("liveness_probe") and not c.get("readiness_probe"):
                findings.append(
                    AuditFinding(
                        category=RecommendationCategory.reliability,
                        severity=RecommendationSeverity.low,
                        title=f"No liveness/readiness probes ({ns}/{name})",
                        detail=f"Container {cname} has no probes configured.",
                        evidence_key=pod_key,
                    )
                )
    return findings


def findings_to_recommendations(
    findings: list[AuditFinding], analysis_run_id: UUID | None
) -> list[Recommendation]:
    from datetime import UTC, datetime

    now = datetime.now(tz=UTC)
    recs: list[Recommendation] = []
    for f in findings:
        eid = str(uuid4())
        recs.append(
            Recommendation(
                id=uuid4(),
                analysis_run_id=analysis_run_id,
                category=f.category,
                severity=f.severity,
                title=f.title,
                detail=f.detail,
                evidence=[
                    EvidenceRef(id=eid, kind="k8s_snapshot", label=f.evidence_key),
                ],
                created_at=now,
            )
        )
    return recs
