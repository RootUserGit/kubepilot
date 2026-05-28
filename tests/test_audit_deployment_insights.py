from kubepilot.core.audit_rules import evaluate_workload_snapshot


def test_insights_roll_up_to_deployment():
    snap = {
        "pods": [
            {
                "name": "pod-a",
                "namespace": "kube-system",
                "workload": {"kind": "Deployment", "name": "kube-proxy", "namespace": "kube-system"},
                "containers": [
                    {
                        "name": "kube-proxy",
                        "image": "registry.k8s.io/kube-proxy:latest",
                        "security_context": {"privileged": True},
                        "resources": {},
                        "liveness_probe": False,
                        "readiness_probe": False,
                    }
                ],
            },
            {
                "name": "pod-b",
                "namespace": "kube-system",
                "workload": {"kind": "Deployment", "name": "kube-proxy", "namespace": "kube-system"},
                "containers": [
                    {
                        "name": "kube-proxy",
                        "image": "registry.k8s.io/kube-proxy:latest",
                        "security_context": {"privileged": True},
                        "resources": {},
                        "liveness_probe": False,
                        "readiness_probe": False,
                    }
                ],
            },
        ]
    }
    findings = evaluate_workload_snapshot(snap)
    privileged = [f for f in findings if f.check_id == "privileged"]
    assert len(privileged) == 1
    assert privileged[0].resource_kind == "Deployment"
    assert privileged[0].resource_name == "kube-proxy"
    assert set(privileged[0].related_pods) == {"pod-a", "pod-b"}
