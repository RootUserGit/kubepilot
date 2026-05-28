from __future__ import annotations

import hashlib
import logging
from typing import Any

from kubernetes import client

from kubepilot.collectors.metrics_sampler import _parse_cpu_millicores, _parse_memory_mebibytes
from kubepilot.core.audit_rules import AuditFinding
from kubepilot.core.schemas import RecommendationCategory, RecommendationSeverity

logger = logging.getLogger(__name__)

# Heuristic thresholds (point-in-time; sustained windows need time-series in a later phase).
_CPU_ABSOLUTE_CRITICAL_MILLICORES = 1000.0
_CPU_ABSOLUTE_HIGH_MILLICORES = 500.0
_CPU_SPIKE_MULTIPLIER = 4.0


def _fetch_pod_cpu_by_key() -> dict[tuple[str, str], float]:
    """Aggregate container CPU (mCPU) per pod."""
    out: dict[tuple[str, str], float] = {}
    try:
        api = client.CustomObjectsApi()
        data = api.list_cluster_custom_object(
            group="metrics.k8s.io",
            version="v1beta1",
            plural="pods",
        )
    except Exception as e:
        logger.info("pod metrics for anomaly detection unavailable: %s", e)
        return out

    for item in data.get("items", []):
        meta = item.get("metadata", {})
        ns = meta.get("namespace") or "default"
        name = meta.get("name") or "unknown"
        total = 0.0
        for c in item.get("containers", []):
            usage = c.get("usage", {})
            total += _parse_cpu_millicores(usage.get("cpu", "0"))
        out[(ns, name)] = total
    return out


def _pod_privileged_map(snapshot: dict[str, Any]) -> dict[tuple[str, str], bool]:
    result: dict[tuple[str, str], bool] = {}
    for pod in snapshot.get("pods") or []:
        ns = pod.get("namespace") or "default"
        name = pod.get("name") or "unknown"
        privileged = any(
            (c.get("security_context") or {}).get("privileged") for c in pod.get("containers") or []
        )
        result[(ns, name)] = privileged
    return result


def _insight_id(ns: str, kind: str, name: str, check_id: str) -> str:
    raw = f"{ns}:{kind}:{name}:{check_id}:runtime"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def detect_runtime_anomalies(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """Behavioral/runtime findings from metrics-server CPU patterns + posture correlation."""
    pod_cpu = _fetch_pod_cpu_by_key()
    if not pod_cpu:
        return []

    privileged = _pod_privileged_map(snapshot)
    usages = list(pod_cpu.values())
    median = sorted(usages)[len(usages) // 2] if usages else 0.0
    baseline = max(median, 50.0)

    findings: list[dict[str, Any]] = []

    for (ns, pod_name), cpu_m in pod_cpu.items():
        is_priv = privileged.get((ns, pod_name), False)
        is_spike = cpu_m >= baseline * _CPU_SPIKE_MULTIPLIER
        is_high = cpu_m >= _CPU_ABSOLUTE_HIGH_MILLICORES
        is_critical_cpu = cpu_m >= _CPU_ABSOLUTE_CRITICAL_MILLICORES

        if not (is_high or is_spike):
            continue

        wl = _workload_for_pod(snapshot, ns, pod_name)
        check_id = "runtime_cpu_abuse"

        if is_priv and (is_critical_cpu or is_spike):
            severity = RecommendationSeverity.critical
            title = "Runtime resource abuse (privileged workload)"
            detail = (
                f"Pod {ns}/{pod_name} uses {cpu_m:.0f} mCPU "
                f"(baseline median ~{baseline:.0f} mCPU) while running privileged. "
                "Correlates with crypto-mining / resource hijacking (MITRE ATT&CK T1496)."
            )
            check_id = "runtime_privileged_cpu_abuse"
        elif is_critical_cpu or (is_spike and cpu_m >= _CPU_ABSOLUTE_HIGH_MILLICORES):
            severity = RecommendationSeverity.critical
            title = "Sustained abnormal CPU usage"
            detail = (
                f"Pod {ns}/{pod_name} uses {cpu_m:.0f} mCPU, "
                f"well above cluster baseline (~{baseline:.0f} mCPU). Possible resource hijacking."
            )
        else:
            severity = RecommendationSeverity.high
            title = "Elevated CPU vs workload baseline"
            detail = (
                f"Pod {ns}/{pod_name} uses {cpu_m:.0f} mCPU "
                f"(baseline median ~{baseline:.0f} mCPU)."
            )

        findings.append(
            _finding_to_dict(
                AuditFinding(
                    category=RecommendationCategory.security,
                    severity=severity,
                    title=f"{title} · {wl['kind']}/{wl['name']}",
                    detail=detail,
                    evidence_key=f"k8s:pod:{ns}:{pod_name}",
                    resource_kind=wl["kind"],
                    resource_name=wl["name"],
                    namespace=ns,
                    container_name=None,
                    related_pods=(pod_name,),
                    check_id=check_id,
                    remediation=(
                        "Investigate running processes (kubectl exec / runtime sensor). "
                        "Compare to workload baseline; isolate node if compromise suspected."
                    ),
                ),
                finding_type="behavioral",
                attack_techniques=["T1496"],
            )
        )

    return findings


def _workload_for_pod(snapshot: dict[str, Any], ns: str, pod_name: str) -> dict[str, str]:
    for pod in snapshot.get("pods") or []:
        if pod.get("namespace") == ns and pod.get("name") == pod_name:
            wl = pod.get("workload") or {}
            if wl.get("kind") and wl.get("name"):
                return {
                    "kind": str(wl["kind"]),
                    "name": str(wl["name"]),
                    "namespace": str(wl.get("namespace") or ns),
                }
    return {"kind": "Pod", "name": pod_name, "namespace": ns}


def _finding_to_dict(
    f: AuditFinding,
    *,
    finding_type: str,
    attack_techniques: list[str],
) -> dict[str, Any]:
    return {
        "id": _insight_id(f.namespace, f.resource_kind, f.resource_name, f.check_id),
        "category": f.category.value,
        "severity": f.severity.value,
        "title": f.title,
        "detail": f.detail,
        "resource_kind": f.resource_kind,
        "resource_name": f.resource_name,
        "namespace": f.namespace,
        "container_name": f.container_name,
        "related_pods": list(f.related_pods),
        "check_id": f.check_id,
        "remediation": f.remediation,
        "finding_type": finding_type,
        "attack_techniques": attack_techniques,
    }
