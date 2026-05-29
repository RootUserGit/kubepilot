from kubepilot.core.audit_rules import evaluate_workload_snapshot


def test_audit_privileged_container():
    snap = {
        "pods": [
            {
                "name": "p1",
                "namespace": "ns",
                "containers": [
                    {
                        "name": "c1",
                        "image": "nginx:latest",
                        "security_context": {"privileged": True},
                        "resources": {},
                        "liveness_probe": True,
                        "readiness_probe": True,
                    }
                ],
            }
        ]
    }
    findings = evaluate_workload_snapshot(snap)
    assert any("Privileged" in f.title for f in findings)
