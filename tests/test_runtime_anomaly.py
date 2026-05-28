from unittest.mock import patch

from kubepilot.collectors.runtime_anomaly import detect_runtime_anomalies


def test_privileged_high_cpu_escalates_to_critical():
    snapshot = {
        "pods": [
            {
                "name": "fake-crypto-miner",
                "namespace": "dev",
                "workload": {"kind": "Pod", "name": "fake-crypto-miner", "namespace": "dev"},
                "containers": [{"security_context": {"privileged": True}}],
            },
            {
                "name": "quiet",
                "namespace": "default",
                "workload": {"kind": "Pod", "name": "quiet", "namespace": "default"},
                "containers": [{"security_context": {}}],
            },
        ]
    }
    pod_cpu = {("dev", "fake-crypto-miner"): 1600.0, ("default", "quiet"): 20.0}

    with patch(
        "kubepilot.collectors.runtime_anomaly._fetch_pod_cpu_by_key",
        return_value=pod_cpu,
    ):
        findings = detect_runtime_anomalies(snapshot)

    assert len(findings) >= 1
    critical = [f for f in findings if f["severity"] == "critical"]
    assert critical
    assert critical[0]["finding_type"] == "behavioral"
    assert "T1496" in critical[0]["attack_techniques"]
