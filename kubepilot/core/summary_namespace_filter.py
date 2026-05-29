from __future__ import annotations

import copy
from typing import Any

from kubepilot.core.cluster_health import compute_cluster_health

_RESOURCE_LABELS: dict[str, str] = {
    "pods": "Pods",
    "deployments": "Deployments",
    "statefulsets": "StatefulSets",
    "daemonsets": "DaemonSets",
    "services": "Services",
    "configmaps": "ConfigMaps",
    "jobs": "Jobs",
    "cronjobs": "CronJobs",
    "ingresses": "Ingresses",
    "networkpolicies": "NetworkPolicies",
    "httproutes": "HTTPRoutes",
    "gateways": "Gateways",
}


def filter_summary_by_namespace(summary: dict[str, Any], namespace: str) -> dict[str, Any]:
    """Derive a namespace-scoped view from a full-cluster scan snapshot."""
    out = copy.deepcopy(summary)
    out["selected_namespace"] = namespace
    out["filtered_from_all_namespaces"] = True

    inv = summary.get("inventory") or {}
    filtered_inv: dict[str, list[dict[str, Any]]] = {}
    for kind, items in inv.items():
        if not isinstance(items, list):
            continue
        if kind == "nodes":
            filtered_inv[kind] = items
        elif kind == "namespaces":
            filtered_inv[kind] = [i for i in items if i.get("name") == namespace]
        else:
            filtered_inv[kind] = [i for i in items if i.get("namespace") == namespace]
    out["inventory"] = filtered_inv

    out["insights"] = [
        i for i in (summary.get("insights") or []) if isinstance(i, dict) and i.get("namespace") == namespace
    ]

    resource_counts: list[dict[str, Any]] = []
    for kind, label in _RESOURCE_LABELS.items():
        rows = filtered_inv.get(kind)
        if rows:
            resource_counts.append({"kind": kind, "label": label, "count": len(rows)})
    out["resource_counts"] = resource_counts

    pod_rows = filtered_inv.get("pods", [])
    base_counts = dict(summary.get("counts") or {})
    nodes_total = base_counts.get("nodes", len(filtered_inv.get("nodes", [])))
    nodes_ready = base_counts.get("nodes_ready", nodes_total)
    out["counts"] = {
        "nodes": nodes_total,
        "nodes_ready": nodes_ready,
        "namespaces": 1,
        "pods": len(pod_rows),
        "pods_running": sum(1 for p in pod_rows if (p.get("status") or "").lower() == "running"),
        "pods_pending": sum(1 for p in pod_rows if (p.get("status") or "").lower() == "pending"),
        "pods_failed": sum(
            1 for p in pod_rows if (p.get("status") or "").lower() in ("failed", "unknown")
        ),
        "deployments": len(filtered_inv.get("deployments", [])),
    }

    # Preserve cluster-level hybrid health from the full scan (headline score unchanged by namespace filter).
    out["health"] = copy.deepcopy(summary.get("health") or {})
    out["namespace_health"] = summary.get("namespace_health") or out["health"].get("namespace_health") or []
    return out
