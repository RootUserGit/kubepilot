"use client";

import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import {
  FilterPills,
  SeverityBadge,
  Tag,
} from "@/components/dashboard/ui/DashboardUi";

const INSIGHTS = [
  {
    severity: "critical" as const,
    text: "checkout-service in prod-eks-apac is experiencing repeated OOMKills.",
    cluster: "prod-eks-apac",
    category: "Performance",
    time: "2m ago",
  },
  {
    severity: "warning" as const,
    text: "22 workloads are over-provisioned across 5 clusters.",
    cluster: "Multiple",
    category: "Cost Optimization",
    time: "15m ago",
  },
  {
    severity: "warning" as const,
    text: "No network policies in 5 namespaces (3 clusters).",
    cluster: "Multiple",
    category: "Security",
    time: "32m ago",
  },
  {
    severity: "info" as const,
    text: "High CPU throttling detected in analytics namespace.",
    cluster: "staging-eks",
    category: "Performance",
    time: "1h ago",
  },
  {
    severity: "info" as const,
    text: "5 container images running with 'latest' tag.",
    cluster: "dev-eks",
    category: "Security",
    time: "2h ago",
  },
];

export function AiInsightsPage() {
  const [severity, setSeverity] = useState("all");

  const rows = INSIGHTS.filter((i) => severity === "all" || i.severity === severity);

  return (
    <>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterPills
            active={severity}
            onChange={setSeverity}
            items={[
              { id: "all", label: "All" },
              { id: "critical", label: "Critical" },
              { id: "warning", label: "Warning" },
              { id: "info", label: "Info" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <select className="rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-1.5 text-xs text-kp-text">
              <option>All Clusters</option>
              <option>prod-eks-apac</option>
              <option>staging-eks</option>
            </select>
            <select className="rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-1.5 text-xs text-kp-text">
              <option>All Categories</option>
              <option>Performance</option>
              <option>Cost Optimization</option>
              <option>Security</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <button
              key={i}
              type="button"
              className="w-full rounded-xl border border-kp-border bg-kp-surface/40 p-4 text-left transition-colors hover:border-kp-blue/30 hover:bg-kp-surface/60"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  {row.severity === "critical" ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                  ) : row.severity === "warning" ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                  ) : (
                    <Info className="h-5 w-5 shrink-0 text-kp-blue-glow" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={row.severity} />
                    </div>
                    <p className="mt-1 text-sm text-kp-text">{row.text}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Tag>{row.cluster}</Tag>
                      <Tag>{row.category}</Tag>
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-kp-muted">{row.time}</span>
              </div>
              <p className="mt-3 text-xs text-kp-blue-glow">View Evidence & Root Cause →</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
