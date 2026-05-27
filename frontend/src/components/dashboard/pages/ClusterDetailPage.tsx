"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, Shield, XCircle } from "lucide-react";
import { KpiCard, PageHeader, Panel, PrimaryButton } from "@/components/dashboard/ui/DashboardUi";

const TABS = ["Overview", "Workloads", "Nodes", "Namespaces", "Resources", "Events", "Security", "Cost", "Settings"];

export function ClusterDetailPage({ slug }: { slug: string }) {
  const [tab, setTab] = useState("Overview");
  const displayName = slug.replace(/-/g, " ");

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-kp-border px-3 py-1.5 text-xs text-kp-muted hover:text-kp-text"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-kp-border px-3 py-1.5 text-xs text-kp-text hover:bg-kp-surface"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View in AWS Console
            </button>
          </div>
        }
      />
      <div className="border-b border-kp-border px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto pb-px">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                tab === t
                  ? "border-kp-blue text-kp-text"
                  : "border-transparent text-kp-muted hover:text-kp-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-kp-green/40 bg-kp-green/10 px-3 py-1 text-xs text-kp-green">
          <span className="h-2 w-2 rounded-full bg-kp-green kp-pulse" />
          Healthy
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Health Score" value="82 / 100" sub="7d avg · trending up" valueClassName="text-kp-green" />
          <KpiCard label="Nodes" value="18" sub="16 Ready · 2 Not Ready" />
          <KpiCard label="Namespaces" value="42" sub="39 Active" />
          <KpiCard label="Workloads" value="287" sub="168 Deploy · 19 STS · 12 DS" />
          <KpiCard label="Pods" value="1,284" sub="1,187 Running · 3 Failed" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Resource Utilization (24h)">
            <div className="flex gap-2 text-xs">
              {["CPU", "Memory", "Pods"].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`rounded px-2 py-1 ${m === "CPU" ? "bg-kp-blue/20 text-kp-text" : "text-kp-muted"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-4 h-32 rounded-lg border border-kp-border bg-kp-bg-deep flex items-end justify-around px-2 pb-2">
              {[38, 42, 35, 55, 48, 62, 58, 45, 40, 38, 42, 36].map((h, i) => (
                <div
                  key={i}
                  className="w-[6%] rounded-t bg-kp-blue/60"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <ul className="mt-4 space-y-1 text-xs text-kp-muted">
              <li>CPU Usage (Avg): <span className="text-kp-text">38%</span></li>
              <li>CPU Request (Avg): <span className="text-kp-text">62%</span></li>
              <li>Pod Usage (Std): <span className="text-kp-text">12%</span></li>
            </ul>
          </Panel>

          <Panel title="AI Summary">
            <p className="text-center text-sm text-kp-text">
              Cluster is generally healthy but 3 areas need attention.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-2 text-kp-muted">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                High restart rate in payment-service pods
              </li>
              <li className="flex gap-2 text-kp-muted">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                32 workloads are overprovisioned
              </li>
              <li className="flex gap-2 text-kp-muted">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-kp-purple" />
                No network policies in 5 namespaces
              </li>
            </ul>
            <div className="mt-4">
              <PrimaryButton href="/dashboard/reports">View Full AI Report</PrimaryButton>
            </div>
          </Panel>
        </div>

        <p className="text-xs text-kp-muted">
          Viewing <span className="text-kp-text">{displayName}</span> · read-only · no mutations from
          KubePilot
        </p>
      </div>
    </>
  );
}
