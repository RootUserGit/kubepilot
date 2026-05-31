"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Trash2 } from "lucide-react";
import {
  type AwsProfilePublic,
  createAwsProfile,
  deleteAwsProfile,
  fetchAwsProfiles,
  fetchOnboardingExternalId,
} from "@/lib/api";
import { PermissionsHelp } from "@/components/onboarding/PermissionsHelp";

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

const CREATE_NEW_VALUE = "__create__";

const inputBase =
  "w-full rounded-lg border bg-kp-bg-deep px-3 py-2.5 text-sm text-kp-text outline-none focus:ring-2 focus:ring-kp-blue/25";
const inputOk = "border-kp-border focus:border-kp-blue";

type Flow = "choose_type" | "user_profiles" | "role_profiles";

type Props = {
  onContinue: (selectedProfileId: string | null) => void;
  onOneTime: () => void;
  onBack: () => void;
};

export function AwsConnectionSetup({ onContinue, onOneTime, onBack }: Props) {
  const [profiles, setProfiles] = useState<AwsProfilePublic[]>([]);
  const [flow, setFlow] = useState<Flow>("choose_type");
  const [userSelect, setUserSelect] = useState("");
  const [roleSelect, setRoleSelect] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profileName, setProfileName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [agentRoleArn, setAgentRoleArn] = useState("");
  const [roleArn, setRoleArn] = useState("");
  const [externalId, setExternalId] = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAwsProfiles();
      setProfiles(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    void fetchOnboardingExternalId()
      .then((r) => setExternalId(r.external_id))
      .catch(() => setExternalId(""));
  }, []);

  const userProfiles = profiles.filter((p) => p.connection_type === "iam_user");
  const roleProfiles = profiles.filter((p) => p.connection_type === "iam_role");

  function resetUserFormFields() {
    setProfileName("");
    setAccountId("");
    setRegion("us-east-1");
    setAccessKeyId("");
    setSecretKey("");
    setSessionToken("");
    setAgentRoleArn("");
  }

  function resetRoleFormFields() {
    setProfileName("");
    setAccountId("");
    setRegion("us-east-1");
    setRoleArn("");
  }

  async function saveUserProfile() {
    setError(null);
    setSaving(true);
    try {
      const created = await createAwsProfile({
        connection_type: "iam_user",
        profile_name: profileName.trim(),
        aws_account_id: accountId.trim(),
        default_region: region,
        aws_access_key_id: accessKeyId.trim(),
        aws_secret_access_key: secretKey,
        aws_session_token: sessionToken.trim() || null,
        role_arn: agentRoleArn.trim() || null,
      });
      setSuccess("IAM user profile saved.");
      setUserSelect(created.id);
      resetUserFormFields();
      await loadProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoleProfile() {
    setError(null);
    setSaving(true);
    try {
      const created = await createAwsProfile({
        connection_type: "iam_role",
        profile_name: profileName.trim(),
        aws_account_id: accountId.trim(),
        default_region: region,
        role_arn: roleArn.trim(),
        external_id: externalId.trim() || null,
      });
      setSuccess("IAM role profile saved.");
      setRoleSelect(created.id);
      resetRoleFormFields();
      await loadProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUserProfile(id: string) {
    try {
      await deleteAwsProfile(id);
      if (userSelect === id) setUserSelect("");
      await loadProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete profile");
    }
  }

  async function handleDeleteRoleProfile(id: string) {
    try {
      await deleteAwsProfile(id);
      if (roleSelect === id) setRoleSelect("");
      await loadProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete profile");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-kp-text">AWS connection</h2>
        <p className="mt-1 text-sm text-kp-muted">
          Choose how you connect to AWS, then pick a saved profile or create one. You can also use one-time
          credentials on the next step without saving a profile.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex gap-2 rounded-xl border border-kp-green/35 bg-kp-green/10 px-4 py-3 text-sm text-kp-text">
          <Check className="h-5 w-5 shrink-0 text-kp-green" />
          {success}
        </div>
      )}

      {flow === "choose_type" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex rounded-xl border border-kp-border hover:border-kp-blue/40">
              <button
                type="button"
                onClick={() => {
                  setFlow("user_profiles");
                  setUserSelect("");
                  setSuccess(null);
                  setError(null);
                }}
                className="min-w-0 flex-1 p-4 text-left"
              >
                <span className="font-medium text-kp-text">IAM User profile</span>
                <p className="mt-1 text-xs text-kp-muted">Access keys stored encrypted server-side.</p>
              </button>
              <div className="flex shrink-0 items-start pt-3 pr-3">
                <PermissionsHelp kind="iam_user" />
              </div>
            </div>
            <div className="flex rounded-xl border border-kp-border hover:border-kp-blue/40">
              <button
                type="button"
                onClick={() => {
                  setFlow("role_profiles");
                  setRoleSelect("");
                  setSuccess(null);
                  setError(null);
                }}
                className="min-w-0 flex-1 p-4 text-left"
              >
                <span className="font-medium text-kp-text">IAM Role profile</span>
                <p className="mt-1 text-xs text-kp-muted">Role ARN + External ID (trust 787943461725).</p>
              </button>
              <div className="flex shrink-0 items-start pt-3 pr-3">
                <PermissionsHelp kind="iam_role" externalId={externalId} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-kp-border pt-6">
            <button
              type="button"
              onClick={onOneTime}
              className="rounded-lg border border-kp-border px-4 py-2.5 text-sm text-kp-muted hover:text-kp-text"
            >
              One-time credentials (no save)
            </button>
            <button type="button" onClick={onBack} className="text-sm text-kp-muted hover:text-kp-text">
              Back
            </button>
          </div>
        </>
      )}

      {flow === "user_profiles" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[min(100%,20rem)] flex-1">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-kp-muted">
                  IAM user profile
                  <PermissionsHelp kind="iam_user" />
                </span>
                {loading ? (
                  <p className="text-sm text-kp-muted">Loading profiles…</p>
                ) : (
                  <select
                    value={userSelect}
                    onChange={(e) => {
                      setUserSelect(e.target.value);
                      setSuccess(null);
                    }}
                    className={`${inputBase} ${inputOk}`}
                  >
                    <option value="">Select a saved profile…</option>
                    {userProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.profile_name} · {p.aws_account_id} · {p.default_region}
                        {p.access_key_last4 ? ` · …${p.access_key_last4}` : ""}
                      </option>
                    ))}
                    <option value={CREATE_NEW_VALUE}>Create new profile…</option>
                  </select>
                )}
              </label>
            </div>
            {userSelect && userSelect !== CREATE_NEW_VALUE && (
              <button
                type="button"
                onClick={() => void handleDeleteUserProfile(userSelect)}
                className="inline-flex items-center gap-2 rounded-lg border border-kp-border px-3 py-2.5 text-sm text-kp-muted hover:border-red-500/40 hover:text-red-300"
                aria-label="Delete selected profile"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>

          {userSelect === CREATE_NEW_VALUE && (
            <ProfileForm
              title="New IAM User profile"
              onCancel={() => {
                setUserSelect("");
                resetUserFormFields();
              }}
              onSave={() => void saveUserProfile()}
              saving={saving}
            >
              <ProfileFields
                profileName={profileName}
                setProfileName={setProfileName}
                accountId={accountId}
                setAccountId={setAccountId}
                region={region}
                setRegion={setRegion}
              />
              <label className="block">
                <span className="mb-1 text-xs text-kp-muted">Access Key ID</span>
                <input value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} className={`${inputBase} ${inputOk} font-mono text-xs`} />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-kp-muted">Secret Access Key</span>
                <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className={`${inputBase} ${inputOk}`} />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-kp-muted">Session token (optional)</span>
                <textarea value={sessionToken} onChange={(e) => setSessionToken(e.target.value)} rows={2} className={`${inputBase} ${inputOk} text-xs`} />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-kp-muted">Agent IRSA role ARN (optional, for Helm)</span>
                <input value={agentRoleArn} onChange={(e) => setAgentRoleArn(e.target.value)} className={`${inputBase} ${inputOk} font-mono text-xs`} />
              </label>
            </ProfileForm>
          )}

          <div className="flex flex-wrap gap-3 border-t border-kp-border pt-6">
            <button
              type="button"
              disabled={!userSelect || userSelect === CREATE_NEW_VALUE}
              onClick={() => onContinue(userSelect)}
              className="rounded-lg bg-kp-blue px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Continue with selected profile
            </button>
            <button
              type="button"
              onClick={() => {
                setFlow("choose_type");
                setUserSelect("");
                resetUserFormFields();
                setSuccess(null);
              }}
              className="text-sm text-kp-muted hover:text-kp-text"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {flow === "role_profiles" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[min(100%,20rem)] flex-1">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-kp-muted">
                  IAM role profile
                  <PermissionsHelp kind="iam_role" externalId={externalId} />
                </span>
                {loading ? (
                  <p className="text-sm text-kp-muted">Loading profiles…</p>
                ) : (
                  <select
                    value={roleSelect}
                    onChange={(e) => {
                      setRoleSelect(e.target.value);
                      setSuccess(null);
                    }}
                    className={`${inputBase} ${inputOk}`}
                  >
                    <option value="">Select a saved profile…</option>
                    {roleProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.profile_name} · {p.aws_account_id} · {p.default_region}
                      </option>
                    ))}
                    <option value={CREATE_NEW_VALUE}>Create new profile…</option>
                  </select>
                )}
              </label>
            </div>
            {roleSelect && roleSelect !== CREATE_NEW_VALUE && (
              <button
                type="button"
                onClick={() => void handleDeleteRoleProfile(roleSelect)}
                className="inline-flex items-center gap-2 rounded-lg border border-kp-border px-3 py-2.5 text-sm text-kp-muted hover:border-red-500/40 hover:text-red-300"
                aria-label="Delete selected profile"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>

          {roleSelect === CREATE_NEW_VALUE && (
            <ProfileForm
              title="New IAM Role profile"
              onCancel={() => {
                setRoleSelect("");
                resetRoleFormFields();
              }}
              onSave={() => void saveRoleProfile()}
              saving={saving}
            >
              <ProfileFields
                profileName={profileName}
                setProfileName={setProfileName}
                accountId={accountId}
                setAccountId={setAccountId}
                region={region}
                setRegion={setRegion}
              />
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs text-kp-muted">
                  External ID
                  <PermissionsHelp kind="cloudformation" externalId={externalId} />
                </span>
                <input readOnly value={externalId} className={`${inputBase} ${inputOk} font-mono text-xs`} />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs text-kp-muted">
                  Role ARN
                  <PermissionsHelp kind="iam_role" externalId={externalId} />
                </span>
                <input value={roleArn} onChange={(e) => setRoleArn(e.target.value)} placeholder="arn:aws:iam::123456789012:role/KubePilot-ReadOnly" className={`${inputBase} ${inputOk} font-mono text-xs`} />
              </label>
            </ProfileForm>
          )}

          <div className="flex flex-wrap gap-3 border-t border-kp-border pt-6">
            <button
              type="button"
              disabled={!roleSelect || roleSelect === CREATE_NEW_VALUE}
              onClick={() => onContinue(roleSelect)}
              className="rounded-lg bg-kp-blue px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Continue with selected profile
            </button>
            <button
              type="button"
              onClick={() => {
                setFlow("choose_type");
                setRoleSelect("");
                resetRoleFormFields();
                setSuccess(null);
              }}
              className="text-sm text-kp-muted hover:text-kp-text"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileForm({
  title,
  children,
  onCancel,
  onSave,
  saving,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-kp-border bg-kp-surface/40 p-5">
      <h3 className="font-semibold text-kp-text">{title}</h3>
      {children}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-kp-blue px-4 py-2 text-sm text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-kp-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ProfileFields({
  profileName,
  setProfileName,
  accountId,
  setAccountId,
  region,
  setRegion,
}: {
  profileName: string;
  setProfileName: (v: string) => void;
  accountId: string;
  setAccountId: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1 text-xs text-kp-muted">Profile name</span>
        <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className={`${inputBase} ${inputOk}`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 text-xs text-kp-muted">AWS account ID</span>
          <input value={accountId} onChange={(e) => setAccountId(e.target.value.replace(/\D/g, "").slice(0, 12))} className={`${inputBase} ${inputOk} font-mono`} />
        </label>
        <label className="block">
          <span className="mb-1 text-xs text-kp-muted">Default region</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={`${inputBase} ${inputOk}`}>
            {AWS_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
