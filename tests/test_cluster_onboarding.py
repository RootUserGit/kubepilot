from __future__ import annotations

from kubepilot.core.cluster_onboarding import build_helm_install_command, normalize_cluster_name


def test_normalize_cluster_name_trims_and_hyphenates_spaces() -> None:
    assert normalize_cluster_name("  my cluster ") == "my-cluster"


def test_build_helm_install_command_includes_values() -> None:
    cmd = build_helm_install_command(
        cluster_name="prod-test",
        aws_account_id="123456789012",
        aws_region="ap-south-1",
        environment="production",
        role_arn="arn:aws:iam::123456789012:role/agent",
    )
    assert "helm upgrade --install" in cmd
    assert "--create-namespace" in cmd
    assert "clusterName=prod-test" in cmd
    assert "awsAccountId=123456789012" in cmd
    assert "awsRegion=ap-south-1" in cmd
    assert "environment=production" in cmd
    assert "roleArn=arn:aws:iam::123456789012:role/agent" in cmd
