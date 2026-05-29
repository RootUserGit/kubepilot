from __future__ import annotations

from kubepilot.core.summary_namespace_filter import filter_summary_by_namespace


def test_filter_summary_by_namespace_from_full_scan() -> None:
    full = {
        "collected_at": "2026-05-28T00:00:00+00:00",
        "error": None,
        "counts": {"nodes": 1, "nodes_ready": 1, "namespaces": 3, "pods": 10},
        "insights": [
            {"id": "a", "namespace": "kube-system", "severity": "high", "title": "x"},
            {"id": "b", "namespace": "default", "severity": "low", "title": "y"},
        ],
        "inventory": {
            "nodes": [{"name": "minikube", "namespace": None, "status": "Ready"}],
            "pods": [
                {"name": "p1", "namespace": "kube-system", "status": "Running"},
                {"name": "p2", "namespace": "default", "status": "Running"},
            ],
            "deployments": [
                {"name": "coredns", "namespace": "kube-system", "status": "1/1"},
            ],
        },
        "resource_counts": [{"kind": "pods", "label": "Pods", "count": 10}],
        "metrics_available": False,
        "health": {
            "health_score": 62,
            "health_status": "degraded",
            "health_label": "Degraded",
            "summary": "ok",
            "critical_count": 0,
            "high_count": 1,
            "medium_count": 0,
            "low_count": 1,
        },
    }
    filtered = filter_summary_by_namespace(full, "kube-system")
    assert filtered["filtered_from_all_namespaces"] is True
    assert filtered["selected_namespace"] == "kube-system"
    assert len(filtered["insights"]) == 1
    assert filtered["insights"][0]["id"] == "a"
    assert filtered["counts"]["pods"] == 1
    assert len(filtered["inventory"]["pods"]) == 1
    assert len(filtered["inventory"]["nodes"]) == 1
