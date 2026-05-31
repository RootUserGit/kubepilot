"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardCopy,
  Download,
  Loader2,
  Radio,
  RefreshCw,
} from "lucide-react";
import { AwsClusterOnboardForm } from "@/components/onboarding/AwsClusterOnboardForm";
import { AwsConnectionSetup } from "@/components/onboarding/AwsConnectionSetup";
import { LocalClusterForm } from "@/components/onboarding/LocalClusterForm";
import { PlatformPicker, type PlatformChoice } from "@/components/onboarding/PlatformPicker";
import {
  AWS_STEPS,
  LOCAL_STEPS,
  RegisterStepIndicator,
  type RegisterStepId,
} from "@/components/onboarding/RegisterStepIndicator";
import {
  type ClusterPublic,
  type ClusterRegistrationResponse,
  downloadAgentHelmChartZip,
  getClusterRegistrationStatus,
  postAgentClusterCheckIn,
} from "@/lib/api";
import { PageHeader, PrimaryButton } from "@/components/dashboard/ui/DashboardUi";

type Phase = RegisterStepId;

export function RegisterClusterPage() {
  const [step, setStep] = useState<Phase>("platform");
  const [platform, setPlatform] = useState<PlatformChoice | null>(null);
  const [awsProfileId, setAwsProfileId] = useState<string | null>(null);
  const [awsOneTime, setAwsOneTime] = useState(false);

  const [localCluster, setLocalCluster] = useState<ClusterPublic | null>(null);
  const [registration, setRegistration] = useState<ClusterRegistrationResponse | null>(null);
  const [clusterId, setClusterId] = useState<string | null>(null);
  const [helmCommand, setHelmCommand] = useState("");
  const [helmLocalCommand, setHelmLocalCommand] = useState("");
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [chartDownloading, setChartDownloading] = useState(false);
  const [chartDownloadError, setChartDownloadError] = useState<string | null>(null);
  const [ownerCheckInAvailable, setOwnerCheckInAvailable] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollGeneration = useRef(0);

  const resetFlow = useCallback(() => {
    setStep("platform");
    setPlatform(null);
    setAwsProfileId(null);
    setAwsOneTime(false);
    setLocalCluster(null);
    setRegistration(null);
    setClusterId(null);
    setHelmCommand("");
    setHelmLocalCommand("");
    setStatusHint(null);
    setChartDownloadError(null);
    setOwnerCheckInAvailable(false);
    setCheckInError(null);
  }, []);

  const steps =
    platform === "aws"
      ? AWS_STEPS
      : platform === "local"
        ? LOCAL_STEPS
        : [{ id: "platform" as const, label: "Platform" }];

  useEffect(() => {
    if (step !== "install_wait") return;
    if (!clusterId) return;
    const id = clusterId;
    const session = ++pollGeneration.current;
    const started = Date.now();
    const stallMs = 180_000;
    /** Softer polling: start at 6s, backoff toward ~36s (caps server load vs 2.5s fixed). */
    let delayMs = 6000;
    const maxDelayMs = 36_000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number) => {
      timeoutId = setTimeout(() => void tick(), ms);
    };

    async function tick() {
      if (pollGeneration.current !== session) return;
      if (Date.now() - started > stallMs) {
        setStep("stalled");
        return;
      }
      try {
        const s = await getClusterRegistrationStatus(id);
        if (pollGeneration.current !== session) return;
        setStatusHint(s.message);
        setOwnerCheckInAvailable(Boolean(s.owner_check_in_available));
        if (s.registration_status === "connected") {
          setStep("connected");
          return;
        }
      } catch {
        /* ignore transient errors */
      }
      if (pollGeneration.current !== session) return;
      delayMs = Math.min(maxDelayMs, Math.round(delayMs * 1.35));
      schedule(delayMs);
    }

    schedule(delayMs);
    return () => {
      pollGeneration.current += 1;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [step, clusterId]);

  function handlePlatformSelect(p: PlatformChoice) {
    setPlatform(p);
    if (p === "local") setStep("local_details");
    else if (p === "aws") setStep("aws_connection");
  }

  function handleAwsRegistered(res: ClusterRegistrationResponse) {
    setRegistration(res);
    setClusterId(res.id);
    setHelmCommand(res.helm_install_command);
    setHelmLocalCommand(res.helm_install_local_command ?? "");
    setCheckInError(null);
    setStep("install_wait");
    void getClusterRegistrationStatus(res.id)
      .then((s) => {
        setOwnerCheckInAvailable(Boolean(s.owner_check_in_available));
        setStatusHint(s.message);
      })
      .catch(() => {});
  }

  async function copyHelm() {
    await navigator.clipboard.writeText(helmCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyHelmLocal() {
    await navigator.clipboard.writeText(helmLocalCommand);
    setCopiedLocal(true);
    setTimeout(() => setCopiedLocal(false), 2000);
  }

  async function handleDownloadChart() {
    setChartDownloading(true);
    setChartDownloadError(null);
    try {
      await downloadAgentHelmChartZip();
    } catch (e) {
      console.error(e);
      setChartDownloadError(e instanceof Error ? e.message : "Chart download failed");
    } finally {
      setChartDownloading(false);
    }
  }

  async function manualRefreshStatus() {
    if (!clusterId) return;
    setIsRefreshing(true);
    try {
      const s = await getClusterRegistrationStatus(clusterId);
      setStatusHint(s.message);
      setOwnerCheckInAvailable(Boolean(s.owner_check_in_available));
      if (s.registration_status === "connected") setStep("connected");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleOwnerMarkConnected() {
    if (!clusterId) return;
    setCheckInBusy(true);
    setCheckInError(null);
    try {
      await postAgentClusterCheckIn(clusterId);
      setStep("connected");
      setStatusHint("Agent check-in recorded. This cluster is linked in KubePilot.");
    } catch (e) {
      setCheckInError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckInBusy(false);
    }
  }

  const showAwsInstall = platform === "aws" && (step === "install_wait" || step === "connected" || step === "stalled");

  return (
    <>
      <PageHeader
        action={
          <Link
            href="/dashboard/clusters"
            className="inline-flex items-center gap-1.5 text-sm text-kp-muted hover:text-kp-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clusters
          </Link>
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
        <RegisterStepIndicator steps={steps} current={step} />

        {step === "platform" && <PlatformPicker onSelect={handlePlatformSelect} />}

        {step === "local_details" && platform === "local" && (
          <LocalClusterForm
            onBack={() => setStep("platform")}
            onSuccess={(c) => {
              setLocalCluster(c);
              setStep("connected");
            }}
          />
        )}

        {step === "connected" && platform === "local" && localCluster && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-2xl border border-kp-green/35 bg-kp-green/10 p-6">
              <div className="flex gap-3">
                <Check className="h-6 w-6 text-kp-green" />
                <div>
                  <p className="font-semibold text-kp-text">Local cluster registered</p>
                  <p className="mt-1 text-sm text-kp-muted">
                    <strong className="text-kp-text">{localCluster.name}</strong> is{" "}
                    {localCluster.registration_status === "connected"
                      ? "connected and ready for analysis."
                      : "queued — add kubeconfig to connect."}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <PrimaryButton href="/dashboard/clusters">View clusters</PrimaryButton>
              <button type="button" onClick={resetFlow} className="text-sm text-kp-muted hover:text-kp-text">
                Register another
              </button>
            </div>
          </div>
        )}

        {step === "aws_connection" && platform === "aws" && (
          <AwsConnectionSetup
            onBack={() => setStep("platform")}
            onContinue={(id) => {
              setAwsProfileId(id);
              setAwsOneTime(false);
              setStep("aws_cluster");
            }}
            onOneTime={() => {
              setAwsProfileId(null);
              setAwsOneTime(true);
              setStep("aws_cluster");
            }}
          />
        )}

        {step === "aws_cluster" && platform === "aws" && (
          <AwsClusterOnboardForm
            profileId={awsProfileId}
            oneTime={awsOneTime}
            onBack={() => setStep("aws_connection")}
            onRegistered={handleAwsRegistered}
          />
        )}

        {showAwsInstall && (
          <div className="space-y-6">
            {(step === "install_wait" || step === "stalled") && (
              <div
                className={`rounded-2xl border p-5 sm:p-6 ${
                  step === "stalled" ? "border-amber-500/35 bg-amber-500/10" : "border-kp-blue/25 bg-kp-blue/5"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    {step === "install_wait" ? (
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kp-blue/20 opacity-40" />
                        <Radio className="relative h-5 w-5 text-kp-blue" />
                      </span>
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-400" />
                    )}
                    <div>
                      <p className="font-semibold text-kp-text">
                        {step === "stalled" ? "Still waiting for check-in" : "Waiting for agent check-in"}
                      </p>
                      <p className="mt-1 text-sm text-kp-muted">{statusHint ?? "Run the Helm command below."}</p>
                      {checkInError && <p className="mt-2 text-xs text-red-400">{checkInError}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                    {ownerCheckInAvailable && (step === "install_wait" || step === "stalled") && (
                      <button
                        type="button"
                        onClick={() => void handleOwnerMarkConnected()}
                        disabled={checkInBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-kp-green/90 px-3 py-2 text-xs font-medium text-white hover:bg-kp-green disabled:opacity-50"
                      >
                        {checkInBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Mark connected (owner, dev)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void manualRefreshStatus()}
                      disabled={isRefreshing}
                      className="inline-flex items-center gap-2 rounded-lg border border-kp-border px-3 py-2 text-xs text-kp-muted"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === "connected" && (
              <div className="rounded-2xl border border-kp-green/35 bg-kp-green/10 p-5">
                <div className="flex gap-3">
                  <Check className="h-6 w-6 text-kp-green" />
                  <p className="text-sm">
                    Cluster <strong>{registration?.name}</strong> is connected.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-kp-border bg-kp-surface/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kp-border px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-kp-muted">Helm install (published repo)</p>
                    <p className="mt-0.5 text-[11px] text-kp-muted">
                      Needs a Helm index URL (see API <code className="font-mono">KUBEPILOT_HELM_AGENT_REPO_INDEX_URL</code>).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyHelm()}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-kp-border px-3 py-1.5 text-xs"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-kp-green" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                    Copy
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto p-4 font-mono text-xs text-kp-text">{helmCommand}</pre>
              </div>

              <div className="overflow-hidden rounded-2xl border border-kp-border bg-kp-surface/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kp-border px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-kp-muted">Helm install (offline chart)</p>
                    <p className="mt-0.5 text-[11px] text-kp-muted">
                      Download the chart zip, unzip next to your kube context, then run the command (folder{" "}
                      <code className="font-mono">kubepilot-agent/</code>).
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={chartDownloading}
                      onClick={() => void handleDownloadChart()}
                      className="inline-flex items-center gap-2 rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-1.5 text-xs hover:border-kp-blue/40"
                    >
                      {chartDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Download chart zip
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyHelmLocal()}
                      disabled={!helmLocalCommand}
                      className="inline-flex items-center gap-2 rounded-lg border border-kp-border px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      {copiedLocal ? <Check className="h-3.5 w-3.5 text-kp-green" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      Copy
                    </button>
                  </div>
                </div>
                <pre className="max-h-72 overflow-auto p-4 font-mono text-xs text-kp-text">{helmLocalCommand}</pre>
                {chartDownloadError ? (
                  <p className="border-t border-kp-border px-4 py-2 text-xs text-red-400">{chartDownloadError}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <PrimaryButton href="/dashboard/clusters">Return to clusters</PrimaryButton>
              <button type="button" onClick={resetFlow} className="text-sm text-kp-muted">
                Register another
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
