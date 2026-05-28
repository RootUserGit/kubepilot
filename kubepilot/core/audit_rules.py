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
    resource_kind: str = "Pod"
    resource_name: str = ""
    namespace: str = "default"
    container_name: str | None = None
    related_pods: tuple[str, ...] = ()
    check_id: str = ""
    remediation: str | None = None


def _workload_ref(pod: dict[str, Any]) -> dict[str, str]:
    wl = pod.get("workload") or {}
    ns = pod.get("namespace") or "default"
    if wl.get("kind") and wl.get("name"):
        return {"kind": str(wl["kind"]), "name": str(wl["name"]), "namespace": str(wl.get("namespace") or ns)}
    name = pod.get("name") or "unknown"
    return {"kind": "Pod", "name": name, "namespace": ns}


def _emit_finding(
    findings: dict[tuple[str, ...], AuditFinding],
    *,
    pod: dict[str, Any],
    container_name: str,
    check_id: str,
    category: RecommendationCategory,
    severity: RecommendationSeverity,
    title: str,
    detail: str,
    remediation: str,
) -> None:
    wl = _workload_ref(pod)
    pod_name = pod.get("name") or "unknown"
    ns = wl["namespace"]
    dedupe_key = (ns, wl["kind"], wl["name"], check_id, container_name)
    evidence_key = f"k8s:{wl['kind'].lower()}:{ns}:{wl['name']}"

    if dedupe_key in findings:
        existing = findings[dedupe_key]
        pods = tuple(sorted(set(existing.related_pods) | {pod_name}))
        findings[dedupe_key] = AuditFinding(
            category=existing.category,
            severity=existing.severity,
            title=existing.title,
            detail=existing.detail,
            evidence_key=existing.evidence_key,
            resource_kind=existing.resource_kind,
            resource_name=existing.resource_name,
            namespace=existing.namespace,
            container_name=existing.container_name,
            related_pods=pods,
            check_id=existing.check_id,
            remediation=existing.remediation,
        )
        return

    wl_label = f"{wl['kind']}/{wl['name']}"
    pod_suffix = "" if wl["kind"] != "Pod" else f" ({ns}/{pod_name})"
    findings[dedupe_key] = AuditFinding(
        category=category,
        severity=severity,
        title=f"{title} · {wl_label}{pod_suffix}",
        detail=detail,
        evidence_key=evidence_key,
        resource_kind=wl["kind"],
        resource_name=wl["name"],
        namespace=ns,
        container_name=container_name,
        related_pods=(pod_name,) if wl["kind"] != "Pod" else (),
        check_id=check_id,
        remediation=remediation,
    )


def evaluate_workload_snapshot(snapshot: dict[str, Any]) -> list[AuditFinding]:
    """Deterministic checks on normalized cluster snapshot JSON."""
    indexed: dict[tuple[str, ...], AuditFinding] = {}
    pods = snapshot.get("pods") or []
    for pod in pods:
        name = pod.get("name") or "unknown"
        ns = pod.get("namespace") or "default"
        for c in pod.get("containers") or []:
            cname = c.get("name") or "container"
            sec = c.get("security_context") or {}
            if sec.get("privileged"):
                _emit_finding(
                    indexed,
                    pod=pod,
                    container_name=cname,
                    check_id="privileged",
                    category=RecommendationCategory.security,
                    severity=RecommendationSeverity.high,
                    title="Privileged container",
                    detail=f"Container {cname} runs privileged.",
                    remediation="Set securityContext.privileged to false unless strictly required.",
                )
            run_as = sec.get("run_as_user")
            if run_as == 0 or (sec.get("run_as_root") is True):
                _emit_finding(
                    indexed,
                    pod=pod,
                    container_name=cname,
                    check_id="run_as_root",
                    category=RecommendationCategory.security,
                    severity=RecommendationSeverity.medium,
                    title="Container runs as root",
                    detail=f"Container {cname} runAsUser is 0 or flagged root.",
                    remediation="Use a non-zero runAsUser or pod security standards.",
                )
            image = str(c.get("image") or "")
            if image.endswith(":latest"):
                _emit_finding(
                    indexed,
                    pod=pod,
                    container_name=cname,
                    check_id="latest_tag",
                    category=RecommendationCategory.reliability,
                    severity=RecommendationSeverity.low,
                    title="Image uses :latest tag",
                    detail=f"Container {cname} uses {image}.",
                    remediation="Pin images to immutable tags or digests.",
                )
            resources = c.get("resources") or {}
            if not resources.get("requests") and not resources.get("limits"):
                _emit_finding(
                    indexed,
                    pod=pod,
                    container_name=cname,
                    check_id="missing_resources",
                    category=RecommendationCategory.cost,
                    severity=RecommendationSeverity.low,
                    title="Missing resource requests/limits",
                    detail=f"Container {cname} has no CPU/memory requests or limits.",
                    remediation="Set requests and limits for predictable scheduling and capacity planning.",
                )
            if not c.get("liveness_probe") and not c.get("readiness_probe"):
                _emit_finding(
                    indexed,
                    pod=pod,
                    container_name=cname,
                    check_id="missing_probes",
                    category=RecommendationCategory.reliability,
                    severity=RecommendationSeverity.low,
                    title="No liveness/readiness probes",
                    detail=f"Container {cname} has no probes configured.",
                    remediation="Add liveness and readiness probes for production workloads.",
                )
        # silence unused in loop for mypy
        _ = name, ns
    return list(indexed.values())


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
