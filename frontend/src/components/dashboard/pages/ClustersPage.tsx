"use client";

import Link from "next/link";
import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { ClusterOperationalBadge } from "@/components/dashboard/ClusterOperationalBadge";
import { DashboardMetaContext } from "@/components/dashboard/DashboardMetaContext";
import { HealthSparkline } from "@/components/dashboard/HealthSparkline";
import { NamespaceHealthPanel } from "@/components/dashboard/NamespaceHealthPanel";
import { ProviderIcon } from "@/components/dashboard/ProviderIcon";
import { FilterPills, PrimaryButton } from "@/components/dashboard/ui/DashboardUi";
import {
  getHealthHistory,
  recordHealthPoint,
  resolveOperationalStatus,
  type OperationalStatus,
} from "@/lib/health-history";
import { type ClusterHealthItem, type ClusterPublic, fetchClusters, fetchClustersHealth } from "@/lib/api";

const PAGE_SIZE = 10;

const envBadge: Record<string, string> = {
  production: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  staging: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  development: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "on-prem": "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

type ColumnKey = "environment" | "provider" | "region" | "health" | "status";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  environment: "Environment",
  provider: "Provider",
  region: "Region",
  health: "Health Score",
  status: "Status",
};

function isOnPrem(provider: string | null): boolean {
  return (provider ?? "").toLowerCase() === "local";
}

function resolveEnvLabel(provider: string | null, environment: string | null): string {
  if (isOnPrem(provider) && !environment) return "On-Prem";
  return environment ?? "—";
}

function envBadgeKey(provider: string | null, environment: string | null): string {
  if (isOnPrem(provider) && !environment) return "on-prem";
  const env = (environment ?? "").toLowerCase();
  if (env in envBadge) return env;
  return "";
}

function healthTextClass(score: number | null, op: OperationalStatus): string {
  if (op === "syncing") return "text-sky-400";
  if (op === "degraded") return "text-amber-300";
  if (score == null) return "text-kp-muted";
  if (score >= 85) return "text-emerald-400";
  if (score >= 65) return "text-amber-300";
  return "text-red-300";
}

function sparkVariant(op: OperationalStatus): "syncing" | "degraded" | "active" | "unknown" {
  if (op === "syncing") return "syncing";
  if (op === "degraded") return "degraded";
  if (op === "active") return "active";
  return "unknown";
}

function regionLabel(provider: string | null, region: string | null): string {
  if (region) return region;
  if (isOnPrem(provider)) return "—";
  return "—";
}

export function ClustersPage() {
  const setPageMeta = useContext(DashboardMetaContext);
  const searchRef = useRef<HTMLInputElement>(null);
  const [clusters, setClusters] = useState<ClusterPublic[]>([]);
  const [healthById, setHealthById] = useState<Record<string, ClusterHealthItem>>({});
  const [healthHistory, setHealthHistory] = useState<Record<string, ReturnType<typeof getHealthHistory>>>({});
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envFilter, setEnvFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OperationalStatus | "all">("all");
  const [expandedHealthId, setExpandedHealthId] = useState<string | null>(null);
  const [healthTierFilter, setHealthTierFilter] = useState<"all" | "healthy" | "warning" | "critical">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    environment: true,
    provider: true,
    region: true,
    health: true,
    status: true,
  });

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const items = await fetchClustersHealth();
      const map: Record<string, ClusterHealthItem> = {};
      const hist: Record<string, ReturnType<typeof getHealthHistory>> = {};
      for (const h of items) {
        map[h.cluster_id] = h;
        if (h.health_score != null) {
          hist[h.cluster_id] = recordHealthPoint(h.cluster_id, h.health_score);
        } else {
          hist[h.cluster_id] = getHealthHistory(h.cluster_id);
        }
      }
      setHealthById(map);
      setHealthHistory(hist);
    } catch {
      setHealthById({});
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClusters();
      setClusters(data);
      void loadHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clusters");
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }, [loadHealth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPageMeta({
      title: "Clusters",
      subtitle: clusters.length
        ? `${clusters.length} Total Cluster${clusters.length === 1 ? "" : "s"}`
        : "Health, status, and inventory across environments",
    });
    return () => setPageMeta(null);
  }, [clusters.length, setPageMeta]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [envFilter, search, statusFilter, healthTierFilter]);

  const counts = useMemo(() => {
    const all = clusters.length;
    const production = clusters.filter((c) => c.environment === "production").length;
    const staging = clusters.filter((c) => c.environment === "staging").length;
    const development = clusters.filter((c) => c.environment === "development").length;
    const onPrem = clusters.filter((c) => isOnPrem(c.provider)).length;
    return { all, production, staging, development, onPrem };
  }, [clusters]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clusters
      .map((c) => {
        const h = healthById[c.id];
        const hist = healthHistory[c.id] ?? [];
        const scanning = healthLoading && !h;
        const opStatus = resolveOperationalStatus({
          scanning,
          healthScore: h?.health_score ?? null,
          healthStatus: h?.health_status ?? null,
          history: hist,
        });
        const provider = h?.provider ?? c.provider;
        const environment = h?.environment ?? c.environment;
        const region = h?.region ?? c.region;
        const k8sVersion = h?.kubernetes_version ?? null;
        return { cluster: c, health: h, hist, scanning, opStatus, provider, environment, region, k8sVersion };
      })
      .filter((row) => {
        const { cluster: c, opStatus, health: h, provider, environment, region, k8sVersion } = row;
        if (envFilter === "production" && c.environment !== "production") return false;
        if (envFilter === "staging" && c.environment !== "staging") return false;
        if (envFilter === "development" && c.environment !== "development") return false;
        if (envFilter === "on-prem" && !isOnPrem(provider)) return false;
        if (statusFilter !== "all" && opStatus !== statusFilter) return false;
        const score = h?.health_score ?? null;
        if (healthTierFilter === "healthy" && (score == null || score < 85)) return false;
        if (healthTierFilter === "warning" && (score == null || score < 65 || score >= 85)) return false;
        if (healthTierFilter === "critical" && (score == null || score >= 65)) return false;
        if (!q) return true;
        const hay = [c.name, provider, region, environment, k8sVersion]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [clusters, healthById, healthHistory, healthLoading, envFilter, search, statusFilter, healthTierFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, rows.length);

  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    const max = 5;
    let start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    for (let i = start; i <= end; i += 1) nums.push(i);
    return nums;
  }, [safePage, totalPages]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-kp-border/60 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || healthLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-kp-border px-3 py-2 text-sm text-kp-muted hover:text-kp-text disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading || healthLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <PrimaryButton href="/dashboard/clusters/register" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Register Cluster
        </PrimaryButton>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {error && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="relative mx-auto w-full max-w-2xl">
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clusters by name, region, or provider…"
            className="w-full rounded-xl border border-kp-border bg-kp-bg-deep py-2.5 pl-4 pr-12 text-sm text-kp-text placeholder:text-kp-muted/70 focus:border-kp-blue focus:outline-none focus:ring-1 focus:ring-kp-blue/40"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-kp-border bg-kp-surface/80 px-1.5 py-0.5 text-[10px] text-kp-muted">
            /
          </kbd>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterPills
            active={envFilter}
            onChange={setEnvFilter}
            items={[
              { id: "all", label: `All (${counts.all})` },
              { id: "production", label: `Production (${counts.production})` },
              { id: "staging", label: `Staging (${counts.staging})` },
              { id: "development", label: `Development (${counts.development})` },
              { id: "on-prem", label: `On-Prem (${counts.onPrem})` },
            ]}
          />
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setFiltersOpen((v) => !v);
                  setColumnsOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-kp-border px-3 py-1.5 text-xs text-kp-muted hover:border-kp-blue/40 hover:text-kp-text"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>
              {filtersOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30"
                    aria-label="Close filters"
                    onClick={() => setFiltersOpen(false)}
                  />
                  <div className="absolute right-0 z-40 mt-1 w-56 rounded-xl border border-kp-border bg-kp-surface-elevated p-3 shadow-xl">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-kp-muted">
                      Status
                    </p>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as OperationalStatus | "all")}
                      className="mb-3 w-full rounded-lg border border-kp-border bg-kp-bg-deep px-2 py-1.5 text-xs text-kp-text"
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active</option>
                      <option value="syncing">Syncing</option>
                      <option value="degraded">Degraded</option>
                      <option value="unknown">Unknown</option>
                    </select>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-kp-muted">
                      Health score
                    </p>
                    <select
                      value={healthTierFilter}
                      onChange={(e) =>
                        setHealthTierFilter(e.target.value as "all" | "healthy" | "warning" | "critical")
                      }
                      className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-2 py-1.5 text-xs text-kp-text"
                    >
                      <option value="all">All scores</option>
                      <option value="healthy">Healthy (85+)</option>
                      <option value="warning">Warning (65–84)</option>
                      <option value="critical">Critical (&lt;65)</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setColumnsOpen((v) => !v);
                  setFiltersOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-kp-border px-3 py-1.5 text-xs text-kp-muted hover:border-kp-blue/40 hover:text-kp-text"
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
              {columnsOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30"
                    aria-label="Close columns"
                    onClick={() => setColumnsOpen(false)}
                  />
                  <div className="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-kp-border bg-kp-surface-elevated p-3 shadow-xl">
                    {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 py-1.5 text-xs text-kp-text"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns[key]}
                          onChange={(e) =>
                            setVisibleColumns((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                          className="rounded border-kp-border"
                        />
                        {COLUMN_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-kp-border bg-kp-surface/30">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-kp-muted">
              <Loader2 className="h-5 w-5 animate-spin text-kp-blue" />
              Loading clusters…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm text-kp-muted">
                {clusters.length === 0
                  ? "No clusters registered yet."
                  : "No clusters match your search or filters."}
              </p>
              {clusters.length === 0 && (
                <PrimaryButton href="/dashboard/clusters/register" className="mt-4 inline-flex">
                  Register your first cluster
                </PrimaryButton>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-kp-border text-xs text-kp-muted">
                      <th className="px-4 py-3 font-medium">Cluster Name</th>
                      {visibleColumns.environment && (
                        <th className="px-4 py-3 font-medium">Environment</th>
                      )}
                      {visibleColumns.provider && <th className="px-4 py-3 font-medium">Provider</th>}
                      {visibleColumns.region && <th className="px-4 py-3 font-medium">Region</th>}
                      {visibleColumns.health && <th className="px-4 py-3 font-medium">Health Score</th>}
                      {visibleColumns.status && <th className="px-4 py-3 font-medium">Status</th>}
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(
                      ({
                        cluster: c,
                        health: h,
                        hist,
                        scanning,
                        opStatus,
                        provider,
                        environment,
                        region,
                        k8sVersion,
                      }) => {
                        const envLabel = resolveEnvLabel(provider, environment);
                        const badgeKey = envBadgeKey(provider, environment);
                        const score = h?.health_score ?? null;

                        const colSpan =
                          2 +
                          (visibleColumns.environment ? 1 : 0) +
                          (visibleColumns.provider ? 1 : 0) +
                          (visibleColumns.region ? 1 : 0) +
                          (visibleColumns.health ? 1 : 0) +
                          (visibleColumns.status ? 1 : 0);

                        return (
                          <Fragment key={c.id}>
                          <tr
                            className="border-b border-kp-border/40 transition-colors last:border-0 hover:bg-kp-surface/50"
                          >
                            <td className="px-4 py-3.5">
                              <Link href={`/dashboard/clusters/${c.id}`} className="group block min-w-[200px]">
                                <span className="flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${
                                      opStatus === "active"
                                        ? "bg-emerald-400"
                                        : opStatus === "syncing"
                                          ? "bg-sky-400 animate-pulse"
                                          : opStatus === "degraded"
                                            ? "bg-amber-400"
                                            : "bg-kp-muted"
                                    }`}
                                    aria-hidden
                                  />
                                  <span className="font-semibold text-kp-text group-hover:text-kp-blue-glow">
                                    {c.name}
                                  </span>
                                </span>
                                <span className="mt-0.5 block pl-4 text-[11px] text-kp-muted">
                                  {scanning ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Fetching version…
                                    </span>
                                  ) : k8sVersion ? (
                                    k8sVersion
                                  ) : h?.registration_status === "connected" || c.registration_status === "connected" ? (
                                    "Version unavailable"
                                  ) : (
                                    (c.registration_status ?? "pending").replace(/_/g, " ")
                                  )}
                                </span>
                              </Link>
                            </td>
                            {visibleColumns.environment && (
                              <td className="px-4 py-3.5">
                                {badgeKey ? (
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${envBadge[badgeKey]}`}
                                  >
                                    {envLabel}
                                  </span>
                                ) : (
                                  <span className="text-kp-muted capitalize">{envLabel}</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.provider && (
                              <td className="px-4 py-3.5">
                                <ProviderIcon provider={provider} />
                              </td>
                            )}
                            {visibleColumns.region && (
                              <td className="px-4 py-3.5 text-kp-text">{regionLabel(provider, region)}</td>
                            )}
                            {visibleColumns.health && (
                              <td className="px-4 py-3.5">
                                {scanning ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs text-kp-muted">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Scanning…
                                  </span>
                                ) : score != null ? (
                                  <div>
                                    <div className="flex items-center gap-3">
                                      <span
                                        className={`whitespace-nowrap text-sm font-semibold tabular-nums ${healthTextClass(score, opStatus)}`}
                                      >
                                        {score}
                                        <span className="font-normal text-kp-muted"> / 100</span>
                                      </span>
                                      <HealthSparkline
                                        points={hist}
                                        score={score}
                                        variant={sparkVariant(opStatus)}
                                        width={80}
                                        height={30}
                                      />
                                    </div>
                                    {h?.worst_namespace && (
                                      <p className="mt-1 text-[10px] text-kp-muted">
                                        Worst: {h.worst_namespace.name} ({h.worst_namespace.health_score})
                                      </p>
                                    )}
                                    {(h?.namespace_health?.length ?? 0) > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedHealthId((id) => (id === c.id ? null : c.id))
                                        }
                                        className="mt-1 text-[10px] text-kp-blue-glow hover:underline"
                                      >
                                        {expandedHealthId === c.id ? "Hide namespaces" : "Namespaces"}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-kp-muted">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td className="px-4 py-3.5">
                                <ClusterOperationalBadge status={opStatus} />
                              </td>
                            )}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-3 text-kp-muted">
                                <Link
                                  href={`/dashboard/clusters/${c.id}`}
                                  className="rounded p-1 hover:bg-kp-surface hover:text-kp-text"
                                  aria-label={`Metrics for ${c.name}`}
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Link>
                                <Link
                                  href={`/dashboard/clusters/${c.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded p-1 hover:bg-kp-surface hover:text-kp-text"
                                  aria-label={`Open ${c.name} in new tab`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                                <Link
                                  href="/dashboard/ai-insights"
                                  className="rounded p-1 hover:bg-kp-surface hover:text-kp-blue-glow"
                                  aria-label={`AI insights for ${c.name}`}
                                >
                                  <Sparkles className="h-4 w-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                          {expandedHealthId === c.id && (h?.namespace_health?.length ?? 0) > 0 && (
                            <tr className="border-b border-kp-border/40 bg-kp-surface/20">
                              <td colSpan={colSpan} className="px-4 py-4">
                                <NamespaceHealthPanel
                                  items={h!.namespace_health!}
                                  worstNamespace={h?.worst_namespace ?? null}
                                  compact
                                />
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-kp-border px-4 py-3 text-xs text-kp-muted sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {rangeStart} to {rangeEnd} of {rows.length} cluster{rows.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg p-1.5 hover:bg-kp-surface disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`min-w-[28px] rounded-lg px-2 py-1 text-xs font-medium ${
                        n === safePage
                          ? "bg-kp-blue text-white"
                          : "hover:bg-kp-surface hover:text-kp-text"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg p-1.5 hover:bg-kp-surface disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
