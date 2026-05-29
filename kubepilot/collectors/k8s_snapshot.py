from __future__ import annotations

import logging
import os
import tempfile
from typing import Any

from kubernetes import client, config

logger = logging.getLogger(__name__)


def _runtime_fields_for_container(pod: Any, container_name: str) -> dict[str, Any]:
    """Merge ContainerStatus (restart counts, last termination) for workload containers."""
    if not pod.status:
        return {
            "restart_count": 0,
            "last_exit_code": None,
            "last_termination_reason": None,
        }
    for cs in pod.status.container_statuses or []:
        if cs.name != container_name:
            continue
        rc = int(getattr(cs, "restart_count", None) or 0)
        exit_code = None
        reason = None
        if cs.state:
            if cs.state.terminated:
                exit_code = cs.state.terminated.exit_code
                reason = cs.state.terminated.reason
            elif cs.state.waiting and getattr(cs.state.waiting, "reason", None):
                reason = cs.state.waiting.reason
        return {
            "restart_count": rc,
            "last_exit_code": exit_code,
            "last_termination_reason": reason,
        }
    return {
        "restart_count": 0,
        "last_exit_code": None,
        "last_termination_reason": None,
    }


def _load_kubeconfig_from_string(yaml_str: str) -> None:
    fd, path = tempfile.mkstemp(suffix=".yaml")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(yaml_str)
        config.load_kube_config(config_file=path)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def load_kube_config(
    *,
    kubeconfig_yaml: str | None = None,
    kube_config_path: str | None = None,
) -> None:
    """Load client config for out-of-cluster, in-cluster, or per-cluster kubeconfig."""
    if kubeconfig_yaml:
        _load_kubeconfig_from_string(kubeconfig_yaml)
        logger.info("Loaded Kubernetes config from registered cluster kubeconfig")
        return
    if kube_config_path:
        config.load_kube_config(config_file=kube_config_path)
        logger.info("Loaded Kubernetes config from path %s", kube_config_path)
        return
    try:
        config.load_incluster_config()
        logger.info("Loaded in-cluster kubeconfig")
    except config.ConfigException:
        config.load_kube_config()
        logger.info("Loaded default kubeconfig (e.g. ~/.kube/config)")


def collect_snapshot(
    namespace: str | None = None,
    namespaces: list[str] | None = None,
    label_selector: str | None = None,
    kubeconfig_yaml: str | None = None,
    kube_config_path: str | None = None,
) -> dict[str, Any]:
    """Collect workload snapshot. If ``namespaces`` is a non-empty list, restrict to those
    namespaces. If ``namespaces`` is None and ``namespace`` is set, restrict to that single
    namespace (legacy). If both are unset, include all namespaces.
    """
    load_kube_config(
        kubeconfig_yaml=kubeconfig_yaml,
        kube_config_path=kube_config_path,
    )
    v1 = client.CoreV1Api()
    apps = client.AppsV1Api()

    ns_allow: set[str] | None
    if namespaces:
        ns_allow = set(namespaces)
    elif namespace:
        ns_allow = {namespace}
    else:
        ns_allow = None

    rs_to_deployment: dict[tuple[str, str], tuple[str, str]] = {}
    for rs in apps.list_replica_set_for_all_namespaces(watch=False).items:
        if ns_allow is not None and rs.metadata.namespace not in ns_allow:
            continue
        for owner in rs.metadata.owner_references or []:
            if owner.kind == "Deployment" and owner.name:
                rs_to_deployment[(rs.metadata.namespace, rs.metadata.name)] = (
                    rs.metadata.namespace,
                    owner.name,
                )

    def _pod_workload(pod: Any) -> dict[str, str]:
        ns = pod.metadata.namespace or "default"
        for ref in pod.metadata.owner_references or []:
            if ref.kind == "ReplicaSet" and ref.name:
                dep = rs_to_deployment.get((ns, ref.name))
                if dep:
                    return {"kind": "Deployment", "name": dep[1], "namespace": dep[0]}
            if ref.kind == "StatefulSet" and ref.name:
                return {"kind": "StatefulSet", "name": ref.name, "namespace": ns}
            if ref.kind == "DaemonSet" and ref.name:
                return {"kind": "DaemonSet", "name": ref.name, "namespace": ns}
            if ref.kind == "Job" and ref.name:
                return {"kind": "Job", "name": ref.name, "namespace": ns}
        return {"kind": "Pod", "name": pod.metadata.name or "unknown", "namespace": ns}

    snapshot: dict[str, Any] = {
        "pods": [],
        "deployments": [],
        "namespace_filter": sorted(ns_allow) if ns_allow is not None else None,
    }

    pods = v1.list_pod_for_all_namespaces(
        watch=False,
        label_selector=label_selector or "",
    )
    for pod in pods.items:
        if ns_allow is not None and pod.metadata.namespace not in ns_allow:
            continue
        containers_out = []
        for c in pod.spec.containers:
            sec = c.security_context
            sec_dict = {}
            if sec:
                sec_dict = {
                    "privileged": getattr(sec, "privileged", None),
                    "run_as_user": getattr(sec, "run_as_user", None),
                    "run_as_root": getattr(sec, "run_as_user", None) == 0,
                }
            resources = {}
            if c.resources:
                resources = {
                    "requests": dict(c.resources.requests or {}),
                    "limits": dict(c.resources.limits or {}),
                }
            probes = {
                "liveness_probe": bool(c.liveness_probe),
                "readiness_probe": bool(c.readiness_probe),
            }
            rt = _runtime_fields_for_container(pod, c.name)
            containers_out.append(
                {
                    "name": c.name,
                    "image": c.image,
                    "security_context": sec_dict,
                    "resources": resources,
                    **probes,
                    **rt,
                }
            )
        snapshot["pods"].append(
            {
                "name": pod.metadata.name,
                "namespace": pod.metadata.namespace,
                "workload": _pod_workload(pod),
                "containers": containers_out,
            }
        )

    deps = apps.list_deployment_for_all_namespaces(watch=False)
    for d in deps.items:
        if ns_allow is not None and d.metadata.namespace not in ns_allow:
            continue
        snapshot["deployments"].append(
            {
                "name": d.metadata.name,
                "namespace": d.metadata.namespace,
                "replicas": d.spec.replicas,
            }
        )

    return snapshot
