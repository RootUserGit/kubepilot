"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardCopy,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  type ApiErrorWithFields,
  type ClusterRegistrationResponse,
  getClusterRegistrationStatus,
  registerCluster,
} from "@/lib/api";
import { PageHeader, PrimaryButton } from "@/components/dashboard/ui/DashboardUi";

const AWS_REGIONS = [
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "eu-west-1",
  "eu-central-1",
  "us-east-1",
  "us-east-2",
  "us-west-2",
] as const;

type LocalFieldKey =
  | "clusterName"
  | "awsAccountId"
  | "region"
  | "environment"
  | "roleArn"
  | "teamOwnerLabel"
  | "namespaces"
  | "notes";

type LocalFieldErrors = Partial<Record<LocalFieldKey | "_form", string>>;

const SERVER_TO_LOCAL: Record<string, LocalFieldKey> = {
  cluster_name: "clusterName",
  aws_account_id: "awsAccountId",
  aws_region: "region",
  environment: "environment",
  role_arn: "roleArn",
  team_owner_label: "teamOwnerLabel",
  namespace_scope: "namespaces",
  notes: "notes",
};

const FIELD_ORDER: LocalFieldKey[] = [
  "clusterName",
  "awsAccountId",
  "region",
  "environment",
  "roleArn",
  "teamOwnerLabel",
  "namespaces",
  "notes",
];

const inputBase =
  "w-full rounded-lg border bg-kp-bg-deep px-3 py-2.5 text-sm text-kp-text placeholder:text-kp-muted/50 transition-[border-color,box-shadow] outline-none focus:ring-2 focus:ring-kp-blue/25";
const inputOk = "border-kp-border focus:border-kp-blue";
const inputErr = "border-red-500/70 focus:border-red-500 focus:ring-red-500/20";

function mapApiFieldErrors(fe: Record<string, string>): LocalFieldErrors {
  const out: LocalFieldErrors = {};
  for (const [k, v] of Object.entries(fe)) {
    if (k === "_form") {
      out._form = v;
      continue;
    }
    const local = SERVER_TO_LOCAL[k];
    if (local) out[local] = v;
    else out._form = out._form ? `${out._form}; ${v}` : v;
  }
  return out;
}

function validateLocal(
  clusterName: string,
  awsAccountId: string,
  roleArn: string,
): LocalFieldErrors {
  const e: LocalFieldErrors = {};
  const name = clusterName.trim().toLowerCase();
  if (!name) e.clusterName = "Cluster name is required.";
  else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
    e.clusterName = "Use a DNS-safe name: lowercase letters, numbers, hyphens (e.g. prod-eks-apac).";
  }

  const acct = awsAccountId.trim();
  if (!/^\d{12}$/.test(acct)) {
    e.awsAccountId = "AWS account ID must be exactly 12 digits.";
  }

  const arn = roleArn.trim();
  if (!arn) e.roleArn = "Read-only IAM role ARN (IRSA) is required.";
  else if (!arn.startsWith("arn:aws:iam::")) {
    e.roleArn = "Role ARN must start with arn:aws:iam::";
  } else {
    const m = /^arn:aws:iam::(\d{12}):role\/.+/.exec(arn);
    if (!m) {
      e.roleArn = "Use a full role ARN: arn:aws:iam::123456789012:role/your-role-name";
    } else if (acct && /^\d{12}$/.test(acct) && m[1] !== acct) {
      e.awsAccountId = "Must match the 12-digit account embedded in the role ARN.";
      e.roleArn = "This ARN uses a different account ID than the AWS account field.";
    }
  }

  return e;
}

function scrollToFirstFieldError(refs: Record<LocalFieldKey, HTMLElement | null>, errors: LocalFieldErrors) {
  for (const key of FIELD_ORDER) {
    if (errors[key] && refs[key]) {
      refs[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
      refs[key]?.focus();
      break;
    }
  }
}

type Phase = "form" | "install_wait" | "connected" | "stalled";

function StepIndicator({ phase }: { phase: Phase }) {
  const onForm = phase === "form";
  const installing = phase === "install_wait" || phase === "stalled";
  const live = phase === "connected";

  const items = [
    { key: "d", label: "Details", active: onForm, complete: !onForm },
    { key: "i", label: "Install agent", active: installing, complete: live },
    { key: "c", label: "Connected", active: live, complete: live },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8 sm:gap-3">
      {items.map((it, idx) => (
        <div key={it.key} className="flex items-center gap-2 sm:gap-3">
          {idx > 0 && <div className="h-px w-4 bg-kp-border sm:w-8" aria-hidden />}
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${
                it.complete
                  ? "border-kp-green/50 bg-kp-green/15 text-kp-green"
                  : it.active
                    ? "border-kp-blue/60 bg-kp-blue/10 text-kp-blue"
                    : "border-kp-border bg-kp-surface text-kp-muted"
              }`}
            >
              {it.complete ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </span>
            <span className={`text-xs font-semibold sm:text-sm ${it.active || it.complete ? "text-kp-text" : "text-kp-muted"}`}>
              {it.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RegisterClusterPage() {
  const formId = useId();
  const [clusterName, setClusterName] = useState("");
  const [awsAccountId, setAwsAccountId] = useState("");
  const [region, setRegion] = useState<string>("ap-south-1");
  const [environment, setEnvironment] = useState("production");
  const [roleArn, setRoleArn] = useState("");
  const [teamOwnerLabel, setTeamOwnerLabel] = useState("");
  const [namespaces, setNamespaces] = useState("");
  const [notes, setNotes] = useState("");

  const [fieldErrors, setFieldErrors] = useState<LocalFieldErrors>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clusterId, setClusterId] = useState<string | null>(null);
  const [helmCommand, setHelmCommand] = useState("");
  const [registration, setRegistration] = useState<ClusterRegistrationResponse | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refs = useRef<Record<LocalFieldKey, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({
    clusterName: null,
    awsAccountId: null,
    region: null,
    environment: null,
    roleArn: null,
    teamOwnerLabel: null,
    namespaces: null,
    notes: null,
  });

  const clearFieldError = useCallback((key: LocalFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetFlow = useCallback(() => {
    setPhase("form");
    setClusterId(null);
    setHelmCommand("");
    setRegistration(null);
    setStatusHint(null);
    setFieldErrors({});
    setClusterName("");
    setAwsAccountId("");
    setRegion("ap-south-1");
    setEnvironment("production");
    setRoleArn("");
    setTeamOwnerLabel("");
    setNamespaces("");
    setNotes("");
  }, []);

  const backToFormKeepValues = useCallback(() => {
    setPhase("form");
    setClusterId(null);
    setHelmCommand("");
    setRegistration(null);
    setStatusHint(null);
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (phase !== "install_wait" || !clusterId) return;
    const id = clusterId;
    let cancelled = false;
    const started = Date.now();
    const stallMs = 180_000;
    const intervalMs = 2500;

    async function pollLoop() {
      while (!cancelled) {
        if (Date.now() - started > stallMs) {
          if (!cancelled) setPhase("stalled");
          return;
        }
        try {
          const s = await getClusterRegistrationStatus(id);
          if (cancelled) return;
          setStatusHint(s.message);
          if (s.registration_status === "connected") {
            setPhase("connected");
            return;
          }
        } catch {
          if (!cancelled) {
            setFieldErrors((prev) => ({
              ...prev,
              _form: "Could not reach the API while polling. Check the network and API URL.",
            }));
          }
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }

    void pollLoop();
    return () => {
      cancelled = true;
    };
  }, [phase, clusterId]);

  const accountProgress = useMemo(() => `${awsAccountId.length} / 12`, [awsAccountId.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const local = validateLocal(clusterName, awsAccountId, roleArn);
    if (Object.keys(local).length > 0) {
      setFieldErrors(local);
      scrollToFirstFieldError(refs.current, local);
      return;
    }

    setIsSubmitting(true);
    try {
      const body = {
        cluster_name: clusterName.trim().toLowerCase(),
        aws_account_id: awsAccountId.trim(),
        aws_region: region,
        environment,
        role_arn: roleArn.trim(),
        team_owner_label: teamOwnerLabel.trim() || null,
        namespace_scope: namespaces.trim() || null,
        notes: notes.trim() || null,
      };
      const res = await registerCluster(body);
      setRegistration(res);
      setClusterId(res.id);
      setHelmCommand(res.helm_install_command);
      setStatusHint(null);
      setPhase("install_wait");
    } catch (err: unknown) {
      const api = err as ApiErrorWithFields;
      const mapped = mapApiFieldErrors(api.fieldErrors ?? {});
      if (api.message && !mapped._form && Object.keys(mapped).length === 0) {
        mapped._form = api.message;
      }
      setFieldErrors(mapped);
      scrollToFirstFieldError(refs.current, mapped);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyHelm() {
    await navigator.clipboard.writeText(helmCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function manualRefreshStatus() {
    if (!clusterId) return;
    setIsRefreshing(true);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next._form;
      return next;
    });
    try {
      const s = await getClusterRegistrationStatus(clusterId);
      setStatusHint(s.message);
      if (s.registration_status === "connected") setPhase("connected");
    } catch {
      setFieldErrors((prev) => ({
        ...prev,
        _form: "Status refresh failed. Confirm the API is running.",
      }));
    } finally {
      setIsRefreshing(false);
    }
  }

  const showInstallPanel = phase !== "form";
  const isPolling = phase === "install_wait";

  return (
    <>
      <PageHeader
        action={
          <Link
            href="/dashboard/clusters"
            className="inline-flex items-center gap-1.5 text-sm text-kp-muted transition-colors hover:text-kp-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clusters
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
        <StepIndicator phase={phase} />

        {fieldErrors._form && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
            <p>{fieldErrors._form}</p>
          </div>
        )}

        {phase === "form" && (
          <form
            id={formId}
            onSubmit={handleSubmit}
            noValidate
            className="space-y-6 rounded-2xl border border-kp-border bg-kp-surface/50 p-5 shadow-sm backdrop-blur-sm sm:p-8"
          >
            <div className="flex gap-3 rounded-xl border border-kp-border/80 bg-kp-bg-deep/50 p-4 sm:items-start">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-kp-green" />
              <p className="text-sm leading-relaxed text-kp-muted">
                Tell us about the EKS cluster. We queue onboarding in the control plane and only mark the
                cluster <span className="font-medium text-kp-text">connected</span> after the agent
                successfully checks in.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-kp-muted">
                    Cluster name <span className="text-red-500">*</span>
                  </span>
                </span>
                <input
                  ref={(el) => {
                    refs.current.clusterName = el;
                  }}
                  aria-invalid={Boolean(fieldErrors.clusterName)}
                  aria-describedby={fieldErrors.clusterName ? `${formId}-clusterName-err` : `${formId}-clusterName-hint`}
                  value={clusterName}
                  onChange={(e) => {
                    setClusterName(e.target.value.toLowerCase());
                    clearFieldError("clusterName");
                  }}
                  placeholder="e.g. prod-eks-apac"
                  autoComplete="off"
                  className={`${inputBase} ${fieldErrors.clusterName ? inputErr : inputOk}`}
                />
                {fieldErrors.clusterName ? (
                  <p id={`${formId}-clusterName-err`} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                    {fieldErrors.clusterName}
                  </p>
                ) : (
                  <p id={`${formId}-clusterName-hint`} className="mt-1.5 text-[11px] text-kp-muted">
                    Lowercase DNS label; passed to Helm as{" "}
                    <code className="rounded bg-kp-surface px-1 py-0.5 font-mono text-kp-green">clusterName</code>.
                  </p>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-kp-muted">
                    AWS account ID <span className="text-red-500">*</span>
                  </span>
                  <span className="font-mono text-[10px] text-kp-muted">{accountProgress}</span>
                </span>
                <input
                  ref={(el) => {
                    refs.current.awsAccountId = el;
                  }}
                  aria-invalid={Boolean(fieldErrors.awsAccountId)}
                  aria-describedby={fieldErrors.awsAccountId ? `${formId}-acct-err` : undefined}
                  inputMode="numeric"
                  maxLength={12}
                  value={awsAccountId}
                  onChange={(e) => {
                    setAwsAccountId(e.target.value.replace(/\D/g, "").slice(0, 12));
                    clearFieldError("awsAccountId");
                  }}
                  placeholder="123456789012"
                  autoComplete="off"
                  className={`${inputBase} font-mono ${fieldErrors.awsAccountId ? inputErr : inputOk}`}
                />
                {fieldErrors.awsAccountId && (
                  <p id={`${formId}-acct-err`} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                    {fieldErrors.awsAccountId}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-kp-muted">
                  AWS region <span className="text-red-500">*</span>
                </span>
                <select
                  ref={(el) => {
                    refs.current.region = el;
                  }}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className={`${inputBase} ${inputOk}`}
                >
                  {AWS_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-kp-muted">
                  Environment <span className="text-red-500">*</span>
                </span>
                <select
                  ref={(el) => {
                    refs.current.environment = el;
                  }}
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className={`${inputBase} ${inputOk}`}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-kp-muted">
                  Read-only IAM role ARN (IRSA) <span className="text-red-500">*</span>
                </span>
                <input
                  ref={(el) => {
                    refs.current.roleArn = el;
                  }}
                  aria-invalid={Boolean(fieldErrors.roleArn)}
                  aria-describedby={fieldErrors.roleArn ? `${formId}-role-err` : `${formId}-role-hint`}
                  value={roleArn}
                  onChange={(e) => {
                    setRoleArn(e.target.value);
                    clearFieldError("roleArn");
                  }}
                  placeholder="arn:aws:iam::123456789012:role/kubepilot-readonly-agent"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputBase} font-mono text-xs sm:text-sm ${fieldErrors.roleArn ? inputErr : inputOk}`}
                />
                {fieldErrors.roleArn ? (
                  <p id={`${formId}-role-err`} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                    {fieldErrors.roleArn}
                  </p>
                ) : (
                  <p id={`${formId}-role-hint`} className="mt-1.5 text-[11px] text-kp-muted">
                    The 12-digit account inside this ARN must match the AWS account ID field. Used by the agent
                    pod for read-only API access.
                  </p>
                )}
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-kp-muted">
                  Team owner label <span className="text-kp-muted">(optional)</span>
                </span>
                <input
                  ref={(el) => {
                    refs.current.teamOwnerLabel = el;
                  }}
                  value={teamOwnerLabel}
                  onChange={(e) => setTeamOwnerLabel(e.target.value)}
                  placeholder="e.g. payments, platform-core"
                  className={`${inputBase} ${inputOk}`}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-kp-muted">
                  Namespace scope <span className="text-kp-muted">(optional)</span>
                </span>
                <input
                  ref={(el) => {
                    refs.current.namespaces = el;
                  }}
                  value={namespaces}
                  onChange={(e) => setNamespaces(e.target.value)}
                  placeholder="Comma-separated — leave empty for full cluster read scope"
                  className={`${inputBase} ${inputOk}`}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-kp-muted">
                  Notes for platform <span className="text-kp-muted">(optional)</span>
                </span>
                <textarea
                  ref={(el) => {
                    refs.current.notes = el;
                  }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Cross-account setup, maintenance window, compliance context…"
                  className={`${inputBase} min-h-[88px] resize-y ${inputOk}`}
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-kp-border pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <PrimaryButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Queueing registration…
                  </span>
                ) : (
                  "Queue registration & show install"
                )}
              </PrimaryButton>
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-lg border border-kp-border px-4 py-2.5 text-center text-sm text-kp-muted transition-colors hover:border-kp-blue/40 hover:bg-kp-surface hover:text-kp-text"
              >
                Open full onboarding guide
              </Link>
            </div>
          </form>
        )}

        {showInstallPanel && (
          <div className="space-y-6">
            {(isPolling || phase === "stalled") && (
              <div
                className={`rounded-2xl border p-5 sm:p-6 ${
                  phase === "stalled"
                    ? "border-amber-500/35 bg-amber-500/10"
                    : "border-kp-blue/25 bg-kp-blue/5"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    {isPolling ? (
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kp-blue/20 opacity-40" />
                        <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-kp-blue/40 bg-kp-surface">
                          <Radio className="h-5 w-5 text-kp-blue" />
                        </span>
                      </span>
                    ) : (
                      <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <div>
                      <p className="font-semibold text-kp-text">
                        {phase === "stalled" ? "Still waiting for check-in" : "Waiting for agent check-in"}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-kp-muted">
                        {statusHint ??
                          "Registration is queued. Run the Helm command on a host with kubectl; this page polls the API until the agent connects."}
                      </p>
                      {registration && (
                        <p className="mt-2 font-mono text-[11px] text-kp-muted sm:text-xs">
                          Cluster ID: {registration.id}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {isPolling && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-kp-border bg-kp-surface px-3 py-1 text-xs text-kp-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-kp-blue" />
                        Polling…
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void manualRefreshStatus()}
                      disabled={isRefreshing}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-kp-border px-3 py-2 text-xs font-medium text-kp-muted transition-colors hover:bg-kp-bg-deep hover:text-kp-text disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                      Refresh status
                    </button>
                  </div>
                </div>
                {phase === "stalled" && (
                  <p className="mt-4 text-xs leading-relaxed text-kp-muted">
                    For local development you can set{" "}
                    <code className="rounded bg-kp-bg-deep px-1.5 py-0.5 font-mono text-[10px] text-kp-text">
                      KUBEPILOT_SIMULATE_AGENT_CONNECT_SECONDS=12
                    </code>{" "}
                    in the API environment so check-in is simulated after a short delay.
                  </p>
                )}
              </div>
            )}

            {phase === "connected" && (
              <div className="rounded-2xl border border-kp-green/35 bg-kp-green/10 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 h-6 w-6 shrink-0 text-kp-green" />
                  <div>
                    <p className="font-semibold text-kp-text">Agent check-in confirmed</p>
                    <p className="mt-1 text-sm text-kp-muted">
                      Cluster{" "}
                      <strong className="text-kp-text">{registration?.name ?? clusterName}</strong> is now linked.
                      You can run analysis from the cluster list.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-kp-border bg-kp-surface/50 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-kp-border bg-kp-bg-deep/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-kp-muted">Helm — read-only agent</p>
                  <p className="text-[11px] text-kp-muted">Command generated by the API from your submitted values.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyHelm()}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-kp-border bg-kp-surface px-3 py-2 text-xs font-medium text-kp-muted transition-colors hover:border-kp-blue/40 hover:text-kp-text sm:self-auto"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-kp-green" />
                      Copied
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      Copy command
                    </>
                  )}
                </button>
              </div>
              <pre className="kp-terminal-body max-h-[min(420px,55vh)] overflow-auto border-t border-[#30363d] p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
                <code className="kp-tok-default whitespace-pre-wrap break-all">{helmCommand}</code>
              </pre>
              <p className="border-t border-kp-border px-4 py-3 text-[11px] text-kp-muted sm:px-5">
                Use <code className="font-mono text-kp-text">helm upgrade --install</code> for idempotent installs.
                Adjust chart repo or values if you mirror charts internally.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <PrimaryButton href="/dashboard/clusters">Return to cluster list</PrimaryButton>
              <button
                type="button"
                onClick={resetFlow}
                className="rounded-lg border border-kp-border px-4 py-2.5 text-sm text-kp-muted transition-colors hover:bg-kp-surface hover:text-kp-text"
              >
                Register another cluster
              </button>
              <button
                type="button"
                onClick={backToFormKeepValues}
                className="rounded-lg border border-kp-border px-4 py-2.5 text-sm text-kp-muted transition-colors hover:bg-kp-surface hover:text-kp-text sm:ml-auto"
              >
                Edit details
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
