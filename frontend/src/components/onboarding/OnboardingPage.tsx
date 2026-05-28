"use client";

import Link from "next/link";
import { Check, CheckCircle2, Radio, ShieldCheck, Users } from "lucide-react";
import { CodeTerminal } from "@/components/ui/CodeTerminal";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";

const HELM_COMMAND = `helm install kubepilot-agent kubepilot/kubepilot-agent \\
  --namespace kubepilot-system \\
  --create-namespace \\
  --set clusterName=payments-v2 \\
  --set awsAccountId=123456789012 \\
  --set roleArn=arn:aws:iam::123456789012:role/kubepilot-readonly-agent`;

const prerequisites = [
  <>
    Apply required internal namespace labels (e.g.{" "}
    <code className="kp-inline-code">team-owner: payments</code>).
  </>,
  <>
    Configure cross-account IAM role assumptions if connecting outside{" "}
    <code className="kp-inline-code">ap-south-1</code> EKS context.
  </>,
  <>AWS CLI and Helm 3.x installed locally.</>,
];

export function OnboardingPage() {
  return (
    <div className="kp-grid-bg min-h-full">
      <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
        <PublicPageHeader
          eyebrow="Documentation"
          eyebrowHighlight="Onboarding"
          title="Cluster & Namespace Onboarding Guide"
          description="Follow these steps to onboard your EKS cluster or namespace into KubePilot with a read-only agent."
        />

        <div className="mb-8 rounded-xl border border-kp-blue/30 bg-kp-blue/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-kp-blue-glow" />
              <div>
                <h2 className="font-semibold text-kp-text">AWS EKS onboarding wizard</h2>
                <p className="mt-1 text-sm text-kp-muted">
                  Connect via IAM Role (recommended) or IAM User, verify with{" "}
                  <code className="kp-inline-code">eks:DescribeCluster</code>, then install the agent.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/clusters/register"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-kp-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-kp-blue/90"
            >
              Start AWS onboarding
            </Link>
          </div>
        </div>

        <div className="space-y-8">
          <StepCard
            step={1}
            title="Prerequisites"
            description="Complete these requirements before deploying the read-only agent."
          >
            <ul className="space-y-3">
              {prerequisites.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-kp-muted">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-kp-green/40 bg-kp-green/10">
                    <Check className="h-3 w-3 text-kp-green" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </StepCard>

          <StepCard
            step={2}
            title="Deploy KubePilot Read-Only Agent"
            description="Install the agent Helm chart in your cluster. Replace placeholder values with your cluster name, account ID, and IRSA role ARN."
          >
            <CodeTerminal code={HELM_COMMAND} title="bash — install agent" language="shell" />
            <p className="mt-3 text-xs text-kp-muted">
              The agent uses IRSA with a ClusterRole limited to{" "}
              <code className="kp-inline-code">get</code>,{" "}
              <code className="kp-inline-code">list</code>, and{" "}
              <code className="kp-inline-code">watch</code> verbs only.
            </p>
          </StepCard>

          <StepCard
            step={3}
            title="Verification & Connection"
            description="After install, the agent establishes a secure read-only connection to the KubePilot control plane."
          >
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-kp-border bg-kp-bg-deep p-6">
              <VerificationStep label="payments-v2 Cluster" active />
              <div className="hidden h-px flex-1 border-t border-dashed border-kp-border sm:block" />
              <VerificationStep label="Sending Ping…" icon={<Radio className="h-5 w-5" />} />
              <div className="hidden h-px flex-1 border-t border-dashed border-kp-border sm:block" />
              <VerificationStep label="Verifying… 73%" progress />
              <div className="hidden h-px flex-1 border-t border-dashed border-kp-border sm:block" />
              <VerificationStep label="Verified ✓" done />
            </div>

            <div className="mt-4 rounded-lg border border-kp-green/30 bg-kp-green/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-kp-green" />
                <p className="text-sm leading-relaxed text-kp-text">
                  Cluster <code className="kp-inline-code">payments-v2</code> is connected to the
                  control plane. View insights, logs, metrics, and cost data in the dashboard.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-kp-border bg-kp-surface-elevated/50 p-4">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-kp-blue-glow" />
              <p className="text-sm leading-relaxed text-kp-muted">
                Need help?{" "}
                <Link href="/contact" className="font-medium text-kp-blue-glow hover:underline">
                  Contact the platform team
                </Link>{" "}
                or reach #platform-support on Slack.
              </p>
            </div>
          </StepCard>
        </div>

        <div className="mt-10 flex items-start gap-3 rounded-xl border border-kp-border bg-kp-surface/50 px-4 py-3.5 text-sm text-kp-muted">
          <span className="text-kp-blue-glow" aria-hidden>
            ℹ
          </span>
          <p>
            Standard <span className="font-semibold text-kp-green">read-only</span> connection
            limits apply. KubePilot never performs create, update, patch, or delete operations on
            your cluster.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="kp-card">
      <div className="flex items-start gap-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-kp-blue text-sm font-bold text-white shadow-sm"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="kp-section-title">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-kp-muted">{description}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </article>
  );
}

function VerificationStep({
  label,
  icon,
  active,
  progress,
  done,
}: {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  progress?: boolean;
  done?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border ${
          done
            ? "border-kp-green bg-kp-green/20 text-kp-green"
            : active
              ? "border-kp-blue bg-kp-blue/20 text-kp-blue-glow kp-pulse"
              : "border-kp-border bg-kp-surface text-kp-muted"
        }`}
      >
        {done ? <Check className="h-5 w-5" /> : icon ?? <span className="text-lg">⎈</span>}
      </div>
      {progress && (
        <div
          className="h-8 w-8 rounded-full border-2 border-kp-blue border-t-transparent animate-spin"
          aria-hidden
        />
      )}
      <span className="max-w-[7rem] text-xs font-medium text-kp-muted">{label}</span>
    </div>
  );
}
