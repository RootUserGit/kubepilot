from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from kubernetes import client
from kubernetes.client.rest import ApiException
from urllib3.exceptions import MaxRetryError, NewConnectionError
from sqlalchemy import select
from sqlalchemy.orm import Session

from kubepilot.collectors.k8s_snapshot import collect_snapshot, load_kube_config
from kubepilot.collectors.metrics_sampler import _parse_cpu_millicores, _parse_memory_mebibytes
# Runtime behavioral anomalies (CPU spike → CRITICAL) disabled until baseline engine ships.
# See docs/SEVERITY_AND_HEALTH.md backlog.
from kubepilot.core.audit_rules import evaluate_workload_snapshot
from kubepilot.core.cluster_health import (
    compute_cluster_health,
    namespace_pod_counts_from_snapshot,
)
from kubepilot.core.finding_exceptions import apply_finding_exceptions, enriched_to_insight_dict
from kubepilot.db import models as m

logger = logging.getLogger(__name__)


def _node_roles(labels: dict[str, str] | None) -> list[str]:
    if not labels:
        return []
    roles: list[str] = []
    for key in labels:
        if key.startswith("node-role.kubernetes.io/"):
            roles.append(key.split("/", 1)[-1])
    return roles or ["worker"]


def _fetch_kubernetes_version(v1: client.CoreV1Api | None = None) -> str | None:
    """Cluster git version from /version (e.g. v1.28.6)."""
    try:
        ver_api = client.VersionApi()
        code = ver_api.get_code()
        raw = (code.git_version or "").strip()
        if raw:
            return raw
        if code.major and code.minor:
            return f"v{code.major}.{code.minor}"
    except Exception as e:
        logger.info("kubernetes version unavailable: %s", e)
    if v1 is not None:
        try:
            nodes = v1.list_node(watch=False).items
            for node in nodes:
                kv = node.status.node_info.kubelet_version if node.status.node_info else None
                if kv:
                    return kv.split("-")[0]
        except Exception:
            pass
    return None


def _node_ready(node: Any) -> bool:
    for cond in node.status.conditions or []:
        if cond.type == "Ready" and cond.status == "True":
            return True
    return False


def _quantity_cpu_millicores(qty: str | None) -> float | None:
    if not qty:
        return None
    try:
        return _parse_cpu_millicores(str(qty))
    except (TypeError, ValueError):
        return None


def _quantity_mem_mib(qty: str | None) -> float | None:
    if not qty:
        return None
    try:
        return _parse_memory_mebibytes(str(qty))
    except (TypeError, ValueError):
        return None


def _fetch_node_metrics() -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {}
    try:
        api = client.CustomObjectsApi()
        data = api.list_cluster_custom_object(
            group="metrics.k8s.io",
            version="v1beta1",
            plural="nodes",
        )
    except Exception as e:
        logger.info("node metrics unavailable: %s", e)
        return out

    for item in data.get("items", []):
        name = item.get("metadata", {}).get("name")
        if not name:
            continue
        usage = item.get("usage", {})
        out[name] = {
            "cpu_millicores": _parse_cpu_millicores(usage.get("cpu", "0")),
            "memory_mebibytes": _parse_memory_mebibytes(usage.get("memory", "0")),
        }
    return out


def _in_namespace(meta_namespace: str | None, namespace: str | None) -> bool:
    if namespace is None:
        return True
    return meta_namespace == namespace


def _pod_phase_counts(v1: client.CoreV1Api, namespace: str | None) -> dict[str, int]:
    counts: dict[str, int] = {"total": 0, "running": 0, "pending": 0, "failed": 0, "succeeded": 0}
    pods = v1.list_pod_for_all_namespaces(watch=False)
    for pod in pods.items:
        if not _in_namespace(pod.metadata.namespace, namespace):
            continue
        counts["total"] += 1
        phase = (pod.status.phase or "Unknown").lower()
        if phase in counts:
            counts[phase] += 1
        elif phase == "failed":
            counts["failed"] += 1
    return counts


def _count_list(items: list[Any], namespace: str | None) -> int:
    if namespace is None:
        return len(items)
    return sum(1 for x in items if _in_namespace(getattr(x.metadata, "namespace", None), namespace))


def _collect_resource_counts(
    *,
    v1: client.CoreV1Api,
    apps: client.AppsV1Api,
    batch: client.BatchV1Api,
    net: client.NetworkingV1Api,
    custom: client.CustomObjectsApi,
    namespace: str | None,
) -> list[dict[str, Any]]:
    """Discover resource types present in the cluster (or namespace) for dynamic KPI cards."""
    entries: list[dict[str, Any]] = []

    def add(kind: str, label: str, count: int) -> None:
        if count > 0:
            entries.append({"kind": kind, "label": label, "count": count})

    add("pods", "Pods", _count_list(v1.list_pod_for_all_namespaces(watch=False).items, namespace))
    add(
        "deployments",
        "Deployments",
        _count_list(apps.list_deployment_for_all_namespaces(watch=False).items, namespace),
    )
    add(
        "statefulsets",
        "StatefulSets",
        _count_list(apps.list_stateful_set_for_all_namespaces(watch=False).items, namespace),
    )
    add(
        "daemonsets",
        "DaemonSets",
        _count_list(apps.list_daemon_set_for_all_namespaces(watch=False).items, namespace),
    )
    add(
        "services",
        "Services",
        _count_list(v1.list_service_for_all_namespaces(watch=False).items, namespace),
    )
    add(
        "configmaps",
        "ConfigMaps",
        _count_list(v1.list_config_map_for_all_namespaces(watch=False).items, namespace),
    )
    add(
        "jobs",
        "Jobs",
        _count_list(batch.list_job_for_all_namespaces(watch=False).items, namespace),
    )
    add(
        "cronjobs",
        "CronJobs",
        _count_list(batch.list_cron_job_for_all_namespaces(watch=False).items, namespace),
    )

    try:
        ingress_items = net.list_ingress_for_all_namespaces(watch=False).items
        add("ingresses", "Ingresses", _count_list(ingress_items, namespace))
    except ApiException:
        pass

    try:
        if namespace:
            ing = net.list_namespaced_network_policy(namespace=namespace, watch=False).items
            add("networkpolicies", "NetworkPolicies", len(ing))
        else:
            add(
                "networkpolicies",
                "NetworkPolicies",
                _count_list(net.list_network_policy_for_all_namespaces(watch=False).items, None),
            )
    except ApiException:
        pass

    try:
        if namespace:
            routes = custom.list_namespaced_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                namespace=namespace,
                plural="httproutes",
            )
            items = routes.get("items", [])
        else:
            routes = custom.list_cluster_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                plural="httproutes",
            )
            items = routes.get("items", [])
        add("httproutes", "HTTPRoutes", len(items))
    except ApiException:
        pass

    try:
        if namespace:
            gw = custom.list_namespaced_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                namespace=namespace,
                plural="gateways",
            )
            items = gw.get("items", [])
        else:
            gw = custom.list_cluster_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                plural="gateways",
            )
            items = gw.get("items", [])
        add("gateways", "Gateways", len(items))
    except ApiException:
        pass

    return entries


def _dep_ready(dep: Any) -> str:
    desired = dep.spec.replicas or 0
    ready = 0
    if dep.status and dep.status.ready_replicas is not None:
        ready = dep.status.ready_replicas
    return f"{ready}/{desired}"


def _collect_inventory(
    *,
    v1: client.CoreV1Api,
    apps: client.AppsV1Api,
    batch: client.BatchV1Api,
    net: client.NetworkingV1Api,
    custom: client.CustomObjectsApi,
    nodes_out: list[dict[str, Any]],
    namespace: str | None,
) -> dict[str, list[dict[str, Any]]]:
    inv: dict[str, list[dict[str, Any]]] = {}

    inv["nodes"] = [
        {
            "name": n["name"],
            "namespace": None,
            "status": n["status"],
            "detail": ", ".join(n["roles"]),
        }
        for n in nodes_out
    ]

    inv["namespaces"] = []
    for ns in v1.list_namespace(watch=False).items:
        if not _in_namespace(ns.metadata.name, namespace):
            continue
        phase = ns.status.phase if ns.status else "Unknown"
        inv["namespaces"].append(
            {"name": ns.metadata.name, "namespace": None, "status": phase, "detail": None}
        )

    def _items_for(kind: str, rows: list[dict[str, Any]]) -> None:
        if rows:
            inv[kind] = rows

    pod_rows: list[dict[str, Any]] = []
    for pod in v1.list_pod_for_all_namespaces(watch=False).items:
        if not _in_namespace(pod.metadata.namespace, namespace):
            continue
        phase = pod.status.phase if pod.status else "Unknown"
        pod_rows.append(
            {
                "name": pod.metadata.name,
                "namespace": pod.metadata.namespace,
                "status": phase,
                "detail": pod.spec.node_name,
            }
        )
    _items_for("pods", sorted(pod_rows, key=lambda x: (x["namespace"] or "", x["name"]))[:200])

    dep_rows: list[dict[str, Any]] = []
    for dep in apps.list_deployment_for_all_namespaces(watch=False).items:
        if not _in_namespace(dep.metadata.namespace, namespace):
            continue
        dep_rows.append(
            {
                "name": dep.metadata.name,
                "namespace": dep.metadata.namespace,
                "status": _dep_ready(dep),
                "detail": "ready replicas",
            }
        )
    _items_for("deployments", sorted(dep_rows, key=lambda x: (x["namespace"] or "", x["name"])))

    for kind, list_fn, status_fn in [
        (
            "daemonsets",
            lambda: apps.list_daemon_set_for_all_namespaces(watch=False).items,
            lambda d: f"{d.status.number_ready or 0}/{d.status.desired_number_scheduled or 0}",
        ),
        (
            "statefulsets",
            lambda: apps.list_stateful_set_for_all_namespaces(watch=False).items,
            lambda s: f"{s.status.ready_replicas or 0}/{s.spec.replicas or 0}",
        ),
    ]:
        rows = []
        for obj in list_fn():
            if not _in_namespace(obj.metadata.namespace, namespace):
                continue
            rows.append(
                {
                    "name": obj.metadata.name,
                    "namespace": obj.metadata.namespace,
                    "status": status_fn(obj),
                    "detail": None,
                }
            )
        _items_for(kind, sorted(rows, key=lambda x: (x["namespace"] or "", x["name"])))

    svc_rows = []
    for svc in v1.list_service_for_all_namespaces(watch=False).items:
        if not _in_namespace(svc.metadata.namespace, namespace):
            continue
        svc_rows.append(
            {
                "name": svc.metadata.name,
                "namespace": svc.metadata.namespace,
                "status": svc.spec.type or "ClusterIP",
                "detail": None,
            }
        )
    _items_for("services", sorted(svc_rows, key=lambda x: (x["namespace"] or "", x["name"])))

    cm_rows = []
    for cm in v1.list_config_map_for_all_namespaces(watch=False).items:
        if not _in_namespace(cm.metadata.namespace, namespace):
            continue
        cm_rows.append({"name": cm.metadata.name, "namespace": cm.metadata.namespace, "status": None, "detail": None})
    _items_for("configmaps", sorted(cm_rows, key=lambda x: (x["namespace"] or "", x["name"]))[:100])

    try:
        ing_rows = []
        for ing in net.list_ingress_for_all_namespaces(watch=False).items:
            if not _in_namespace(ing.metadata.namespace, namespace):
                continue
            ing_rows.append(
                {
                    "name": ing.metadata.name,
                    "namespace": ing.metadata.namespace,
                    "status": "Active",
                    "detail": None,
                }
            )
        _items_for("ingresses", sorted(ing_rows, key=lambda x: (x["namespace"] or "", x["name"])))
    except ApiException:
        pass

    try:
        if namespace:
            routes = custom.list_namespaced_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                namespace=namespace,
                plural="httproutes",
            )
        else:
            routes = custom.list_cluster_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                plural="httproutes",
            )
        hr_rows = []
        for item in routes.get("items", []):
            meta = item.get("metadata", {})
            hr_rows.append(
                {
                    "name": meta.get("name", ""),
                    "namespace": meta.get("namespace"),
                    "status": "Programmed",
                    "detail": None,
                }
            )
        _items_for("httproutes", sorted(hr_rows, key=lambda x: (x["namespace"] or "", x["name"])))
    except ApiException:
        pass

    return inv


def _timeseries_from_db(session: Session, cluster_id: UUID, limit: int = 48) -> dict[str, list[dict[str, Any]]]:
    rows = session.scalars(
        select(m.MetricSample)
        .where(m.MetricSample.cluster_id == cluster_id)
        .order_by(m.MetricSample.collected_at.asc())
        .limit(limit * 20)
    ).all()
    if not rows:
        return {"cpu_millicores": [], "memory_mebibytes": []}

    buckets: dict[datetime, list[m.MetricSample]] = {}
    for r in rows:
        t = r.collected_at.replace(microsecond=0)
        buckets.setdefault(t, []).append(r)

    cpu_series: list[dict[str, Any]] = []
    mem_series: list[dict[str, Any]] = []
    for t in sorted(buckets.keys())[-limit:]:
        group = buckets[t]
        cpu = sum(x.cpu_millicores or 0 for x in group)
        mem = sum(x.memory_mebibytes or 0 for x in group)
        iso = t.astimezone(UTC).isoformat()
        cpu_series.append({"t": iso, "v": round(cpu, 2)})
        mem_series.append({"t": iso, "v": round(mem, 2)})
    return {"cpu_millicores": cpu_series, "memory_mebibytes": mem_series}


def _insight_id(namespace: str, resource_kind: str, resource_name: str, check_id: str, container: str | None) -> str:
    from kubepilot.core.insight_ids import compute_insight_id

    return compute_insight_id(namespace, resource_kind, resource_name, check_id, container)


def _insights_from_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    findings = evaluate_workload_snapshot(snapshot)
    out: list[dict[str, Any]] = []
    for f in findings:
        enriched = apply_finding_exceptions(f)
        f = enriched.finding
        detail = f.detail or ""
        if f.related_pods:
            pod_list = ", ".join(f.related_pods)
            detail = f"{detail}\n\nAffected pods: {pod_list}" if detail else f"Affected pods: {pod_list}"
        iid = _insight_id(f.namespace, f.resource_kind, f.resource_name, f.check_id, f.container_name)
        out.append(enriched_to_insight_dict(enriched, iid, detail.strip() or None))
    return out


def _cluster_provider(cluster: m.Cluster) -> str:
    meta = cluster.onboarding_metadata if isinstance(cluster.onboarding_metadata, dict) else {}
    p = meta.get("provider")
    if isinstance(p, str) and p.strip():
        return p.strip().lower()
    return "local" if cluster.kubeconfig_yaml else "aws"


def _log_scan_failure(cluster: m.Cluster, phase: str, exc: BaseException | None = None) -> None:
    """Log full exception server-side; never rely on this text reaching the browser."""
    extra = {
        "cluster_id": str(cluster.id),
        "cluster_name": cluster.name,
        "provider": _cluster_provider(cluster),
        "scan_phase": phase,
    }
    if exc is not None:
        logger.warning("cluster_scan_failed", extra=extra, exc_info=exc)
    else:
        logger.warning("cluster_scan_failed", extra=extra)


def _user_safe_scan_error(cluster: m.Cluster, exc: Exception) -> str:
    """Short, product-safe copy for API/UI. Details go to logs only."""
    prov = _cluster_provider(cluster)
    if isinstance(exc, ApiException):
        if prov == "aws":
            return (
                "Live scan could not use the Kubernetes API from this server. "
                "For private EKS, add kubeconfig for this cluster or run scans from a runner in your network."
            )
        return (
            "The Kubernetes API returned an error. Check kubeconfig permissions or that the cluster is reachable."
        )
    if isinstance(exc, (ConnectionError, NewConnectionError, MaxRetryError)):
        if prov == "aws":
            return (
                "No working network path to the Kubernetes API with the current settings. "
                "Private clusters need kubeconfig on the API host or a collector inside your VPC."
            )
        return (
            "Could not reach the cluster API. If you use a local cluster, refresh kubeconfig after restarts, then scan again."
        )
    return "Scan did not finish. Please wait before trying again, or ask your admin if this continues."


def _no_kubeconfig_message(cluster: m.Cluster) -> str:
    if _cluster_provider(cluster) == "aws":
        return (
            "Live scans need Kubernetes API access. This workspace does not have kubeconfig for this cluster yet, "
            "so the API cannot call your private EKS control plane. Add kubeconfig (encrypted at rest when enabled) "
            "or run collection from a component in your VPC."
        )
    return "No kubeconfig stored for this cluster. Re-register and paste kubeconfig to run live scans."


def collect_cluster_summary(
    *,
    cluster: m.Cluster,
    session: Session,
    kube_config_path: str | None = None,
    namespace: str | None = None,
) -> dict[str, Any]:
    """Live cluster inventory + lint insights + optional metrics-server data."""
    now = datetime.now(tz=UTC)
    kube_yaml = cluster.kubeconfig_yaml
    path = kube_config_path if not kube_yaml else None
    empty_base: dict[str, Any] = {
        "collected_at": now.isoformat(),
        "error": None,
        "counts": {},
        "resource_counts": [],
        "inventory": {},
        "namespaces": [],
        "selected_namespace": namespace,
        "nodes": [],
        "insights": [],
        "metrics_available": False,
        "metrics_message": None,
        "timeseries": {"cpu_millicores": [], "memory_mebibytes": []},
        "health": compute_cluster_health(
            registration_status=cluster.registration_status,
            counts={},
            insights=[],
            error="pending",
            metrics_available=False,
        ),
    }

    if not kube_yaml and not path:
        logger.info(
            "cluster_scan_skipped_no_kubeconfig",
            extra={
                "cluster_id": str(cluster.id),
                "cluster_name": cluster.name,
                "provider": _cluster_provider(cluster),
            },
        )
        msg = _no_kubeconfig_message(cluster)
        return {
            **empty_base,
            "error": msg,
            "metrics_message": None,
        }

    try:
        load_kube_config(kubeconfig_yaml=kube_yaml, kube_config_path=path)
    except Exception as e:
        _log_scan_failure(cluster, "load_kube_config", e)
        return {
            **empty_base,
            "error": "Kubeconfig could not be loaded. Regenerate it from a machine that can reach the cluster and paste it again.",
            "metrics_message": None,
        }

    v1 = client.CoreV1Api()
    apps = client.AppsV1Api()
    batch = client.BatchV1Api()
    net = client.NetworkingV1Api()
    custom = client.CustomObjectsApi()

    namespace_names: list[str] = []
    try:
        namespace_names = sorted(
            n.metadata.name for n in v1.list_namespace(watch=False).items if n.metadata.name
        )
    except Exception as e:
        _log_scan_failure(cluster, "list_namespace", e)
        msg = _user_safe_scan_error(cluster, e)
        return {
            **empty_base,
            "error": msg,
            "metrics_message": None,
            "health": compute_cluster_health(
                registration_status=cluster.registration_status,
                counts={},
                insights=[],
                error=msg,
                metrics_available=False,
            ),
        }

    try:
        if namespace and namespace not in namespace_names:
            return {
                **empty_base,
                "namespaces": namespace_names,
                "error": f"Namespace '{namespace}' was not found in this cluster.",
            }

        node_metrics = _fetch_node_metrics()
        metrics_available = bool(node_metrics)
        metrics_message: str | None = None
        if not metrics_available:
            metrics_message = (
                "Metrics Server is not available in this cluster. Install metrics-server "
                "(e.g. minikube addons enable metrics-server) to see CPU/memory usage."
            )

        nodes_out: list[dict[str, Any]] = []
        node_list = v1.list_node(watch=False)
        ready_count = 0
        for node in node_list.items:
            name = node.metadata.name
            ready = _node_ready(node)
            if ready:
                ready_count += 1
            cap = node.status.capacity or {}
            alloc = node.status.allocatable or {}
            nm = node_metrics.get(name, {})
            nodes_out.append(
                {
                    "name": name,
                    "ready": ready,
                    "status": "Ready" if ready else "NotReady",
                    "roles": _node_roles(node.metadata.labels),
                    "kubelet_version": node.status.node_info.kubelet_version if node.status.node_info else None,
                    "os_image": node.status.node_info.os_image if node.status.node_info else None,
                    "cpu_capacity_millicores": _quantity_cpu_millicores(cap.get("cpu")),
                    "memory_capacity_mebibytes": _quantity_mem_mib(cap.get("memory")),
                    "cpu_allocatable_millicores": _quantity_cpu_millicores(alloc.get("cpu")),
                    "memory_allocatable_mebibytes": _quantity_mem_mib(alloc.get("memory")),
                    "cpu_usage_millicores": nm.get("cpu_millicores"),
                    "memory_usage_mebibytes": nm.get("memory_mebibytes"),
                }
            )

        pod_counts = _pod_phase_counts(v1, namespace)
        resource_counts = _collect_resource_counts(
            v1=v1,
            apps=apps,
            batch=batch,
            net=net,
            custom=custom,
            namespace=namespace,
        )
        dep_count = next((r["count"] for r in resource_counts if r["kind"] == "deployments"), 0)

        ns_filter = [namespace] if namespace else None
        snapshot = collect_snapshot(
            namespaces=ns_filter,
            kubeconfig_yaml=kube_yaml,
            kube_config_path=path,
        )
        insights = _insights_from_snapshot(snapshot)
        inventory = _collect_inventory(
            v1=v1,
            apps=apps,
            batch=batch,
            net=net,
            custom=custom,
            nodes_out=nodes_out,
            namespace=namespace,
        )

        timeseries = _timeseries_from_db(session, cluster.id)
        if metrics_available and not timeseries["cpu_millicores"]:
            total_cpu = sum(nm.get("cpu_millicores", 0) for nm in node_metrics.values())
            total_mem = sum(nm.get("memory_mebibytes", 0) for nm in node_metrics.values())
            timeseries = {
                "cpu_millicores": [{"t": now.isoformat(), "v": round(total_cpu, 2)}],
                "memory_mebibytes": [{"t": now.isoformat(), "v": round(total_mem, 2)}],
            }

        counts = {
            "nodes": len(nodes_out),
            "nodes_ready": ready_count,
            "namespaces": len(namespace_names) if namespace is None else 1,
            "pods": pod_counts["total"],
            "pods_running": pod_counts["running"],
            "pods_pending": pod_counts["pending"],
            "pods_failed": pod_counts["failed"],
            "deployments": dep_count,
        }
        ns_pod_counts = namespace_pod_counts_from_snapshot(snapshot)
        health = compute_cluster_health(
            registration_status=cluster.registration_status,
            counts=counts,
            insights=insights,
            error=None,
            metrics_available=metrics_available,
            namespace_pod_counts=ns_pod_counts,
        )
        k8s_version = _fetch_kubernetes_version(v1)

        return {
            "collected_at": now.isoformat(),
            "kubernetes_version": k8s_version,
            "error": None,
            "counts": counts,
            "resource_counts": resource_counts,
            "inventory": inventory,
            "namespaces": namespace_names,
            "selected_namespace": namespace,
            "nodes": nodes_out,
            "insights": insights,
            "metrics_available": metrics_available,
            "metrics_message": metrics_message,
            "timeseries": timeseries,
            "health": health,
            "namespace_health": health.get("namespace_health") or [],
        }
    except Exception as e:
        _log_scan_failure(cluster, "collect_cluster_summary", e)
        msg = _user_safe_scan_error(cluster, e)
        return {
            **empty_base,
            "namespaces": namespace_names,
            "error": msg,
            "metrics_message": None,
            "health": compute_cluster_health(
                registration_status=cluster.registration_status,
                counts={},
                insights=[],
                error=msg,
                metrics_available=False,
            ),
        }
