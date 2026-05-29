import type { ClusterInsightItem } from "@/lib/api";
import { matchesSeverityTier } from "@/lib/insights-store";

const SNAPSHOT_KEY = "kubepilot-risk-snapshots-v1";

export type SeverityCounts = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  info: number;
};

export type SeverityTrend = {
  total: number;
  critical: number;
  high: number;
  medium: number;
};

type StoredSnapshot = SeverityCounts & { at: string };

function loadSnapshots(): Record<string, StoredSnapshot[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredSnapshot[]>;
  } catch {
    return {};
  }
}

function saveSnapshots(all: Record<string, StoredSnapshot[]>): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
}

export function countInsightSeverities(insights: ClusterInsightItem[]): SeverityCounts {
  return {
    total: insights.length,
    critical: insights.filter((i) => matchesSeverityTier(i.severity, "critical")).length,
    high: insights.filter((i) => matchesSeverityTier(i.severity, "high")).length,
    medium: insights.filter((i) => matchesSeverityTier(i.severity, "medium")).length,
    info: insights.filter((i) => matchesSeverityTier(i.severity, "info")).length,
  };
}

/** Persist post-scan counts to compare on the next visit / scan. */
export function recordRiskSnapshot(clusterId: string, counts: SeverityCounts): void {
  if (typeof window === "undefined") return;
  const all = loadSnapshots();
  const prev = all[clusterId] ?? [];
  const next: StoredSnapshot[] = [
    ...prev,
    { ...counts, at: new Date().toISOString() },
  ].slice(-20);
  all[clusterId] = next;
  saveSnapshots(all);
}

export function getPreviousRiskSnapshot(clusterId: string): SeverityCounts | null {
  const history = loadSnapshots()[clusterId] ?? [];
  if (history.length < 2) return null;
  return history[history.length - 2];
}

export function computeSeverityTrend(
  current: SeverityCounts,
  previous: SeverityCounts | null,
): SeverityTrend {
  if (!previous) {
    return { total: 0, critical: 0, high: 0, medium: 0 };
  }
  return {
    total: current.total - previous.total,
    critical: current.critical - previous.critical,
    high: current.high - previous.high,
    medium: current.medium - previous.medium,
  };
}

/** UI grouping aligned with enterprise CNAPP category labels. */
export function resolveRiskCategory(insight: ClusterInsightItem): string {
  const check = (insight.check_id ?? "").toLowerCase();
  if (check === "privileged" || check === "run_as_root") return "Privilege & Access";
  if (check === "latest_tag") return "Image Security";
  if (check.includes("network") || check.includes("ingress")) return "Network";
  if (check.includes("rbac") || check.includes("role")) return "RBAC issues";
  const cat = (insight.category ?? "").toLowerCase();
  if (cat === "security") return "Configuration";
  if (cat === "cost") return "Cost & Resources";
  if (cat === "reliability") return "Reliability";
  return "Configuration";
}

export function countByRiskCategory(
  insights: ClusterInsightItem[],
  limit = 5,
): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const i of insights) {
    const label = resolveRiskCategory(i);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function donutSegments(counts: SeverityCounts): {
  key: "critical" | "high" | "medium";
  label: string;
  count: number;
  pct: number;
  color: string;
}[] {
  const pool = counts.critical + counts.high + counts.medium;
  const items = [
    { key: "critical" as const, label: "Critical", count: counts.critical, color: "#ef4444" },
    { key: "high" as const, label: "High", count: counts.high, color: "#f59e0b" },
    { key: "medium" as const, label: "Medium", count: counts.medium, color: "#eab308" },
  ];
  if (pool === 0) {
    return items.map((i) => ({ ...i, pct: 0 }));
  }
  return items.map((i) => ({ ...i, pct: Math.round((i.count / pool) * 100) }));
}
