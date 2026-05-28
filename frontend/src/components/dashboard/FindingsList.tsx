"use client";

import { useMemo, useState } from "react";
import { FilterPills, Panel, SeverityBadge } from "@/components/dashboard/ui/DashboardUi";
import {
  matchesSeverityTier,
  toAlertBadgeSeverity,
  type SeverityTier,
} from "@/lib/insights-store";

export type FindingRow = {
  id: string;
  title: string;
  severity: string;
  category: string;
  namespace: string;
  resourceKind: string;
  resourceName: string;
  findingType?: string;
  disposition?: string;
};

function findingCardClass(severity: string): string {
  if (matchesSeverityTier(severity, "critical")) {
    return "border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10";
  }
  if (matchesSeverityTier(severity, "high")) {
    return "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10";
  }
  if (matchesSeverityTier(severity, "medium")) {
    return "border-yellow-500/25 bg-yellow-500/5 hover:border-yellow-500/40 hover:bg-yellow-500/10";
  }
  return "border-kp-border/50 bg-kp-surface/30 hover:border-kp-blue/35 hover:bg-kp-surface/50";
}

export function countFindingsByTier(items: FindingRow[]): Record<SeverityTier, number> {
  return {
    all: items.length,
    critical: items.filter((i) => matchesSeverityTier(i.severity, "critical")).length,
    high: items.filter((i) => matchesSeverityTier(i.severity, "high")).length,
    medium: items.filter((i) => matchesSeverityTier(i.severity, "medium")).length,
    info: items.filter((i) => matchesSeverityTier(i.severity, "info")).length,
  };
}

export function FindingsList({
  items,
  loading = false,
  onOpen,
  title = "Findings",
  emptyMessage = "No findings for this severity.",
  className = "",
}: {
  items: FindingRow[];
  loading?: boolean;
  onOpen: (item: FindingRow) => void;
  title?: string;
  emptyMessage?: string;
  className?: string;
}) {
  const [severityFilter, setSeverityFilter] = useState<SeverityTier>("all");

  const counts = useMemo(() => countFindingsByTier(items), [items]);
  const filtered = useMemo(
    () => items.filter((i) => matchesSeverityTier(i.severity, severityFilter)),
    [items, severityFilter],
  );

  return (
    <div className={className}>
      <Panel title={title} action={<span className="text-[10px] text-kp-muted">{filtered.length} shown</span>}>
        <FilterPills
          active={severityFilter}
          onChange={(id) => setSeverityFilter(id as SeverityTier)}
          items={[
            { id: "all", label: `All (${counts.all})` },
            { id: "critical", label: `Critical (${counts.critical})` },
            { id: "high", label: `High (${counts.high})` },
            { id: "medium", label: `Medium (${counts.medium})` },
            { id: "info", label: `Info (${counts.info})` },
          ]}
        />
        <div className="mt-3">
          {loading && items.length === 0 ? (
            <p className="text-xs text-kp-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-kp-muted">{emptyMessage}</p>
          ) : (
            <ul className="max-h-[min(60vh,520px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-150 ${findingCardClass(item.severity)}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={toAlertBadgeSeverity(item.severity)} label={item.severity} />
                      <span className="text-[10px] font-medium uppercase tracking-wide text-kp-muted">
                        {item.category}
                      </span>
                      {item.findingType === "behavioral" && (
                        <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-medium text-purple-300">
                          Runtime
                        </span>
                      )}
                      {item.disposition === "accepted_system_requirement" && (
                        <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">
                          Accepted risk
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-kp-text">{item.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-kp-muted">
                      {item.namespace}/{item.resourceKind}/{item.resourceName}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
