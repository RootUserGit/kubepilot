"""Helm command generation and helpers for EKS agent onboarding."""

from __future__ import annotations

import re


def normalize_cluster_name(raw: str) -> str:
    return re.sub(r"\s+", "-", raw.strip())


def _helm_safety_flags() -> str:
    """Helm 3 flags: wait for readiness, roll back on failure, bound install time."""
    return (
        "  --atomic \\\n"
        "  --cleanup-on-fail \\\n"
        "  --timeout 10m"
    )


def _shell_single_quoted(value: str) -> str:
    """Bash-safe single-quoted literal (Helm install commands target sh/bash)."""
    return "'" + value.replace("'", "'\"'\"'") + "'"


def build_helm_install_command(
    *,
    cluster_name: str,
    aws_account_id: str,
    aws_region: str,
    environment: str,
    role_arn: str,
    repo_index_url: str | None = None,
) -> str:
    """Return a multi-line shell command for installing the read-only agent.

    Uses ``helm upgrade --install`` with ``--repo`` so users do not need a prior
    ``helm repo add kubepilot`` (avoids "repo kubepilot not found"). When
    ``repo_index_url`` is omitted, the command embeds a bash parameter expansion
    so operators can ``export KUBEPILOT_HELM_AGENT_REPO_INDEX_URL=...`` once.
    """
    name = normalize_cluster_name(cluster_name).lower()
    acct = aws_account_id.strip()
    region = aws_region.strip()
    env = environment.strip()
    role = role_arn.strip()
    url = (repo_index_url or "").strip()
    if url:
        repo_flag = f" --repo {_shell_single_quoted(url)}"
    else:
        repo_flag = (
            ' --repo "${KUBEPILOT_HELM_AGENT_REPO_INDEX_URL:?'
            "Set KUBEPILOT_HELM_AGENT_REPO_INDEX_URL to your Helm chart index URL "
            "(or set KUBEPILOT_HELM_AGENT_REPO_INDEX_URL on the KubePilot API)}"
            '"'
        )
    return (
        "helm upgrade --install kubepilot-agent kubepilot/kubepilot-agent"
        f"{repo_flag} \\\n"
        "  --namespace kubepilot-system \\\n"
        "  --create-namespace \\\n"
        f"  --set clusterName={name} \\\n"
        f"  --set awsAccountId={acct} \\\n"
        f"  --set awsRegion={region} \\\n"
        f"  --set environment={env} \\\n"
        f"  --set roleArn={role} \\\n"
        f"{_helm_safety_flags()}"
    )


def build_helm_install_command_from_local_chart_dir(
    *,
    cluster_name: str,
    aws_account_id: str,
    aws_region: str,
    environment: str,
    role_arn: str,
    chart_dir: str = "./kubepilot-agent",
) -> str:
    """Helm install using a local chart directory (e.g. after unzipping the bundled chart)."""
    name = normalize_cluster_name(cluster_name).lower()
    acct = aws_account_id.strip()
    region = aws_region.strip()
    env = environment.strip()
    role = role_arn.strip()
    chart = _shell_single_quoted(chart_dir.strip() or "./kubepilot-agent")
    return (
        "# Unzip kubepilot-agent-chart.zip so this directory contains a kubepilot-agent/ folder, then run:\n"
        f"helm upgrade --install kubepilot-agent {chart} \\\n"
        "  --namespace kubepilot-system \\\n"
        "  --create-namespace \\\n"
        f"  --set clusterName={name} \\\n"
        f"  --set awsAccountId={acct} \\\n"
        f"  --set awsRegion={region} \\\n"
        f"  --set environment={env} \\\n"
        f"  --set roleArn={role} \\\n"
        f"{_helm_safety_flags()}"
    )
