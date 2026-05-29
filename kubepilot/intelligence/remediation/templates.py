from __future__ import annotations

from typing import Any

from kubepilot.intelligence.schemas import ImpactLevel, RemediationPlanResult, RemediationStep

_READONLY = (
    "KubePilot has read-only access. Review impact below and run commands in your own terminal. "
    "KubePilot will not apply changes."
)

_CHECK_IMPACT: dict[str, tuple[ImpactLevel, str, list[str]]] = {
    "privileged": (
        ImpactLevel.high,
        "Changing privileged mode on node networking components can break cluster networking.",
        ["Test in a non-production cluster first.", "Expect DaemonSet rolling restarts."],
    ),
    "missing_resources": (
        ImpactLevel.low,
        "Updating resources may trigger a rolling restart when pods are recreated.",
        ["Apply during lower traffic if possible."],
    ),
    "missing_probes": (
        ImpactLevel.low,
        "Adding probes can cause restarts if pods fail new health checks.",
        ["Roll out gradually and watch pod events."],
    ),
    "latest_tag": (
        ImpactLevel.medium,
        "Image updates cause rolling restarts and may change application behavior.",
        ["Pin and test the new tag in staging first."],
    ),
    "run_as_root": (
        ImpactLevel.low,
        "Security context changes typically require pod restart.",
        ["Verify the image supports non-root UIDs."],
    ),
}


def fallback_remediation_plan(insight: dict[str, Any]) -> RemediationPlanResult:
    check_id = str(insight.get("check_id") or "")
    ns = insight.get("namespace") or "default"
    kind = insight.get("resource_kind") or "Deployment"
    name = insight.get("resource_name") or "workload"
    disposition = insight.get("disposition") or "actionable"

    if disposition == "accepted_system_requirement":
        return RemediationPlanResult(
            summary="This finding reflects an expected system component requirement.",
            do_not_remediate=True,
            do_not_remediate_reason=insight.get("suppression_reason")
            or "Do not change security posture for this trusted system workload without platform team review.",
            impact_level=ImpactLevel.high,
            impact_summary="Applying generic hardening fixes to this component may break cluster networking.",
            warnings=[
                "Do not set privileged: false on kube-proxy or CNI agents without understanding node networking impact.",
            ],
            steps=[
                RemediationStep(
                    order=1,
                    title="Document accepted risk",
                    description="Record this as an accepted system requirement in your security register.",
                    command_type="manual",
                ),
            ],
            readonly_notice=_READONLY,
        )

    impact_level, impact_summary, warnings = _CHECK_IMPACT.get(
        check_id,
        (ImpactLevel.low, "Changes may require a rolling restart.", ["Review in staging first."]),
    )
    remediation = insight.get("remediation") or "Review workload configuration."
    steps = [
        RemediationStep(
            order=1,
            title="Review finding",
            description=remediation,
            command_type="manual",
        ),
        RemediationStep(
            order=2,
            title="Inspect workload",
            description=f"Inspect the current {kind} configuration in namespace {ns}.",
            command=f"kubectl get {kind.lower()} {name} -n {ns} -o yaml",
            command_type="kubectl",
            verify_command=f"kubectl get {kind.lower()} {name} -n {ns}",
        ),
    ]
    if check_id == "missing_resources":
        cname = insight.get("container_name") or "app"
        patch_json = (
            '{"spec":{"template":{"spec":{"containers":[{"name":"'
            + cname
            + '","resources":{"requests":{"cpu":"100m","memory":"128Mi"},'
            '"limits":{"cpu":"500m","memory":"512Mi"}}}]}}}}'
        )
        steps.append(
            RemediationStep(
                order=3,
                title="Set resource requests and limits",
                description="Add CPU/memory requests and limits to the pod template, then apply.",
                command=f"kubectl patch {kind.lower()} {name} -n {ns} --type=strategic -p '{patch_json}'",
                command_type="kubectl",
                dry_run_command=(
                    f"kubectl patch {kind.lower()} {name} -n {ns} --type=strategic --dry-run=server -p '<patch>'"
                ),
                verify_command=f"kubectl rollout status {kind.lower()}/{name} -n {ns}",
            )
        )

    return RemediationPlanResult(
        summary=remediation,
        steps=steps,
        impact_level=impact_level,
        impact_summary=impact_summary,
        downtime_notes="Typically brief rolling restart per pod.",
        warnings=warnings,
        readonly_notice=_READONLY,
    )
