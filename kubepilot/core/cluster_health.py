from __future__ import annotations

from typing import Any

# Severity weights for health score (0–100). Higher impact = larger deduction.
_SEVERITY_PENALTY: dict[str, int] = {
    "critical": 15,
    "high": 8,
    "medium": 4,
    "low": 2,
    "info": 1,
}

_STATUS_FROM_SCORE = (
    (85, "healthy", "Healthy"),
    (65, "degraded", "Degraded"),
    (40, "at_risk", "At risk"),
    (0, "critical", "Critical"),
)


def _severity_penalty(severity: str) -> int:
    return _SEVERITY_PENALTY.get(severity.lower(), 3)


def _insight_effective_severity(ins: dict[str, Any]) -> str:
    eff = ins.get("effective_severity") or ins.get("severity", "low")
    return str(eff).lower()


def _count_severities(insights: list[dict[str, Any]]) -> dict[str, int]:
    sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for ins in insights:
        if ins.get("disposition") == "accepted_system_requirement":
            s = _insight_effective_severity(ins)
            if s in sev_counts:
                sev_counts[s] += 1
            continue
        s = _insight_effective_severity(ins)
        if s in sev_counts:
            sev_counts[s] += 1
        elif s == "warning":
            sev_counts["medium"] += 1
    return sev_counts


def _score_from_severity_counts(sev_counts: dict[str, int], base: float = 100.0) -> float:
    score = base
    for sev, count in sev_counts.items():
        penalty = _severity_penalty(sev)
        score -= min(count * penalty, penalty * 5)
    return score


def _status_label(score: int) -> tuple[str, str]:
    for threshold, status, label in _STATUS_FROM_SCORE:
        if score >= threshold:
            return status, label
    return "critical", "Critical"


def compute_namespace_health(
    insights: list[dict[str, Any]],
    namespace_pod_counts: dict[str, int],
) -> list[dict[str, Any]]:
    """Per-namespace health from findings (effective severity). Sorted unhealthiest first."""
    namespaces = set(namespace_pod_counts) | {str(i.get("namespace") or "default") for i in insights}
    rows: list[dict[str, Any]] = []
    for ns in sorted(namespaces):
        ns_insights = [i for i in insights if str(i.get("namespace") or "default") == ns]
        sev_counts = _count_severities(ns_insights)
        score = max(0, min(100, int(round(_score_from_severity_counts(sev_counts)))))
        status, label = _status_label(score)
        rows.append(
            {
                "namespace": ns,
                "health_score": score,
                "health_status": status,
                "health_label": label,
                "critical_count": sev_counts["critical"],
                "high_count": sev_counts["high"],
                "medium_count": sev_counts["medium"],
                "low_count": sev_counts["low"],
                "workload_count": namespace_pod_counts.get(ns, 0),
            }
        )
    rows.sort(key=lambda r: (r["health_score"], r["namespace"]))
    return rows


def _pod_weighted_average(namespace_health: list[dict[str, Any]]) -> float | None:
    if not namespace_health:
        return None
    total_weight = 0
    weighted = 0.0
    for row in namespace_health:
        w = max(1, int(row.get("workload_count") or 0))
        total_weight += w
        weighted += row["health_score"] * w
    if total_weight == 0:
        return sum(r["health_score"] for r in namespace_health) / len(namespace_health)
    return weighted / total_weight


def compute_cluster_health(
    *,
    registration_status: str | None,
    counts: dict[str, int],
    insights: list[dict[str, Any]],
    error: str | None,
    metrics_available: bool = False,
    namespace_pod_counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Derive hybrid 0–100 health: pod-weighted namespace average + worst namespace; infra penalties on headline."""
    empty = {
        "health_score": None,
        "health_status": "unknown",
        "health_label": "Unavailable",
        "summary": error or "Cluster is not connected.",
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "aggregation_method": "hybrid",
        "namespace_health": [],
        "worst_namespace": None,
    }
    if error or registration_status not in ("connected", None):
        return {**empty, "summary": error or "Cluster is not connected."}

    ns_counts = namespace_pod_counts or {}
    if not ns_counts:
        for ins in insights:
            ns = str(ins.get("namespace") or "default")
            ns_counts[ns] = ns_counts.get(ns, 0) + 1
        if not ns_counts:
            ns_counts = {"default": 1}

    namespace_health = compute_namespace_health(insights, ns_counts)
    sev_counts = _count_severities(insights)

    weighted = _pod_weighted_average(namespace_health)
    score = weighted if weighted is not None else 100.0

    nodes_total = int(counts.get("nodes") or 0)
    nodes_ready = int(counts.get("nodes_ready") or 0)
    pods_total = int(counts.get("pods") or 0)
    pods_running = int(counts.get("pods_running") or 0)
    pods_failed = int(counts.get("pods_failed") or 0)

    if nodes_total > 0:
        node_ratio = nodes_ready / nodes_total
        score -= (1.0 - node_ratio) * 25.0

    if pods_total > 0:
        failed_ratio = pods_failed / pods_total
        score -= min(failed_ratio * 40.0, 20.0)
        if pods_running < pods_total * 0.9:
            score -= 5.0

    if not metrics_available:
        score -= 3.0

    score = max(0, min(100, int(round(score))))
    status, label = _status_label(score)

    worst_ns = None
    if namespace_health:
        w = min(namespace_health, key=lambda r: r["health_score"])
        worst_ns = {
            "name": w["namespace"],
            "health_score": w["health_score"],
            "health_status": w["health_status"],
        }

    parts: list[str] = []
    if weighted is not None:
        parts.append(f"Weighted health {int(round(weighted))}")
    if worst_ns:
        parts.append(f"worst namespace: {worst_ns['name']} ({worst_ns['health_score']})")
    if sev_counts["critical"]:
        parts.append(f"{sev_counts['critical']} critical")
    if sev_counts["high"]:
        parts.append(f"{sev_counts['high']} high")
    if nodes_total and nodes_ready < nodes_total:
        parts.append(f"{nodes_ready}/{nodes_total} nodes ready")
    summary = "; ".join(parts) if parts else "No significant issues detected"

    return {
        "health_score": score,
        "health_status": status,
        "health_label": label,
        "summary": summary,
        "critical_count": sev_counts["critical"],
        "high_count": sev_counts["high"],
        "medium_count": sev_counts["medium"],
        "low_count": sev_counts["low"],
        "aggregation_method": "hybrid",
        "namespace_health": namespace_health,
        "worst_namespace": worst_ns,
    }


def namespace_pod_counts_from_snapshot(snapshot: dict[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for pod in snapshot.get("pods") or []:
        ns = str(pod.get("namespace") or "default")
        counts[ns] = counts.get(ns, 0) + 1
    return counts
