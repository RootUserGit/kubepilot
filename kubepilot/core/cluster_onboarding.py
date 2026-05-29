"""Helm command generation and helpers for EKS agent onboarding."""

from __future__ import annotations

import re


def normalize_cluster_name(raw: str) -> str:
    return re.sub(r"\s+", "-", raw.strip())


def build_helm_install_command(
    *,
    cluster_name: str,
    aws_account_id: str,
    aws_region: str,
    environment: str,
    role_arn: str,
) -> str:
    """Return a multi-line shell command for installing the read-only agent."""
    name = normalize_cluster_name(cluster_name).lower()
    acct = aws_account_id.strip()
    region = aws_region.strip()
    env = environment.strip()
    role = role_arn.strip()
    return (
        "helm upgrade --install kubepilot-agent kubepilot/kubepilot-agent \\\n"
        "  --namespace kubepilot-system \\\n"
        "  --create-namespace \\\n"
        f"  --set clusterName={name} \\\n"
        f"  --set awsAccountId={acct} \\\n"
        f"  --set awsRegion={region} \\\n"
        f"  --set environment={env} \\\n"
        f"  --set roleArn={role}"
    )
