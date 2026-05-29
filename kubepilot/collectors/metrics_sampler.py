from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from kubernetes import client

from kubepilot.collectors.k8s_snapshot import load_kube_config

logger = logging.getLogger(__name__)


def collect_metrics_samples(
    cluster_id: Any = None,
    kubeconfig_yaml: str | None = None,
    kube_config_path: str | None = None,
    namespace_allowlist: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Sample pod container usage via Kubernetes metrics API (metrics-server)."""
    load_kube_config(
        kubeconfig_yaml=kubeconfig_yaml,
        kube_config_path=kube_config_path,
    )
    api = client.CustomObjectsApi()
    out: list[dict[str, Any]] = []
    try:
        metrics = api.list_cluster_custom_object(
            group="metrics.k8s.io",
            version="v1beta1",
            plural="pods",
        )
    except Exception as e:
        logger.warning("metrics API unavailable: %s", e)
        return out

    now = datetime.now(tz=UTC)
    for item in metrics.get("items", []):
        meta = item.get("metadata", {})
        ns = meta.get("namespace")
        name = meta.get("name")
        if namespace_allowlist is not None and ns not in namespace_allowlist:
            continue
        for c in item.get("containers", []):
            usage = c.get("usage", {})
            cpu = usage.get("cpu", "0")
            mem = usage.get("memory", "0")
            cpu_m = _parse_cpu_millicores(cpu)
            mem_m = _parse_memory_mebibytes(mem)
            out.append(
                {
                    "namespace": ns,
                    "workload": name,
                    "container": c.get("name"),
                    "cpu_millicores": cpu_m,
                    "memory_mebibytes": mem_m,
                    "collected_at": now,
                    "cluster_id": cluster_id,
                }
            )
    return out


def _parse_cpu_millicores(cpu: str) -> float:
    if not cpu:
        return 0.0
    if cpu.endswith("n"):
        return float(cpu[:-1]) / 1e6
    if cpu.endswith("u"):
        return float(cpu[:-1]) / 1000.0
    if cpu.endswith("m"):
        return float(cpu[:-1])
    return float(cpu) * 1000.0


def _parse_memory_mebibytes(mem: str) -> float:
    if mem.endswith("Ki"):
        return float(mem[:-2]) / 1024.0
    if mem.endswith("Mi"):
        return float(mem[:-2])
    if mem.endswith("Gi"):
        return float(mem[:-2]) * 1024.0
    return float(mem)
