"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { FilterPills, Panel, SeverityBadge, Tag } from "@/components/dashboard/ui/DashboardUi";
import {
  categoryLabel,
  formatInsightTime,
  isConfirmedSolved,
  matchesSeverityTier,
  type SeverityTier,
  type StoredInsight,
  toAlertBadgeSeverity,
} from "@/lib/insights-store";

function insightCardClass(severity: string, solved: boolean): string {
  if (solved) {
    return "border-emerald-500/35 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10";
  }
  const s = severity.toLowerCase();
  if (s === "critical") return "border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10";
  if (s === "high") return "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10";
  if (s === "medium") return "border-yellow-500/25 bg-yellow-500/5 hover:border-yellow-500/40 hover:bg-yellow-500/10";
  return "border-kp-border/50 bg-kp-surface/30 hover:border-kp-blue/35 hover:bg-kp-surface/50";
}

export function InsightsCatalog({
  items,
  onOpen,
  embedded = false,
}: {
  items: StoredInsight[];
  onOpen: (item: StoredInsight) => void;
  /** When true, omit outer panel and duplicate severity filters (parent provides filters). */
  embedded?: boolean;
}) {
  const [severityFilter, setSeverityFilter] = useState<SeverityTier>("all");

  const counts = useMemo(
    () => ({
      all: items.length,
      critical: items.filter((i) => matchesSeverityTier(i.severity, "critical")).length,
      high: items.filter((i) => matchesSeverityTier(i.severity, "high")).length,
      medium: items.filter((i) => matchesSeverityTier(i.severity, "medium")).length,
      info: items.filter((i) => matchesSeverityTier(i.severity, "info")).length,
    }),
    [items],
  );

  const filtered = useMemo(
    () => items.filter((i) => matchesSeverityTier(i.severity, severityFilter)),
    [items, severityFilter],
  );

  const list = (
    <>
      {!embedded && (
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
      )}
      <div className={embedded ? "" : "mt-3"}>
        {(embedded ? items : filtered).length === 0 ? (
          <p className="text-xs text-kp-muted">No insights match this filter.</p>
        ) : (
          <ul className="max-h-[min(60vh,520px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {(embedded ? items : filtered).map((item) => {
              const solved = isConfirmedSolved(item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-150 ${insightCardClass(item.severity, solved)}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {solved ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : null}
                      <SeverityBadge severity={toAlertBadgeSeverity(item.severity)} label={item.severity} />
                      {solved && (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          Solved
                        </span>
                      )}
                      <span className="text-[10px] font-medium uppercase tracking-wide text-kp-muted">
                        {categoryLabel(item.category)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-kp-text">{item.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Tag>{item.clusterName}</Tag>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-kp-muted">
                      {item.namespace}/{item.resourceKind}/{item.resourceName}
                    </p>
                    <p className="mt-2 text-[10px] text-kp-muted">
                      Detected {formatInsightTime(item.detectedAt)}
                      {solved && item.solvedAt && (
                        <span className="text-emerald-400/90">
                          {" "}
                          · Resolved {formatInsightTime(item.solvedAt)}
                        </span>
                      )}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div>{list}</div>;
  }

  return (
    <Panel title="Insights" action={<span className="text-[10px] text-kp-muted">{filtered.length} shown</span>}>
      {list}
    </Panel>
  );
}
