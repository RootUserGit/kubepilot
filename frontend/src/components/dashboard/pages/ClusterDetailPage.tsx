"use client";

import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { ClusterHealthRing } from "@/components/dashboard/ClusterHealthBadge";
import { ClusterTimeSeriesChart } from "@/components/dashboard/ClusterTimeSeriesChart";
import { NamespaceHealthPanel } from "@/components/dashboard/NamespaceHealthPanel";
import { ClusterRiskDashboard } from "@/components/dashboard/ClusterRiskDashboard";
import { FindingsList, type FindingRow } from "@/components/dashboard/FindingsList";
import { DashboardMetaContext } from "@/components/dashboard/DashboardMetaContext";
import { KpiCard, Panel, SeverityBadge } from "@/components/dashboard/ui/DashboardUi";
import {
  type ClusterInsightItem,
  type ClusterPublic,
  type ClusterSummary,
  type InventoryItem,
  deleteCluster,
  fetchCluster,
  fetchClusterSummary,
} from "@/lib/api";
import { markInsightRead, syncInsightsFromCluster } from "@/lib/insights-store";
import { recordHealthPoint, resolveOperationalStatus, getHealthHistory } from "@/lib/health-history";
import { countInsightSeverities, recordRiskSnapshot } from "@/lib/risk-analytics";
import { ClusterOperationalBadge } from "@/components/dashboard/ClusterOperationalBadge";

function clusterStatusBadge(
  cluster: ClusterPublic,
  options?: { scanFailed?: boolean },
): { severity: "healthy" | "warning" | "critical" | "info"; label: string } {
  if (options?.scanFailed) {
    return { severity: "critical", label: "Unreachable" };
  }
  if (cluster.connectivity_status === "reachable" || cluster.last_scan_at) {
    return { severity: "healthy", label: "Connected" };
  }
  if (cluster.registration_status === "connected") {
    return { severity: "healthy", label: "Registered" };
  }
  if (cluster.registration_status === "awaiting_agent") {
    return { severity: "warning", label: "Awaiting agent" };
  }
  return { severity: "info", label: cluster.registration_status ?? "Unknown" };
}

function providerLabel(provider: string | null): string {
  if (provider === "local") return "Local";
  if (provider === "aws") return "AWS EKS";
  return provider ?? "—";
}

function formatCpu(millicores: number | null | undefined): string {
  if (millicores == null) return "—";
  if (millicores >= 1000) return `${(millicores / 1000).toFixed(2)} cores`;
  return `${Math.round(millicores)} mCPU`;
}

function formatMem(mib: number | null | undefined): string {
  if (mib == null) return "—";
  if (mib >= 1024) return `${(mib / 1024).toFixed(2)} GiB`;
  return `${Math.round(mib)} MiB`;
}

function StatDetailPanel({
  kind,
  label,
  items,
  onClose,
}: {
  kind: string;
  label: string;
  items: InventoryItem[];
  onClose: () => void;
}) {
  const showNamespace = kind !== "nodes" && kind !== "namespaces";

  return (
    <Panel
      title={`${label} details`}
      action={
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-kp-muted hover:text-kp-text"
        >
          Close
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="text-xs text-kp-muted">No {label.toLowerCase()} in this scope.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto overscroll-contain">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kp-border text-kp-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Name</th>
                {showNamespace && <th className="py-2 pr-3 font-medium">Namespace</th>}
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.namespace ?? ""}-${item.name}`} className="border-b border-kp-border/40">
                  <td className="py-2 pr-3 font-medium text-kp-text">{item.name}</td>
                  {showNamespace && (
                    <td className="py-2 pr-3 text-kp-muted">{item.namespace ?? "—"}</td>
                  )}
                  <td className="py-2 pr-3 text-kp-muted">{item.status ?? "—"}</td>
                  <td className="py-2 text-kp-muted">{item.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function DeleteClusterModal({
  clusterName,
  open,
  onClose,
  onDeleted,
}: {
  clusterName: string;
  open: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setErr(null);
    }
  }, [open]);

  if (!open) return null;

  const canDelete = confirmText === "delete";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="delete-cluster-title"
        className="relative w-full max-w-md rounded-xl border border-red-500/30 bg-kp-bg-deep p-5 shadow-xl"
      >
        <h3 id="delete-cluster-title" className="text-lg font-semibold text-kp-text">
          Delete cluster registration
        </h3>
        <p className="mt-2 text-sm text-kp-muted">
          This removes <strong className="text-kp-text">{clusterName}</strong> from KubePilot only.
        </p>
        <label className="mt-4 block text-xs text-kp-muted">
          Type <span className="font-mono text-kp-text">delete</span> to confirm
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-kp-border bg-kp-surface px-3 py-2 text-sm text-kp-text"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {err && (
          <p role="alert" className="mt-2 text-xs text-red-300">
            {err}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-kp-border px-3 py-1.5 text-xs text-kp-muted hover:text-kp-text"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canDelete || busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setErr(null);
                try {
                  await onDeleted();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Delete failed");
                  setBusy(false);
                }
              })();
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompactNodeRow({
  node,
  metricsAvailable,
}: {
  node: ClusterSummary["nodes"][0];
  metricsAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-kp-border/40 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-1 py-2 text-left text-sm hover:bg-kp-surface/30"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="flex-1 truncate font-medium text-kp-text">{node.name}</span>
        <SeverityBadge severity={node.ready ? "healthy" : "critical"} label={node.status} />
      </button>
      {open && (
        <div className="pb-2 pl-6 text-xs text-kp-muted">
          <p>{node.roles.join(", ")} · {formatCpu(node.cpu_usage_millicores)} CPU · {formatMem(node.memory_usage_mebibytes)} mem</p>
          <p className="mt-1">{node.os_image ?? "—"} · {node.kubelet_version ?? "—"}</p>
          {!metricsAvailable && (
            <p className="mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> Metrics Server required for usage
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function insightToFindingRow(item: ClusterInsightItem): FindingRow {
  return {
    id: item.id,
    title: item.title,
    severity: item.severity,
    category: item.category,
    namespace: item.namespace,
    resourceKind: item.resource_kind,
    resourceName: item.resource_name,
    findingType: item.finding_type,
    disposition: item.disposition,
  };
}

export function ClusterDetailPage({ clusterId }: { clusterId: string }) {
  const router = useRouter();
  const setPageMeta = useContext(DashboardMetaContext);
  const [cluster, setCluster] = useState<ClusterPublic | null>(null);
  const [summary, setSummary] = useState<ClusterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [chartMetric, setChartMetric] = useState<"cpu" | "memory">("cpu");
  const [showDanger, setShowDanger] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStatKind, setSelectedStatKind] = useState<string | null>(null);
  const lastSnapshotAt = useRef<string | null>(null);

  const nsParam = selectedNamespace || null;

  const loadCachedSummary = useCallback(async () => {
    setCacheLoading(true);
    try {
      setSummary(await fetchClusterSummary(clusterId, { namespace: nsParam, scan: false }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load stored summary");
    } finally {
      setCacheLoading(false);
    }
  }, [clusterId, nsParam]);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanFailed(false);
    setError(null);
    try {
      const data = await fetchClusterSummary(clusterId, { namespace: nsParam, scan: true });
      setSummary(data);
      const failed = Boolean(data.scan_error || data.error);
      setScanFailed(failed);
      setError(data.scan_error ?? data.error ?? null);
      setCluster(await fetchCluster(clusterId));
    } catch (e) {
      setScanFailed(true);
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [clusterId, nsParam]);

  const loadCluster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCluster(await fetchCluster(clusterId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load cluster");
      setCluster(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => {
    setScanFailed(false);
    void loadCluster();
  }, [loadCluster]);

  useEffect(() => {
    if (!cluster) return;
    void loadCachedSummary();
  }, [cluster, loadCachedSummary]);

  useEffect(() => {
    if (!cluster || !summary) return;
    const scanSucceeded = !summary.from_cache && !summary.error && !summary.scan_error;
    if (summary.insights.length > 0 || scanSucceeded) {
      syncInsightsFromCluster(cluster.id, cluster.name, summary.insights, {
        markAbsentAsSolved: scanSucceeded,
        scanCollectedAt: scanSucceeded ? summary.collected_at : null,
      });
    }
    if (scanSucceeded && summary.health?.health_score != null) {
      recordHealthPoint(cluster.id, summary.health.health_score);
    }
    if (scanSucceeded && summary.collected_at && lastSnapshotAt.current !== summary.collected_at) {
      lastSnapshotAt.current = summary.collected_at;
      recordRiskSnapshot(cluster.id, countInsightSeverities(summary.insights));
    }
  }, [cluster, summary]);

  useEffect(() => {
    setSelectedStatKind(null);
  }, [selectedNamespace]);

  useEffect(() => {
    if (!cluster) {
      setPageMeta(null);
      return;
    }
    const env = cluster.environment ?? "—";
    const region = cluster.region ? ` · ${cluster.region}` : "";
    setPageMeta({
      title: cluster.name,
      subtitle: `${providerLabel(cluster.provider)} · ${env}${region}`,
    });
    return () => setPageMeta(null);
  }, [cluster, setPageMeta]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-kp-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading cluster…
      </div>
    );
  }

  if (error && !cluster) {
    return (
      <div className="space-y-4 p-6">
        <div role="alert" className="flex gap-3 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
        <Breadcrumbs items={[{ label: "Clusters", href: "/dashboard/clusters" }, { label: "Cluster" }]} />
      </div>
    );
  }

  if (!cluster) return null;

  const counts = summary?.counts ?? {};
  const metricsAvailable = summary?.metrics_available ?? false;
  const cpuSeries = summary?.timeseries?.cpu_millicores ?? [];
  const memSeries = summary?.timeseries?.memory_mebibytes ?? [];
  const resourceCards = summary?.resource_counts ?? [];
  const insights = summary?.insights ?? [];
  const inventory = summary?.inventory ?? {};

  const statLabel = (kind: string, fallback: string) =>
    resourceCards.find((r) => r.kind === kind)?.label ?? fallback;

  const openFinding = (item: ClusterInsightItem) => {
    markInsightRead(item.id);
    router.push(`/dashboard/ai-insights?insight=${encodeURIComponent(item.id)}`);
  };

  const toggleStat = (kind: string) => {
    setSelectedStatKind((k) => (k === kind ? null : kind));
  };

  const selectedItems: InventoryItem[] = selectedStatKind
    ? inventory[selectedStatKind] ?? []
    : [];

  const findingRows = insights.map(insightToFindingRow);

  return (
    <>
      <div className="space-y-4 border-b border-kp-border/60 p-4 sm:space-y-5 sm:p-6">
        <Breadcrumbs
          items={[
            { label: "Clusters", href: "/dashboard/clusters" },
            { label: cluster.name },
          ]}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
            {summary?.health && (
              <ClusterHealthRing
                health={{
                  health_score: summary.health.health_score,
                  health_status: summary.health.health_status,
                  health_label: summary.health.health_label,
                  summary: summary.health.summary,
                  critical_count: summary.health.critical_count,
                  high_count: summary.health.high_count,
                }}
                size="lg"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-kp-text sm:text-2xl">{cluster.name}</h2>
              <p className="mt-1 font-mono text-xs text-kp-muted">
                {summary?.kubernetes_version
                  ? summary.kubernetes_version
                  : cacheLoading
                    ? "Loading version…"
                    : "Kubernetes version unavailable"}
              </p>
              <p className="mt-0.5 text-xs text-kp-muted">
                {providerLabel(cluster.provider)}
                {cluster.environment ? ` · ${cluster.environment}` : ""}
                {cluster.region ? ` · ${cluster.region}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SeverityBadge
                  severity={clusterStatusBadge(cluster, { scanFailed }).severity}
                  label={clusterStatusBadge(cluster, { scanFailed }).label}
                />
                {summary?.health && (
                  <ClusterOperationalBadge
                    status={resolveOperationalStatus({
                      scanning: scanning,
                      healthScore: summary.health.health_score,
                      healthStatus: summary.health.health_status,
                      history: getHealthHistory(clusterId),
                    })}
                  />
                )}
                {summary?.health && summary.health.health_score != null && (
                  <span className="text-sm font-medium text-kp-text">
                    {summary.health.health_label} · {summary.health.health_score}%
                  </span>
                )}
              </div>
              {summary?.health?.summary && (
                <p className="mt-2 text-xs text-kp-muted">{summary.health.summary}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-end">
            <label className="flex w-full items-center gap-2 text-xs text-kp-muted sm:w-auto">
              Namespace
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className="min-w-[8rem] flex-1 rounded-lg border border-kp-border bg-kp-surface px-2 py-1.5 text-xs text-kp-text transition-colors hover:border-kp-blue/30 sm:flex-none"
              >
                <option value="">All namespaces</option>
                {(summary?.namespaces ?? []).map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void runScan()}
              disabled={scanning}
              title="Query this cluster via Kubernetes API (live scan)"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-kp-blue px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-kp-blue/90 disabled:opacity-50 sm:w-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning…" : "Scan cluster"}
            </button>
            {(cluster.last_scan_at ?? summary?.last_scan_at) && (
              <span className="w-full text-center text-[10px] text-kp-muted sm:text-right">
                Last scan {new Date(cluster.last_scan_at ?? summary!.last_scan_at!).toLocaleString()}
                {summary?.selected_namespace ? ` · ${summary.selected_namespace}` : ""}
              </span>
            )}
            {!cluster.last_scan_at && !summary?.last_scan_at && !cacheLoading && (
              <span className="w-full text-center text-[10px] text-kp-muted sm:text-right">
                No scan yet — click Scan cluster
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <ClusterRiskDashboard
          insights={insights}
          clusterId={clusterId}
          loading={cacheLoading && insights.length === 0}
        />

        {(summary?.namespace_health?.length || summary?.health?.namespace_health?.length) ? (
          <Panel title="Namespace health" action={<span className="text-[10px] text-kp-muted">Unhealthiest first</span>}>
            <NamespaceHealthPanel
              items={summary.namespace_health ?? summary.health.namespace_health ?? []}
              worstNamespace={summary.health.worst_namespace ?? null}
            />
          </Panel>
        ) : null}

        {summary?.from_cache && summary.last_scan_at && !scanFailed && (
          <div className="rounded-xl border border-kp-blue/25 bg-kp-blue/10 px-4 py-2.5 text-xs text-kp-muted">
            {summary.filtered_from_all_namespaces && summary.selected_namespace ? (
              <>
                Viewing namespace <strong className="text-kp-text">{summary.selected_namespace}</strong> from
                your all-namespace scan on {new Date(summary.last_scan_at).toLocaleString()} (no new API call).
              </>
            ) : (
              <>
                Showing stored results from {new Date(summary.last_scan_at).toLocaleString()} (no live API call).
              </>
            )}
            {" "}Click <strong className="text-kp-text">Scan cluster</strong> to run a live scan
            {selectedNamespace ? ` for ${selectedNamespace}` : " (all namespaces)"}.
          </div>
        )}

        {(scanFailed && (summary?.scan_error || summary?.error || error)) && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{summary?.scan_error ?? summary?.error ?? error}</span>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1fr_minmax(300px,380px)]">
          <div className="space-y-4 min-w-0">
            <h3 className="text-sm font-semibold text-kp-text">Infrastructure</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Registration">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-kp-muted">Provider</dt>
                    <dd className="mt-0.5 text-kp-text">{providerLabel(cluster.provider)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-kp-muted">Environment</dt>
                    <dd className="mt-0.5 text-kp-text">{cluster.environment ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-kp-muted">Region</dt>
                    <dd className="mt-0.5 text-kp-text">{cluster.region ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-kp-muted">Kubeconfig</dt>
                    <dd className="mt-0.5 text-kp-text">
                      {cluster.kubeconfig_configured ? "Stored" : "Not stored"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-kp-muted">Cluster ID</dt>
                    <dd className="mt-0.5 font-mono text-xs text-kp-text">{cluster.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-kp-muted">Registered</dt>
                    <dd className="mt-0.5 text-kp-text">
                      {new Date(cluster.created_at).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </Panel>

              <Panel
                title="Nodes"
                action={
                  <span className="text-[10px] text-kp-muted">
                    {counts.nodes_ready ?? 0}/{counts.nodes ?? 0} ready
                  </span>
                }
              >
                {(summary?.nodes?.length ?? 0) === 0 ? (
                  <p className="text-xs text-kp-muted">No nodes returned.</p>
                ) : (
                  <div>
                    {summary?.nodes.map((node) => (
                      <CompactNodeRow key={node.name} node={node} metricsAvailable={metricsAvailable} />
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <KpiCard
                label="Nodes"
                value={String(counts.nodes ?? "—")}
                sub={`${counts.nodes_ready ?? 0} ready · cluster-wide`}
                selected={selectedStatKind === "nodes"}
                onClick={() => toggleStat("nodes")}
              />
              {!selectedNamespace && (
                <KpiCard
                  label="Namespaces"
                  value={String(counts.namespaces ?? "—")}
                  selected={selectedStatKind === "namespaces"}
                  onClick={() => toggleStat("namespaces")}
                />
              )}
              {resourceCards.map((r) => (
                <KpiCard
                  key={r.kind}
                  label={r.label}
                  value={String(r.count)}
                  selected={selectedStatKind === r.kind}
                  onClick={() => toggleStat(r.kind)}
                />
              ))}
              {resourceCards.length === 0 && cacheLoading && (
                <KpiCard label="Resources" value="…" sub="Scanning cluster" />
              )}
            </div>

            {selectedStatKind && (
              <StatDetailPanel
                kind={selectedStatKind}
                label={statLabel(selectedStatKind, selectedStatKind)}
                items={selectedItems}
                onClose={() => setSelectedStatKind(null)}
              />
            )}

            <Panel
              title="Resource usage"
              action={
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-kp-muted"
                  title={summary?.metrics_message ?? undefined}
                >
                  <Info className="h-3 w-3" />
                  {metricsAvailable ? "Metrics Server" : "Metrics unavailable"}
                </span>
              }
            >
              {!metricsAvailable && summary?.metrics_message && (
                <p className="mb-3 rounded-lg border border-kp-border/60 bg-kp-surface/50 px-3 py-2 text-xs text-kp-muted">
                  {summary.metrics_message}
                </p>
              )}
              <div className="mb-3 flex gap-2">
                {(["cpu", "memory"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setChartMetric(m)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      chartMetric === m
                        ? "border-kp-blue bg-kp-blue/15 text-kp-text"
                        : "border-kp-border text-kp-muted"
                    }`}
                  >
                    {m === "cpu" ? "CPU" : "Memory"}
                  </button>
                ))}
              </div>
              {chartMetric === "cpu" ? (
                <ClusterTimeSeriesChart
                  series={cpuSeries}
                  label="Cluster CPU (mCPU)"
                  unit="mCPU"
                  emptyHint={
                    metricsAvailable
                      ? "Collecting samples — refresh again in a moment."
                      : "No usage data. Enable Metrics Server to chart CPU."
                  }
                />
              ) : (
                <ClusterTimeSeriesChart
                  series={memSeries}
                  label="Cluster memory"
                  unit="MiB"
                  emptyHint={
                    metricsAvailable
                      ? "Collecting samples — refresh again in a moment."
                      : "No usage data. Enable Metrics Server to chart memory."
                  }
                />
              )}
            </Panel>

            <div className="border-t border-kp-border/40 pt-4 xl:hidden">
              <h3 className="mb-3 text-sm font-semibold text-kp-text">All findings</h3>
              <FindingsList
                items={findingRows}
                loading={cacheLoading}
                onOpen={(row) => {
                  const item = insights.find((i) => i.id === row.id);
                  if (item) openFinding(item);
                }}
              />
            </div>

            <div className="border-t border-kp-border/40 pt-4">
              <button
                type="button"
                onClick={() => setShowDanger((v) => !v)}
                className="text-[10px] text-kp-muted/60 hover:text-kp-muted"
              >
                {showDanger ? "Hide advanced" : "Advanced options"}
              </button>
              {showDanger && (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-xs text-kp-muted">
                    Remove this cluster from KubePilot. This does not delete resources in your cluster.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete registration
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="hidden min-w-0 xl:block">
            <div className="sticky top-4 space-y-2">
              <h3 className="text-sm font-semibold text-kp-text">All findings</h3>
              <FindingsList
                items={findingRows}
                loading={cacheLoading}
                onOpen={(row) => {
                  const item = insights.find((i) => i.id === row.id);
                  if (item) openFinding(item);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <DeleteClusterModal
        clusterName={cluster.name}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={async () => {
          await deleteCluster(clusterId);
          router.push("/dashboard/clusters");
        }}
      />
    </>
  );
}
