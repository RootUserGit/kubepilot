"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertDetailPanel } from "@/components/dashboard/AlertDetailPanel";
import { FilterPills, PageHeader, Panel, SeverityBadge } from "@/components/dashboard/ui/DashboardUi";
import { useAlerts } from "@/hooks/useAlerts";
import {
  countBySeverityTier,
  formatAlertTime,
  getUniqueClusterNames,
  markAlertRead,
  matchesSeverityTier,
  toAlertBadgeSeverity,
  type SeverityTier,
  type StoredAlert,
} from "@/lib/alert-store";

function AlertsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusAlertId = searchParams.get("alert");
  const clusterParam = searchParams.get("cluster") ?? "";
  const severityParam = (searchParams.get("severity") as SeverityTier | null) ?? "all";

  const [severity, setSeverity] = useState<SeverityTier>(
    severityParam && ["all", "critical", "high", "medium", "info"].includes(severityParam)
      ? severityParam
      : "all",
  );
  const [clusterFilter, setClusterFilter] = useState(clusterParam);
  const { alerts, refresh } = useAlerts();

  const focusAlert = focusAlertId ? alerts.find((a) => a.id === focusAlertId) : undefined;
  const clusters = useMemo(() => getUniqueClusterNames(), [alerts]);

  useEffect(() => {
    if (focusAlertId) {
      markAlertRead(focusAlertId);
      refresh();
    }
  }, [focusAlertId, refresh]);

  useEffect(() => {
    setClusterFilter(clusterParam);
  }, [clusterParam]);

  const scopedAlerts = useMemo(() => {
    return alerts.filter((a) => !clusterFilter || a.clusterId === clusterFilter);
  }, [alerts, clusterFilter]);

  const filtered = useMemo(() => {
    return scopedAlerts.filter((a) => matchesSeverityTier(a.severity, severity));
  }, [scopedAlerts, severity]);

  const counts = useMemo(() => countBySeverityTier(scopedAlerts), [scopedAlerts]);

  function setCluster(id: string) {
    setClusterFilter(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("cluster", id);
    else params.delete("cluster");
    router.replace(`/dashboard/alerts?${params.toString()}`, { scroll: false });
  }

  function clearFocus() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("alert");
    router.replace(`/dashboard/alerts?${params.toString()}`, { scroll: false });
  }

  if (focusAlertId && focusAlert) {
    return (
      <>
        <PageHeader
          action={
            <button
              type="button"
              onClick={clearFocus}
              className="text-xs text-kp-blue-glow hover:underline"
            >
              ← All alerts
            </button>
          }
        />
        <div className="space-y-4 p-4 sm:p-6">
          <AlertDetailPanel alert={focusAlert} />
          <p className="text-center text-xs text-kp-muted">
            <button type="button" onClick={clearFocus} className="text-kp-blue-glow hover:underline">
              View all alerts
            </button>
          </p>
        </div>
      </>
    );
  }

  if (focusAlertId && !focusAlert) {
    return (
      <div className="space-y-4 p-6">
        <Panel title="Alert not found">
          <p className="text-sm text-kp-muted">This alert may have been cleared after a cluster refresh.</p>
          <Link href="/dashboard/alerts" className="mt-3 inline-block text-sm text-kp-blue-glow hover:underline">
            Back to alerts
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        action={
          <label className="flex items-center gap-2 text-xs text-kp-muted">
            Cluster
            <select
              value={clusterFilter}
              onChange={(e) => setCluster(e.target.value)}
              className="max-w-[12rem] rounded-lg border border-kp-border bg-kp-surface px-2 py-1.5 text-xs text-kp-text"
            >
              <option value="">All clusters</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        {scopedAlerts.length === 0 ? (
          <Panel title="No alerts yet">
            <p className="text-sm text-kp-muted">
              Open a registered cluster and refresh its summary. Lint findings sync here automatically.
            </p>
          </Panel>
        ) : (
          <>
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
            <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-2 sm:p-4">
              <table className="min-w-[640px] w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-kp-border text-kp-muted">
                  <tr>
                    {["Alert", "Severity", "Cluster", "Resource", "Detected"].map((col) => (
                      <th key={col} className="px-4 py-2 font-medium whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-kp-muted">
                        No alerts match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((alert) => (
                      <AlertTableRow
                        key={alert.id}
                        alert={alert}
                        onOpen={() =>
                          router.push(
                            `/dashboard/alerts?alert=${encodeURIComponent(alert.id)}${clusterFilter ? `&cluster=${clusterFilter}` : ""}`,
                          )
                        }
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function AlertTableRow({ alert, onOpen }: { alert: StoredAlert; onOpen: () => void }) {
  const isUnread = !alert.readAt;
  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer border-b border-kp-border/50 transition-colors hover:bg-kp-surface/30 ${
        isUnread ? "" : "opacity-80"
      }`}
    >
      <td className="px-4 py-3 text-kp-text">
        <span className="flex items-center gap-2">
          {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />}
          <span className={isUnread ? "font-medium" : ""}>{alert.title}</span>
        </span>
      </td>
      <td className="px-4 py-3">
        <SeverityBadge severity={toAlertBadgeSeverity(alert.severity)} label={alert.severity} />
      </td>
      <td className="px-4 py-3 text-kp-muted">{alert.clusterName}</td>
      <td className="px-4 py-3 font-mono text-[11px] text-kp-muted">
        {alert.namespace}/{alert.resource}
      </td>
      <td className="px-4 py-3 text-kp-muted">{formatAlertTime(alert.detectedAt)}</td>
    </tr>
  );
}

export function AlertsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-kp-muted">Loading alerts…</div>}>
      <AlertsContent />
    </Suspense>
  );
}
