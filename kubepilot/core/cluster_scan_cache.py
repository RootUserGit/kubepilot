from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from kubepilot.db import models as m

META_LAST_SUMMARIES = "last_summaries"
META_CONNECTIVITY = "connectivity_status"
META_LAST_SCAN_AT = "last_scan_at"


def namespace_cache_key(namespace: str | None) -> str:
    return (namespace or "").strip() or "__all__"


def _iter_cached_insights(cluster: m.Cluster) -> list[dict[str, Any]]:
    meta = cluster.onboarding_metadata if isinstance(cluster.onboarding_metadata, dict) else {}
    summaries = meta.get(META_LAST_SUMMARIES)
    if not isinstance(summaries, dict):
        return []
    out: list[dict[str, Any]] = []
    for raw in summaries.values():
        if not isinstance(raw, dict):
            continue
        for ins in raw.get("insights") or []:
            if isinstance(ins, dict):
                out.append(ins)
    return out


def find_insight_in_cluster_cache(cluster: m.Cluster, insight_id: str) -> dict[str, Any] | None:
    """Locate a finding by id across all cached namespace snapshots."""
    for ins in _iter_cached_insights(cluster):
        if ins.get("id") == insight_id:
            return ins
    return None


def find_insight_by_fingerprint(
    cluster: m.Cluster,
    *,
    namespace: str,
    resource_kind: str,
    resource_name: str,
    check_id: str,
    container_name: str | None = None,
) -> dict[str, Any] | None:
    from kubepilot.core.insight_ids import compute_insight_id

    target = compute_insight_id(namespace, resource_kind, resource_name, check_id, container_name)
    for ins in _iter_cached_insights(cluster):
        if ins.get("id") == target:
            return ins
        if (
            ins.get("namespace") == namespace
            and ins.get("resource_kind") == resource_kind
            and ins.get("resource_name") == resource_name
            and ins.get("check_id") == check_id
            and (ins.get("container_name") or "") == (container_name or "")
        ):
            return ins
    return None


def get_cached_summary(cluster: m.Cluster, namespace: str | None = None) -> dict[str, Any] | None:
    meta = cluster.onboarding_metadata if isinstance(cluster.onboarding_metadata, dict) else {}
    summaries = meta.get(META_LAST_SUMMARIES)
    if not isinstance(summaries, dict):
        return None
    raw = summaries.get(namespace_cache_key(namespace))
    return raw if isinstance(raw, dict) else None


def resolve_cached_summary(cluster: m.Cluster, namespace: str | None = None) -> dict[str, Any] | None:
    """Load cached scan for a namespace, or filter the full-cluster scan when only __all__ exists."""
    from kubepilot.core.summary_namespace_filter import filter_summary_by_namespace

    ns = (namespace or "").strip() or None
    if not ns:
        return get_cached_summary(cluster, None)

    direct = get_cached_summary(cluster, ns)
    if direct:
        return direct

    full = get_cached_summary(cluster, None)
    if full and not full.get("error"):
        return filter_summary_by_namespace(full, ns)
    return None


def get_connectivity_status(cluster: m.Cluster) -> str:
    meta = cluster.onboarding_metadata if isinstance(cluster.onboarding_metadata, dict) else {}
    status = meta.get(META_CONNECTIVITY)
    if isinstance(status, str) and status:
        return status
    return "unknown"


def get_last_scan_at(cluster: m.Cluster) -> str | None:
    meta = cluster.onboarding_metadata if isinstance(cluster.onboarding_metadata, dict) else {}
    at = meta.get(META_LAST_SCAN_AT)
    return str(at) if at else None


def mark_cluster_unreachable(db: Session, cluster: m.Cluster) -> None:
    """Record failed reachability without overwriting the last good scan snapshot."""
    meta = dict(cluster.onboarding_metadata) if isinstance(cluster.onboarding_metadata, dict) else {}
    meta[META_CONNECTIVITY] = "unreachable"
    cluster.onboarding_metadata = meta
    flag_modified(cluster, "onboarding_metadata")
    db.add(cluster)


def persist_scan_summary(
    db: Session,
    cluster: m.Cluster,
    namespace: str | None,
    summary: dict[str, Any],
) -> None:
    if summary.get("error"):
        mark_cluster_unreachable(db, cluster)
        return
    meta = dict(cluster.onboarding_metadata) if isinstance(cluster.onboarding_metadata, dict) else {}
    summaries = dict(meta.get(META_LAST_SUMMARIES) or {}) if isinstance(meta.get(META_LAST_SUMMARIES), dict) else {}
    summaries[namespace_cache_key(namespace)] = summary
    meta[META_LAST_SUMMARIES] = summaries
    meta[META_LAST_SCAN_AT] = summary.get("collected_at")
    meta[META_CONNECTIVITY] = "reachable"
    cluster.onboarding_metadata = meta
    flag_modified(cluster, "onboarding_metadata")
    db.add(cluster)


def health_item_from_summary(
    cluster: m.Cluster,
    summary: dict[str, Any] | None,
) -> dict[str, Any]:
    meta = cluster.onboarding_metadata if isinstance(cluster.onboarding_metadata, dict) else {}
    provider = meta.get("provider")
    if not isinstance(provider, str) or not provider:
        provider = "local" if cluster.kubeconfig_yaml else "aws"
    if not summary:
        return {
            "cluster_id": cluster.id,
            "cluster_name": cluster.name,
            "health_status": "unknown",
            "health_label": "Not scanned",
            "summary": "Run a cluster scan to collect health and findings.",
            "registration_status": cluster.registration_status,
            "provider": str(provider),
            "environment": str(meta.get("environment")) if meta.get("environment") else None,
            "region": str(meta.get("aws_region")) if meta.get("aws_region") else None,
        }
    h = summary.get("health") or {}
    ns_health = h.get("namespace_health") or summary.get("namespace_health") or []
    if isinstance(ns_health, list) and len(ns_health) > 5:
        ns_health = ns_health[:5]
    return {
        "cluster_id": cluster.id,
        "cluster_name": cluster.name,
        "health_score": h.get("health_score"),
        "health_status": h.get("health_status", "unknown"),
        "health_label": h.get("health_label", "Unknown"),
        "summary": h.get("summary", ""),
        "critical_count": h.get("critical_count", 0),
        "high_count": h.get("high_count", 0),
        "medium_count": h.get("medium_count", 0),
        "low_count": h.get("low_count", 0),
        "aggregation_method": h.get("aggregation_method", "hybrid"),
        "namespace_health": ns_health,
        "worst_namespace": h.get("worst_namespace"),
        "kubernetes_version": summary.get("kubernetes_version"),
        "provider": str(provider),
        "environment": str(meta.get("environment")) if meta.get("environment") else None,
        "region": str(meta.get("aws_region")) if meta.get("aws_region") else None,
        "registration_status": cluster.registration_status,
    }
