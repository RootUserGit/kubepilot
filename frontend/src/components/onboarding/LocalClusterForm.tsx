"use client";

import { type FormEvent, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { createLocalCluster, type ClusterPublic } from "@/lib/api";
import { PrimaryButton } from "@/components/dashboard/ui/DashboardUi";

const inputBase =
  "w-full rounded-lg border bg-kp-bg-deep px-3 py-2.5 text-sm text-kp-text placeholder:text-kp-muted/50 outline-none focus:ring-2 focus:ring-kp-blue/25";
const inputOk = "border-kp-border focus:border-kp-blue";
const inputErr = "border-red-500/70 focus:border-red-500";

type Props = {
  onSuccess: (cluster: ClusterPublic) => void;
  onBack: () => void;
};

export function LocalClusterForm({ onSuccess, onBack }: Props) {
  const [clusterName, setClusterName] = useState("");
  const [kubeconfig, setKubeconfig] = useState("");
  const [namespaceScope, setNamespaceScope] = useState("");
  const [notes, setNotes] = useState("");
  const [skipKubeconfig, setSkipKubeconfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const name = clusterName.trim().toLowerCase();
    const fe: Record<string, string> = {};
    if (!name) fe.clusterName = "Cluster name is required.";
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
      fe.clusterName = "Use a DNS-safe name (lowercase letters, numbers, hyphens).";
    }
    if (!skipKubeconfig && !kubeconfig.trim()) {
      fe.kubeconfig = "Kubeconfig is required unless you use the advanced option below.";
    }
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    setSubmitting(true);
    try {
      const cluster = await createLocalCluster({
        name,
        kubeconfig_yaml: skipKubeconfig ? null : kubeconfig.trim(),
        namespace_scope: namespaceScope.trim() || null,
        notes: notes.trim() || null,
      });
      onSuccess(cluster);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register cluster");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-kp-text">Local cluster</h2>
        <p className="mt-1 text-sm text-kp-muted">
          Register a cluster from Minikube, kind, or any kubeconfig. Paste the full kubeconfig so the API
          and worker can reach it (required when running in Docker).
        </p>
      </div>

      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase text-kp-muted">
          Cluster name <span className="text-red-500">*</span>
        </span>
        <input
          value={clusterName}
          onChange={(e) => setClusterName(e.target.value.toLowerCase())}
          placeholder="e.g. minikube-local"
          className={`${inputBase} ${fieldErrors.clusterName ? inputErr : inputOk}`}
        />
        {fieldErrors.clusterName && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.clusterName}</p>
        )}
      </label>

      <label className="block">
        <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase text-kp-muted">
          Kubeconfig YAML <span className="text-red-500">*</span>
        </span>
        <textarea
          value={kubeconfig}
          onChange={(e) => setKubeconfig(e.target.value)}
          disabled={skipKubeconfig}
          rows={12}
          placeholder="Paste output of: kubectl config view --raw"
          spellCheck={false}
          className={`${inputBase} min-h-[200px] resize-y font-mono text-xs ${fieldErrors.kubeconfig ? inputErr : inputOk} disabled:opacity-50`}
        />
        {fieldErrors.kubeconfig && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.kubeconfig}</p>
        )}
      </label>

      <label className="flex items-start gap-2 text-sm text-kp-muted">
        <input
          type="checkbox"
          checked={skipKubeconfig}
          onChange={(e) => setSkipKubeconfig(e.target.checked)}
          className="mt-1"
        />
        <span>
          Advanced: skip kubeconfig (uses server default — only works when API runs on your host, not
          Docker Compose).
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase text-kp-muted">
          Namespace scope <span className="text-kp-muted/70">(optional)</span>
        </span>
        <input
          value={namespaceScope}
          onChange={(e) => setNamespaceScope(e.target.value)}
          placeholder="Comma-separated namespaces"
          className={`${inputBase} ${inputOk}`}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase text-kp-muted">
          Notes <span className="text-kp-muted/70">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${inputBase} resize-y ${inputOk}`}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Registering…
            </span>
          ) : (
            "Register local cluster"
          )}
        </PrimaryButton>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-kp-border px-4 py-2.5 text-sm text-kp-muted hover:text-kp-text"
        >
          Back
        </button>
      </div>
    </form>
  );
}
