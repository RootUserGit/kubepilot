from __future__ import annotations

from kubepilot.core.cluster_onboarding import (
    build_helm_install_command,
    build_helm_install_command_from_local_chart_dir,
    normalize_cluster_name,
)


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
    assert "--repo" in cmd
    assert "KUBEPILOT_HELM_AGENT_REPO_INDEX_URL" in cmd
    assert "--create-namespace" in cmd
    assert "clusterName=prod-test" in cmd
    assert "awsAccountId=123456789012" in cmd
    assert "awsRegion=ap-south-1" in cmd
    assert "environment=production" in cmd
    assert "roleArn=arn:aws:iam::123456789012:role/agent" in cmd
    assert "--atomic" in cmd
    assert "--cleanup-on-fail" in cmd
    assert "--timeout 10m" in cmd


def test_build_helm_install_command_from_local_uses_chart_path() -> None:
    cmd = build_helm_install_command_from_local_chart_dir(
        cluster_name="c",
        aws_account_id="123456789012",
        aws_region="us-east-1",
        environment="dev",
        role_arn="arn:aws:iam::123456789012:role/agent",
        chart_dir="./kubepilot-agent",
    )
    assert "helm upgrade --install kubepilot-agent './kubepilot-agent'" in cmd
    assert "Unzip kubepilot-agent-chart.zip" in cmd
    assert "--create-namespace" in cmd
    assert "--atomic" in cmd


def test_build_helm_install_command_embeds_repo_url() -> None:
    cmd = build_helm_install_command(
        cluster_name="c",
        aws_account_id="1",
        aws_region="us-east-1",
        environment="dev",
        role_arn="arn:aws:iam::1:role/r",
        repo_index_url="https://charts.example.com/helm/",
    )
    assert "--repo 'https://charts.example.com/helm/'" in cmd
    assert "KUBEPILOT_HELM_AGENT_REPO_INDEX_URL" not in cmd
