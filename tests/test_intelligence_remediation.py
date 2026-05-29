from kubepilot.core.settings import Settings
from kubepilot.intelligence.remediation.templates import fallback_remediation_plan


def test_fallback_do_not_remediate_kube_proxy():
    insight = {
        "check_id": "privileged",
        "namespace": "kube-system",
        "resource_kind": "DaemonSet",
        "resource_name": "kube-proxy",
        "disposition": "accepted_system_requirement",
        "suppression_reason": "iptables required",
    }
    plan = fallback_remediation_plan(insight)
    assert plan.do_not_remediate is True
    assert plan.impact_level.value == "high"
    assert any("privileged" in w.lower() for w in plan.warnings)


def test_fallback_missing_resources_has_patch_step():
    insight = {
        "check_id": "missing_resources",
        "namespace": "app",
        "resource_kind": "Deployment",
        "resource_name": "api",
        "container_name": "api",
        "remediation": "Set limits",
        "disposition": "actionable",
    }
    plan = fallback_remediation_plan(insight)
    assert not plan.do_not_remediate
    assert len(plan.steps) >= 2
    assert any(s.command and "kubectl patch" in s.command for s in plan.steps)


def test_intelligence_service_remediate_without_llm():
    from kubepilot.intelligence import IntelligenceService

    settings = Settings(llm_enabled=False, llm_endpoint=None)
    svc = IntelligenceService(settings)
    plan = svc.remediate(
        {
            "id": "abc",
            "check_id": "missing_probes",
            "namespace": "default",
            "resource_kind": "Deployment",
            "resource_name": "web",
            "remediation": "Add probes",
            "disposition": "actionable",
        },
        "test-cluster",
    )
    assert plan.readonly_notice
    assert len(plan.steps) >= 1
