from kubepilot.core.audit_rules import AuditFinding, evaluate_workload_snapshot
from kubepilot.core.finding_exceptions import apply_finding_exceptions
from kubepilot.core.schemas import RecommendationCategory, RecommendationSeverity


def _kube_proxy_snapshot() -> dict:
    return {
        "pods": [
            {
                "name": "kube-proxy-abc",
                "namespace": "kube-system",
                "workload": {"kind": "DaemonSet", "name": "kube-proxy", "namespace": "kube-system"},
                "containers": [
                    {
                        "name": "kube-proxy",
                        "image": "registry.k8s.io/kube-proxy:v1.29.0",
                        "security_context": {"privileged": True},
                    }
                ],
            }
        ]
    }


def test_kube_proxy_privileged_downgraded():
    findings = evaluate_workload_snapshot(_kube_proxy_snapshot())
    privileged = [f for f in findings if f.check_id == "privileged"]
    assert len(privileged) == 1
    enriched = apply_finding_exceptions(privileged[0])
    assert enriched.raw_severity == "high"
    assert enriched.effective_severity == "info"
    assert enriched.disposition == "accepted_system_requirement"
    assert enriched.suppression_reason
    assert len(enriched.references) >= 1


def test_user_workload_privileged_stays_actionable():
    finding = AuditFinding(
        category=RecommendationCategory.security,
        severity=RecommendationSeverity.high,
        title="Privileged container",
        detail="x",
        evidence_key="k",
        resource_kind="Deployment",
        resource_name="nginx",
        namespace="default",
        check_id="privileged",
    )
    enriched = apply_finding_exceptions(finding)
    assert enriched.disposition == "actionable"
    assert enriched.effective_severity == "high"
