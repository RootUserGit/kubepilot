"use client";

import { type FormEvent, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import {
  type ApiErrorWithFields,
  type AwsProfilePublic,
  type ClusterRegistrationResponse,
  type VerifyAwsSuccessResponse,
  fetchAwsProfiles,
  registerCluster,
  verifyAwsConnection,
} from "@/lib/api";
import { AwsEksOnboardingWizard, type AwsOnboardingValues } from "@/components/onboarding/AwsEksOnboardingWizard";
import { PrimaryButton } from "@/components/dashboard/ui/DashboardUi";

const IAM_ROLE_ARN_RE = /^arn:aws:iam::\d{12}:role\//;

function looksLikeIamRoleArn(arn: string | null | undefined): boolean {
  return typeof arn === "string" && IAM_ROLE_ARN_RE.test(arn.trim());
}

type Props = {
  profileId: string | null;
  oneTime: boolean;
  onBack: () => void;
  onRegistered: (res: ClusterRegistrationResponse) => void;
};

export function AwsClusterOnboardForm({ profileId, oneTime, onBack, onRegistered }: Props) {
  const [profile, setProfile] = useState<AwsProfilePublic | null>(null);
  const [profiles, setProfiles] = useState<AwsProfilePublic[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(profileId);

  const [clusterName, setClusterName] = useState("");
  const [eksClusterName, setEksClusterName] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [environment, setEnvironment] = useState("production");
  const [roleArn, setRoleArn] = useState("");
  const [teamOwner, setTeamOwner] = useState("");
  const [namespaces, setNamespaces] = useState("");
  const [notes, setNotes] = useState("");

  const [awsVerified, setAwsVerified] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyAwsSuccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (oneTime) return;
    void fetchAwsProfiles().then((list) => {
      setProfiles(list);
      if (profileId) {
        const p = list.find((x) => x.id === profileId);
        if (p) {
          setProfile(p);
          setSelectedProfileId(p.id);
          setRegion(p.default_region);
          if (p.connection_type === "iam_role" && p.role_arn) {
            setRoleArn(p.role_arn);
          } else if (p.connection_type === "iam_user") {
            setRoleArn(looksLikeIamRoleArn(p.role_arn) ? p.role_arn! : "");
          }
        }
      }
    });
  }, [oneTime, profileId]);

  useEffect(() => {
    if (!selectedProfileId) return;
    const p = profiles.find((x) => x.id === selectedProfileId);
    if (p) {
      setProfile(p);
      setRegion(p.default_region);
      if (p.connection_type === "iam_role" && p.role_arn) {
        setRoleArn(p.role_arn);
      } else if (p.connection_type === "iam_user") {
        setRoleArn(looksLikeIamRoleArn(p.role_arn) ? p.role_arn! : "");
      }
    }
  }, [selectedProfileId, profiles]);

  async function handleVerify() {
    setError(null);
    const eks = eksClusterName.trim();
    if (!eks) {
      setError("EKS cluster name is required for verification.");
      return;
    }
    setVerifying(true);
    try {
      let result: VerifyAwsSuccessResponse;
      if (profile && !oneTime) {
        if (profile.connection_type === "iam_role") {
          result = await verifyAwsConnection({
            connection_type: "iam_role",
            aws_region: region,
            cluster_name: eks,
            profile_id: profile.id,
          });
        } else {
          result = await verifyAwsConnection({
            connection_type: "iam_user",
            aws_region: region,
            cluster_name: eks,
            profile_id: profile.id,
          });
        }
      } else {
        setError("Use one-time flow below or select a profile.");
        return;
      }
      setVerifyResult(result);
      setAwsVerified(true);
      if (!clusterName) setClusterName(eks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  function handleOneTimeVerified(result: VerifyAwsSuccessResponse, values: AwsOnboardingValues) {
    setVerifyResult(result);
    setAwsVerified(true);
    setClusterName(values.clusterName);
    setEksClusterName(values.clusterName);
    setRegion(values.awsRegion);
    setRoleArn(values.roleArn);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (!awsVerified || !verifyResult) {
      setError("Verify AWS connection first.");
      return;
    }
    const name = clusterName.trim().toLowerCase();
    const acct = verifyResult.aws_account_id;
    const arn = roleArn.trim();
    if (!name || !arn) {
      setError("Cluster name and agent role ARN are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await registerCluster({
        cluster_name: name,
        aws_account_id: acct,
        aws_region: region,
        environment,
        role_arn: arn,
        team_owner_label: teamOwner.trim() || null,
        namespace_scope: namespaces.trim() || null,
        notes: notes.trim() || null,
        aws_profile_id: selectedProfileId,
      });
      onRegistered(res);
    } catch (err) {
      const api = err as ApiErrorWithFields;
      setError(api.message ?? "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (oneTime) {
    return (
      <div className="space-y-6">
        <AwsEksOnboardingWizard onVerified={handleOneTimeVerified} verified={awsVerified} />
        {awsVerified && (
          <RegisterFields
            clusterName={clusterName}
            setClusterName={setClusterName}
            environment={environment}
            setEnvironment={setEnvironment}
            roleArn={roleArn}
            setRoleArn={setRoleArn}
            teamOwner={teamOwner}
            setTeamOwner={setTeamOwner}
            namespaces={namespaces}
            setNamespaces={setNamespaces}
            notes={notes}
            setNotes={setNotes}
            error={error}
            submitting={submitting}
            onSubmit={handleRegister}
            onBack={onBack}
          />
        )}
        {!awsVerified && (
          <button type="button" onClick={onBack} className="text-sm text-kp-muted hover:text-kp-text">
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-kp-text">Cluster details</h2>
        <p className="mt-1 text-sm text-kp-muted">Verify EKS access, then queue agent installation.</p>
      </div>

      {profiles.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-kp-muted">AWS profile</span>
          <select
            value={selectedProfileId ?? ""}
            onChange={(e) => {
              setSelectedProfileId(e.target.value || null);
              setAwsVerified(false);
            }}
            className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2.5 text-sm"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.profile_name} — {p.aws_account_id} / {p.default_region} ({p.connection_type})
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-xs text-kp-muted">EKS cluster name (for DescribeCluster)</span>
        <input
          value={eksClusterName}
          onChange={(e) => {
            setEksClusterName(e.target.value);
            setAwsVerified(false);
          }}
          className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-kp-muted">AWS region</span>
        <input
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setAwsVerified(false);
          }}
          className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2.5 text-sm font-mono"
        />
      </label>

      {error && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {awsVerified && verifyResult && (
        <div className="flex gap-2 rounded-xl border border-kp-green/35 bg-kp-green/10 px-4 py-3 text-sm">
          <Check className="h-5 w-5 text-kp-green" />
          Verified {verifyResult.cluster_name}
        </div>
      )}

      <button
        type="button"
        disabled={verifying || awsVerified}
        onClick={() => void handleVerify()}
        className="rounded-lg bg-kp-blue px-4 py-2.5 text-sm text-white disabled:opacity-50"
      >
        {verifying ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying…
          </span>
        ) : awsVerified ? (
          "AWS verified"
        ) : (
          "Verify AWS connection"
        )}
      </button>

      {awsVerified && (
        <RegisterFields
          clusterName={clusterName}
          setClusterName={setClusterName}
          environment={environment}
          setEnvironment={setEnvironment}
          roleArn={roleArn}
          setRoleArn={setRoleArn}
          teamOwner={teamOwner}
          setTeamOwner={setTeamOwner}
          namespaces={namespaces}
          setNamespaces={setNamespaces}
          notes={notes}
          setNotes={setNotes}
          error={error}
          submitting={submitting}
          onSubmit={handleRegister}
          onBack={onBack}
        />
      )}

      {!awsVerified && (
        <button type="button" onClick={onBack} className="text-sm text-kp-muted">
          Back
        </button>
      )}
    </div>
  );
}

function RegisterFields({
  clusterName,
  setClusterName,
  environment,
  setEnvironment,
  roleArn,
  setRoleArn,
  teamOwner,
  setTeamOwner,
  namespaces,
  setNamespaces,
  notes,
  setNotes,
  error,
  submitting,
  onSubmit,
  onBack,
}: {
  clusterName: string;
  setClusterName: (v: string) => void;
  environment: string;
  setEnvironment: (v: string) => void;
  roleArn: string;
  setRoleArn: (v: string) => void;
  teamOwner: string;
  setTeamOwner: (v: string) => void;
  namespaces: string;
  setNamespaces: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t border-kp-border pt-6">
      <label className="block">
        <span className="mb-1 text-xs text-kp-muted">KubePilot cluster name</span>
        <input value={clusterName} onChange={(e) => setClusterName(e.target.value.toLowerCase())} className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2.5 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-kp-muted">
          Agent IRSA role ARN — IAM role the agent pod assumes via IRSA (format{" "}
          <code className="rounded bg-kp-surface px-1 font-mono text-[10px]">arn:aws:iam::ACCOUNT:role/NAME</code>
          ). Not an EKS cluster ARN.
        </span>
        <input value={roleArn} onChange={(e) => setRoleArn(e.target.value)} className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2.5 font-mono text-xs" />
      </label>
      <label className="block">
        <span className="mb-1 text-xs text-kp-muted">Environment</span>
        <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2.5 text-sm">
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </select>
      </label>
      <input value={teamOwner} onChange={(e) => setTeamOwner(e.target.value)} placeholder="Team owner (optional)" className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2 text-sm" />
      <input value={namespaces} onChange={(e) => setNamespaces(e.target.value)} placeholder="Namespace scope (optional)" className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2 text-sm" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2 text-sm" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "Queueing…" : "Queue registration & show install"}
        </PrimaryButton>
        <button type="button" onClick={onBack} className="text-sm text-kp-muted">
          Back
        </button>
      </div>
    </form>
  );
}
