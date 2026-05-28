"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { InsightsCatalog } from "@/components/dashboard/InsightsCatalog";
import { InsightDetailPanel } from "@/components/dashboard/InsightDetailPanel";
import { FilterPills } from "@/components/dashboard/ui/DashboardUi";
import { useInsights } from "@/hooks/useInsights";
import {
  categoryLabel,
  countBySeverityTier,
  formatInsightTime,
  getInsightById,
  isConfirmedSolved,
  getUniqueClusters,
  markInsightRead,
  matchesSeverityTier,
  sortInsightsByRecency,
  type SeverityTier,
  type StoredInsight,
} from "@/lib/insights-store";

function InsightsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("insight");
  const { insights, refresh } = useInsights();
  const [refreshing, setRefreshing] = useState(false);
  const [severity, setSeverity] = useState<SeverityTier>("all");
  const [clusterFilter, setClusterFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showSolved, setShowSolved] = useState(false);

  const focusInsight = focusId ? getInsightById(focusId) : undefined;
  const clusters = useMemo(() => getUniqueClusters(), [insights]);
  const categories = useMemo(() => {
    const set = new Set(insights.map((i) => i.category));
    return [...set].sort();
  }, [insights]);

  useEffect(() => {
    if (focusId) markInsightRead(focusId);
  }, [focusId]);

  const pool = useMemo(() => {
    return insights.filter((i) => {
      if (i.status === "removed") return false;
      if (isConfirmedSolved(i)) return showSolved;
      return i.status === "open";
    });
  }, [insights, showSolved]);

  const counts = useMemo(() => countBySeverityTier(pool, { includeSolved: true }), [pool]);

  const filtered = useMemo(() => {
    const rows = pool.filter((i) => {
      if (clusterFilter && i.clusterId !== clusterFilter) return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (!matchesSeverityTier(i.severity, severity)) return false;
      return true;
    });
    return sortInsightsByRecency(rows);
  }, [pool, clusterFilter, categoryFilter, severity]);

  const openFocus = (item: StoredInsight) => {
    markInsightRead(item.id);
    router.push(`/dashboard/ai-insights?insight=${encodeURIComponent(item.id)}`);
  };

  const handleLocalRefresh = () => {
    setRefreshing(true);
    refresh();
    requestAnimationFrame(() => setRefreshing(false));
  };

  if (focusId && !focusInsight) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Breadcrumbs items={[{ label: "AI Insights", href: "/dashboard/ai-insights" }, { label: "Not found" }]} />
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-6 text-sm text-amber-100">
          <p className="font-medium">This insight is no longer in your list.</p>
          <p className="mt-2 text-xs text-amber-200/90">
            Re-scan the cluster from the cluster page, then open the finding again from AI Insights.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/ai-insights")}
            className="mt-4 rounded-lg border border-kp-border px-3 py-2 text-xs text-kp-text hover:bg-kp-surface/60"
          >
            Back to all insights
          </button>
        </div>
      </div>
    );
  }

  if (focusId && focusInsight) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Breadcrumbs
          items={[
            { label: "AI Insights", href: "/dashboard/ai-insights" },
            { label: focusInsight.title.length > 48 ? `${focusInsight.title.slice(0, 48)}…` : focusInsight.title },
          ]}
        />
        <InsightDetailPanel insight={focusInsight} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-xs text-kp-muted">
          Insights update after a successful cluster scan. Issues are marked resolved only when a later scan
          confirms they are gone — not when a cluster is stopped. Refreshing here reloads browser storage only.
        </p>
        <button
          type="button"
          onClick={handleLocalRefresh}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-kp-border px-3 py-2 text-sm text-kp-muted transition-colors hover:border-kp-blue/40 hover:bg-kp-surface/60 hover:text-kp-text disabled:opacity-50"
          title="Reload insights from browser storage (no cluster API calls)"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh list
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto pb-1">
          <FilterPills
            active={severity}
            onChange={(id) => setSeverity(id as SeverityTier)}
            items={[
              { id: "all", label: `All (${counts.all})` },
              { id: "critical", label: `Critical (${counts.critical})` },
              { id: "high", label: `High (${counts.high})` },
              { id: "medium", label: `Medium (${counts.medium})` },
              { id: "info", label: `Info (${counts.info})` },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-kp-muted">
            <input
              type="checkbox"
              checked={showSolved}
              onChange={(e) => setShowSolved(e.target.checked)}
              className="rounded border-kp-border"
            />
            Show solved
          </label>
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-1.5 text-xs text-kp-text transition-colors hover:border-kp-blue/30"
          >
            <option value="">All Clusters</option>
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-1.5 text-xs text-kp-text transition-colors hover:border-kp-blue/30"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface/30 py-16 text-center">
          <p className="text-sm text-kp-muted">
            No insights match your filters. Run a scan from a cluster page to collect findings.
          </p>
        </div>
      ) : (
        <InsightsCatalog items={filtered} onOpen={openFocus} embedded />
      )}

      <p className="text-center text-[10px] text-kp-muted/80">
        {filtered.length > 0 &&
          `Showing ${filtered.length} insight${filtered.length === 1 ? "" : "s"} · newest first · last detected ${formatInsightTime(filtered[0].detectedAt)}`}
      </p>
    </div>
  );
}

export function AiInsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 p-6 text-kp-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading insights…
        </div>
      }
    >
      <InsightsContent />
    </Suspense>
  );
}
