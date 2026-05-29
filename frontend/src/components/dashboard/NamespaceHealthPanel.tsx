"use client";

import type { NamespaceHealthItem } from "@/lib/api";

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 65) return "text-amber-300";
  return "text-red-300";
}

export function NamespaceHealthPanel({
  items,
  worstNamespace,
  compact = false,
  className = "",
}: {
  items: NamespaceHealthItem[];
  worstNamespace?: { name: string; health_score: number } | null;
  compact?: boolean;
  className?: string;
}) {
  if (!items.length) {
    return (
      <p className={`text-xs text-kp-muted ${className}`}>
        Namespace health appears after a full-cluster scan.
      </p>
    );
  }

  const shown = compact ? items.slice(0, 5) : items;

  return (
    <div className={`space-y-3 ${className}`}>
      {worstNamespace && (
        <p className="text-xs text-kp-muted">
          Worst namespace:{" "}
          <span className={`font-medium ${scoreClass(worstNamespace.health_score)}`}>
            {worstNamespace.name} ({worstNamespace.health_score})
          </span>
          <span className="ml-2 text-[10px] text-kp-muted/80" title="Headline score is pod-weighted average across namespaces">
            · hybrid scoring
          </span>
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-kp-border/60">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="border-b border-kp-border/50 bg-kp-surface/50 text-kp-muted">
              <th className="px-3 py-2 font-medium">Namespace</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {!compact && <th className="px-3 py-2 font-medium">Findings</th>}
              <th className="px-3 py-2 font-medium">Pods</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.namespace} className="border-b border-kp-border/30 last:border-0">
                <td className="px-3 py-2 font-mono text-kp-text">{row.namespace}</td>
                <td className={`px-3 py-2 font-semibold ${scoreClass(row.health_score)}`}>
                  {row.health_score}
                </td>
                <td className="px-3 py-2 text-kp-muted">{row.health_label}</td>
                {!compact && (
                  <td className="px-3 py-2 text-kp-muted">
                    {row.critical_count > 0 && <span className="text-red-300">{row.critical_count} crit </span>}
                    {row.high_count > 0 && <span className="text-amber-300">{row.high_count} high </span>}
                    {row.medium_count > 0 && <span>{row.medium_count} med </span>}
                    {row.critical_count + row.high_count + row.medium_count === 0 && "—"}
                  </td>
                )}
                <td className="px-3 py-2 text-kp-muted">{row.workload_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {compact && items.length > 5 && (
        <p className="text-[10px] text-kp-muted">+{items.length - 5} more namespaces on cluster detail</p>
      )}
    </div>
  );
}
