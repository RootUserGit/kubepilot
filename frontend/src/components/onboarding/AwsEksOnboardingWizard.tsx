"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  type AwsConnectionType,
  type VerifyAwsSuccessResponse,
  cloudFormationTemplateDownloadUrl,
  fetchCloudFormationLaunch,
  fetchOnboardingExternalId,
  verifyAwsConnection,
} from "@/lib/api";

const AWS_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
] as const;

const inputBase =
  "w-full rounded-lg border bg-kp-bg-deep px-3 py-2.5 text-sm text-kp-text placeholder:text-kp-muted/50 transition-[border-color,box-shadow] outline-none focus:ring-2 focus:ring-kp-blue/25";
const inputOk = "border-kp-border focus:border-kp-blue";
const inputErr = "border-red-500/70 focus:border-red-500 focus:ring-red-500/20";

export type AwsOnboardingValues = {
  connectionType: AwsConnectionType;
  awsRegion: string;
  clusterName: string;
  roleArn: string;
  awsAccountId: string;
  externalId: string;
};

type Props = {
  onVerified: (result: VerifyAwsSuccessResponse, values: AwsOnboardingValues) => void;
  verified: boolean;
};

export function AwsEksOnboardingWizard({ onVerified, verified }: Props) {
  const formId = useId();
  const [connectionType, setConnectionType] = useState<AwsConnectionType>("iam_role");
  const [externalId, setExternalId] = useState("");
  const [awsRegion, setAwsRegion] = useState<string>("us-east-1");
  const [clusterName, setClusterName] = useState("");
  const [roleArn, setRoleArn] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  const [cfLaunchUrl, setCfLaunchUrl] = useState<string | null>(null);
  const [cfNote, setCfNote] = useState<string | null>(null);
  const [kubepilotAccountId, setKubepilotAccountId] = useState("787943461725");
  const [loadingExternalId, setLoadingExternalId] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedExternalId, setCopiedExternalId] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refreshExternalId = useCallback(async () => {
    setLoadingExternalId(true);
    setError(null);
    try {
      const { external_id } = await fetchOnboardingExternalId();
      setExternalId(external_id);
      const launch = await fetchCloudFormationLaunch(awsRegion, external_id);
      setCfLaunchUrl(launch.cloudformation_quick_create_url);
      setCfNote(launch.setup_note);
      setKubepilotAccountId(launch.kubepilot_aws_account_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load onboarding metadata");
    } finally {
      setLoadingExternalId(false);
    }
  }, [awsRegion]);

  useEffect(() => {
    if (connectionType !== "iam_role" || externalId) return;
    void refreshExternalId();
  }, [connectionType, externalId, refreshExternalId]);

  useEffect(() => {
    if (connectionType !== "iam_role" || !externalId) return;
    let cancelled = false;
    void fetchCloudFormationLaunch(awsRegion, externalId)
      .then((launch) => {
        if (cancelled) return;
        setCfLaunchUrl(launch.cloudformation_quick_create_url);
        setCfNote(launch.setup_note);
        setKubepilotAccountId(launch.kubepilot_aws_account_id);
      })
      .catch(() => {
        if (!cancelled) setCfLaunchUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [awsRegion, connectionType, externalId]);

  async function copyExternalId() {
    if (!externalId) return;
    await navigator.clipboard.writeText(externalId);
    setCopiedExternalId(true);
    setTimeout(() => setCopiedExternalId(false), 2000);
  }

  async function handleVerify() {
    setError(null);
    setSuccessMessage(null);
    const name = clusterName.trim().toLowerCase();
    if (!name) {
      setError("EKS cluster name is required.");
      return;
    }
    if (!awsRegion) {
      setError("AWS region is required.");
      return;
    }

    setVerifying(true);
    try {
      let result: VerifyAwsSuccessResponse;
      if (connectionType === "iam_role") {
        if (!externalId) {
          setError("External ID is missing. Refresh the External ID field.");
          return;
        }
        if (!roleArn.trim()) {
          setError("Role ARN is required for IAM Role authorization.");
          return;
        }
        result = await verifyAwsConnection({
          connection_type: "iam_role",
          aws_region: awsRegion,
          cluster_name: name,
          role_arn: roleArn.trim(),
          external_id: externalId,
        });
      } else {
        if (!accessKeyId.trim() || !secretAccessKey.trim()) {
          setError("Access Key ID and Secret Access Key are required.");
          return;
        }
        result = await verifyAwsConnection({
          connection_type: "iam_user",
          aws_region: awsRegion,
          cluster_name: name,
          aws_access_key_id: accessKeyId.trim(),
          aws_secret_access_key: secretAccessKey,
          aws_session_token: sessionToken.trim() || null,
        });
      }

      const values: AwsOnboardingValues = {
        connectionType,
        awsRegion: result.aws_region || awsRegion,
        clusterName: result.cluster_name || name,
        roleArn: roleArn.trim(),
        awsAccountId: result.aws_account_id,
        externalId,
      };
      setSuccessMessage(
        `Connected to ${result.cluster_name} (${result.cluster_arn}). You can complete registration below.`,
      );
      onVerified(result, values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AWS verification failed");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <section
      className="space-y-6 rounded-2xl border border-kp-border bg-kp-surface/50 p-5 sm:p-8"
      aria-labelledby={`${formId}-title`}
    >
      <div>
        <h2 id={`${formId}-title`} className="text-lg font-semibold text-kp-text sm:text-xl">
          Onboard your AWS EKS Cluster
        </h2>
        <p className="mt-1.5 text-sm text-kp-muted">
          Choose how KubePilot verifies read-only access to your EKS API before agent installation.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <ConnectionOption
          active={connectionType === "iam_role"}
          onClick={() => setConnectionType("iam_role")}
          title="Option A: IAM Role"
          badge="Recommended"
          description="Secure cross-account access via AWS IAM Role. No static credentials stored."
          icon={<ShieldCheck className="h-5 w-5 text-kp-green" />}
        />
        <ConnectionOption
          active={connectionType === "iam_user"}
          onClick={() => setConnectionType("iam_user")}
          title="Option B: IAM User"
          description="Static access keys. Use a tightly scoped read-only IAM user."
          icon={<KeyRound className="h-5 w-5 text-amber-400" />}
        />
      </div>

      {connectionType === "iam_role" ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-kp-green/25 bg-kp-green/5 p-4">
            <p className="text-sm font-medium text-kp-text">
              Secure, Cross-Account Access via AWS IAM Role (Recommended)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-kp-muted">
              Grant KubePilot temporary access to read cluster metrics using AWS best practices. No
              static credentials are stored.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kp-muted">
              Step 1 — Copy your unique External ID
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={externalId}
                placeholder={loadingExternalId ? "Generating…" : ""}
                className={`${inputBase} font-mono text-xs ${inputOk}`}
                aria-label="External ID"
              />
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void copyExternalId()}
                  disabled={!externalId}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-kp-border px-3 py-2 text-xs font-medium text-kp-muted hover:text-kp-text disabled:opacity-50"
                >
                  {copiedExternalId ? <Check className="h-3.5 w-3.5 text-kp-green" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => void refreshExternalId()}
                  disabled={loadingExternalId}
                  className="rounded-lg border border-kp-border px-3 py-2 text-xs text-kp-muted hover:text-kp-text disabled:opacity-50"
                >
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kp-muted">
              Step 2 — Deploy the read-only template
            </p>
            <p className="mb-3 text-xs text-kp-muted">
              Launch CloudFormation with the External ID from Step 1. The stack trusts KubePilot
              AWS account{" "}
              <code className="rounded bg-kp-surface px-1 py-0.5 font-mono text-kp-green">
                {kubepilotAccountId}
              </code>{" "}
              (<code className="font-mono text-[10px]">arn:aws:iam::{kubepilotAccountId}:root</code>
              ). Or download the YAML for CLI deployment.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {cfLaunchUrl ? (
                <a
                  href={cfLaunchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-kp-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-kp-blue/90"
                >
                  Launch CloudFormation Stack
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <span className="inline-flex items-center rounded-lg border border-kp-border bg-kp-bg-deep px-4 py-2.5 text-xs text-kp-muted">
                  Quick-create unavailable — use template download
                </span>
              )}
              <a
                href={cloudFormationTemplateDownloadUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-kp-border px-4 py-2.5 text-sm text-kp-muted hover:text-kp-text"
              >
                Download YAML template
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {cfNote && (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-600 dark:text-amber-300">{cfNote}</p>
            )}
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-kp-muted">
              Step 3 — Enter output details
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs text-kp-muted">AWS Region</span>
                <select
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                  className={`${inputBase} ${inputOk}`}
                >
                  {AWS_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-kp-muted">EKS Cluster Name</span>
                <input
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value.toLowerCase())}
                  placeholder="production-core-cluster"
                  className={`${inputBase} ${inputOk}`}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs text-kp-muted">Role ARN</span>
                <input
                  value={roleArn}
                  onChange={(e) => setRoleArn(e.target.value)}
                  placeholder="arn:aws:iam::123456789012:role/KubePilot-ReadOnly-Role"
                  spellCheck={false}
                  className={`${inputBase} font-mono text-xs ${inputOk}`}
                />
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-kp-text">Static IAM User Credentials</p>
            <p className="mt-1 text-xs leading-relaxed text-kp-muted">
              Security warning: ensure this IAM user is restricted to read-only EKS and EC2 describe
              permissions. Keys are used only for verification and are not stored by KubePilot.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-kp-muted">
              Step 1 — Account credentials
            </p>
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs text-kp-muted">AWS Access Key ID</span>
                <input
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  autoComplete="off"
                  className={`${inputBase} font-mono text-xs ${inputOk}`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-kp-muted">AWS Secret Access Key</span>
                <input
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputBase} font-mono text-xs ${inputOk}`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-kp-muted">
                  AWS Session Token <span className="text-kp-muted/70">(optional)</span>
                </span>
                <textarea
                  value={sessionToken}
                  onChange={(e) => setSessionToken(e.target.value)}
                  rows={2}
                  placeholder="Required for temporary session keys or AWS SSO"
                  className={`${inputBase} min-h-[72px] resize-y font-mono text-xs ${inputOk}`}
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-kp-muted">
              Step 2 — Target resources
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs text-kp-muted">AWS Region</span>
                <select
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                  className={`${inputBase} ${inputOk}`}
                >
                  {AWS_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-kp-muted">EKS Cluster Name</span>
                <input
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value.toLowerCase())}
                  placeholder="dev-cluster"
                  className={`${inputBase} ${inputOk}`}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs text-kp-muted">
                  Agent IRSA role ARN <span className="text-kp-muted/70">(for Helm install after verify)</span>
                </span>
                <input
                  value={roleArn}
                  onChange={(e) => setRoleArn(e.target.value)}
                  placeholder="arn:aws:iam::123456789012:role/kubepilot-readonly-agent"
                  spellCheck={false}
                  className={`${inputBase} font-mono text-xs ${inputOk}`}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {successMessage && verified && (
        <div className="flex gap-3 rounded-xl border border-kp-green/35 bg-kp-green/10 px-4 py-3 text-sm text-kp-text">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-kp-green" />
          <p>{successMessage}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleVerify()}
        disabled={verifying || verified}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-kp-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-kp-blue/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {verifying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying AWS access…
          </>
        ) : verified ? (
          <>
            <Check className="h-4 w-4" />
            AWS access verified
          </>
        ) : (
          "Verify AWS connection"
        )}
      </button>
    </section>
  );
}

function ConnectionOption({
  active,
  onClick,
  title,
  badge,
  description,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  badge?: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col rounded-xl border p-4 text-left transition-colors ${
        active
          ? "border-kp-blue/50 bg-kp-blue/10 ring-1 ring-kp-blue/30"
          : "border-kp-border bg-kp-bg-deep/50 hover:border-kp-blue/30"
      }`}
    >
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-kp-text">{title}</span>
            {badge && (
              <span className="rounded-full bg-kp-green/15 px-2 py-0.5 text-[10px] font-medium text-kp-green">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-kp-muted">{description}</p>
        </div>
      </div>
    </button>
  );
}
