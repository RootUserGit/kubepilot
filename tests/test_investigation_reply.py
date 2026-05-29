from datetime import UTC, datetime
from uuid import uuid4

from kubepilot.core.schemas import Recommendation, RecommendationCategory, RecommendationSeverity
from kubepilot.worker.investigation_reply import (
    build_investigation_reply,
    format_namespace_utilization,
    restart_context_for_llm,
)


def test_restart_context_lists_lines():
    snap = {
        "pods": [
            {
                "namespace": "dev",
                "name": "p1",
                "containers": [
                    {
                        "name": "c",
                        "restart_count": 2,
                        "last_exit_code": 137,
                        "last_termination_reason": "OOMKilled",
                    }
                ],
            }
        ]
    }
    ctx = restart_context_for_llm(snap)
    assert "dev/p1" in ctx
    assert "OOMKilled" in ctx


def test_namespace_utilization_aggregate():
    samples = [
        {
            "namespace": "dev",
            "workload": "pod-a",
            "container": "x",
            "cpu_millicores": 100.0,
            "memory_mebibytes": 64.0,
        },
        {
            "namespace": "dev",
            "workload": "pod-a",
            "container": "y",
            "cpu_millicores": 50.0,
            "memory_mebibytes": 32.0,
        },
        {
            "namespace": "kube-system",
            "workload": "coredns",
            "container": "c",
            "cpu_millicores": 10.0,
            "memory_mebibytes": 128.0,
        },
    ]
    text = format_namespace_utilization(samples)
    assert "dev" in text
    assert "kube-system" in text
    assert "150m" in text or "150" in text


def test_build_reply_structure_without_llm():
    snap = {"pods": []}
    recs = [
        Recommendation(
            id=uuid4(),
            category=RecommendationCategory.reliability,
            severity=RecommendationSeverity.low,
            title="Missing probes",
            detail=None,
            evidence=[],
            created_at=datetime.now(tz=UTC),
        )
    ]
    llm = {"summary": "stub", "note": "LLM disabled"}
    text = build_investigation_reply(
        "Why restart?",
        snap,
        recs,
        llm,
        llm_configured=False,
        metrics_samples=[],
    )
    assert "### Pod restarts" in text
    assert "### CPU and memory utilization" in text
    assert "### Configuration checks" in text
    assert "### Assistant narrative" in text
    assert "metrics-server" in text.lower() or "metrics" in text.lower()
