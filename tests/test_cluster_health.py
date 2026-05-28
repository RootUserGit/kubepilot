from kubepilot.core.cluster_health import compute_cluster_health, compute_namespace_health


def test_health_score_healthy():
    h = compute_cluster_health(
        registration_status="connected",
        counts={"nodes": 1, "nodes_ready": 1, "pods": 10, "pods_running": 10, "pods_failed": 0},
        insights=[],
        error=None,
        metrics_available=True,
    )
    assert h["health_score"] >= 85
    assert h["health_status"] == "healthy"


def test_health_score_drops_with_critical():
    h = compute_cluster_health(
        registration_status="connected",
        counts={"nodes": 1, "nodes_ready": 1, "pods": 5, "pods_running": 5, "pods_failed": 0},
        insights=[{"severity": "critical"}, {"severity": "high"}],
        error=None,
        metrics_available=True,
    )
    assert h["health_score"] is not None
    assert h["health_score"] < 85
    assert h["critical_count"] == 1
    assert h["high_count"] == 1


def test_hybrid_namespace_health_and_worst():
    insights = [
        {"severity": "high", "effective_severity": "high", "namespace": "bad-ns", "disposition": "actionable"},
        {"severity": "info", "effective_severity": "info", "namespace": "kube-system", "disposition": "actionable"},
    ]
    ns_counts = {"bad-ns": 10, "kube-system": 2}
    h = compute_cluster_health(
        registration_status="connected",
        counts={"nodes": 1, "nodes_ready": 1, "pods": 12, "pods_running": 12, "pods_failed": 0},
        insights=insights,
        error=None,
        metrics_available=True,
        namespace_pod_counts=ns_counts,
    )
    assert h["aggregation_method"] == "hybrid"
    assert len(h["namespace_health"]) == 2
    assert h["namespace_health"][0]["namespace"] == "bad-ns"
    assert h["worst_namespace"]["name"] == "bad-ns"


def test_accepted_risk_uses_effective_severity_for_counts():
    h = compute_cluster_health(
        registration_status="connected",
        counts={"nodes": 1, "nodes_ready": 1, "pods": 1, "pods_running": 1, "pods_failed": 0},
        insights=[
            {
                "severity": "info",
                "effective_severity": "info",
                "namespace": "kube-system",
                "disposition": "accepted_system_requirement",
            }
        ],
        error=None,
        metrics_available=True,
        namespace_pod_counts={"kube-system": 1},
    )
    assert h["high_count"] == 0
    assert h["health_score"] is not None
    assert h["health_score"] >= 65


def test_compute_namespace_health_sorted_unhealthiest_first():
    rows = compute_namespace_health(
        [
            {"severity": "low", "namespace": "good"},
            {"severity": "critical", "namespace": "bad"},
        ],
        {"good": 5, "bad": 3},
    )
    assert rows[0]["namespace"] == "bad"
    assert rows[0]["health_score"] < rows[1]["health_score"]
