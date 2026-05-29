import type { ClusterInsightItem } from "@/lib/api";

export type InsightStatus = "open" | "solved" | "removed";

/** Set only when a successful live scan no longer reports the finding. */
export type InsightResolution = "confirmed_absent" | null;

export type StoredInsight = {
  id: string;
  clusterId: string;
  clusterName: string;
  title: string;
  severity: string;
  category: string;
  namespace: string;
  resourceKind: string;
  resourceName: string;
  resource: string;
  detail: string | null;
  remediation: string | null;
  checkId: string;
  relatedPods: string[];
  containerName: string | null;
  findingType: string;
  disposition?: string;
  suppressionReason?: string | null;
  references?: { title: string; url: string }[];
  rawSeverity?: string | null;
  status: InsightStatus;
  resolution: InsightResolution;
  readAt: string | null;
  detectedAt: string;
  solvedAt: string | null;
  resolvedAtScan: string | null;
  updatedAt: string;
};

export type SyncInsightsOptions = {
  /** When true, open findings missing from this scan are marked solved (successful scan only). */
  markAbsentAsSolved?: boolean;
  /** collected_at from the successful scan that confirmed resolution. */
  scanCollectedAt?: string | null;
};

/** Stable key when insight id algorithm changes between scans. */
export function insightFingerprint(
  namespace: string,
  resourceKind: string,
  resourceName: string,
  checkId: string,
  containerName?: string | null,
): string {
  return `${namespace}|${resourceKind}|${resourceName}|${checkId}|${containerName ?? ""}`;
}

const STORAGE_KEY = "kubepilot-insights-v1";
const LEGACY_ALERT_KEY = "kubepilot-alerts-v2";
export const INSIGHTS_CHANGED_EVENT = "kubepilot-insights-changed";

export type SeverityTier = "all" | "critical" | "high" | "medium" | "info";

export type UiSeverity = "critical" | "warning" | "info";

export function matchesSeverityTier(severity: string, tier: SeverityTier): boolean {
  if (tier === "all") return true;
  const s = severity.toLowerCase();
  if (tier === "critical") return s === "critical";
  if (tier === "high") return s === "high";
  if (tier === "medium") return s === "medium" || s === "warning";
  if (tier === "info") return s === "low" || s === "info";
  return true;
}

export function toUiSeverity(severity: string): UiSeverity {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "high") return "critical";
  if (s === "medium" || s === "warning") return "warning";
  return "info";
}

export function toAlertBadgeSeverity(
  severity: string,
): "critical" | "high" | "warning" | "medium" | "info" {
  const s = severity.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium" || s === "warning") return "medium";
  return "info";
}

export function categoryLabel(category: string): string {
  const c = category.toLowerCase();
  if (c === "cost") return "Cost Optimization";
  if (c === "security") return "Security";
  if (c === "reliability") return "Performance";
  if (c === "scaling") return "Scaling";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Bell: high + critical open insights only. */
export function isBellSeverity(severity: string): boolean {
  const s = severity.toLowerCase();
  return s === "critical" || s === "high";
}

/** Milliseconds for newest-first ordering (solved items use solvedAt). */
export function insightRecencyMs(item: StoredInsight): number {
  const iso = item.status === "solved" && item.solvedAt ? item.solvedAt : item.detectedAt;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function sortInsightsByRecency(items: StoredInsight[]): StoredInsight[] {
  return [...items].sort((a, b) => insightRecencyMs(b) - insightRecencyMs(a));
}

function normalize(raw: Partial<StoredInsight> & { createdAt?: string }): StoredInsight {
  const detectedAt = raw.detectedAt ?? raw.createdAt ?? new Date().toISOString();
  return {
    id: raw.id ?? "",
    clusterId: raw.clusterId ?? "",
    clusterName: raw.clusterName ?? "",
    title: raw.title ?? "",
    severity: raw.severity ?? "low",
    category: raw.category ?? "reliability",
    namespace: raw.namespace ?? "default",
    resourceKind: raw.resourceKind ?? "Pod",
    resourceName: raw.resourceName ?? "",
    resource: raw.resource ?? "",
    detail: raw.detail ?? null,
    remediation: raw.remediation ?? null,
    checkId: raw.checkId ?? "",
    relatedPods: raw.relatedPods ?? [],
    containerName: raw.containerName ?? null,
    findingType: raw.findingType ?? "misconfiguration",
    status: raw.status ?? "open",
    resolution: raw.resolution ?? null,
    readAt: raw.readAt ?? null,
    detectedAt,
    solvedAt: raw.solvedAt ?? null,
    resolvedAtScan: raw.resolvedAtScan ?? null,
    updatedAt: raw.updatedAt ?? detectedAt,
  };
}

export function isConfirmedSolved(item: StoredInsight): boolean {
  return item.status === "solved" && item.resolution === "confirmed_absent";
}

/** One-time cleanup for insights marked solved without a confirmed scan. */
export function reopenUnconfirmedSolvedInsights(): void {
  const items = loadInsights();
  const now = new Date().toISOString();
  let changed = false;
  const next = items.map((item) => {
    if (item.status === "solved" && item.resolution !== "confirmed_absent") {
      changed = true;
      return {
        ...item,
        status: "open" as const,
        resolution: null,
        solvedAt: null,
        resolvedAtScan: null,
        updatedAt: now,
      };
    }
    return item;
  });
  if (changed) saveInsights(next);
}

export function loadInsights(): StoredInsight[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_ALERT_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as Array<Record<string, unknown>>;
        const migrated = (Array.isArray(parsed) ? parsed : []).map((a) =>
          normalize({
            ...a,
            clusterId: String(a.clusterId ?? ""),
            clusterName: String(a.clusterName ?? ""),
            resourceKind: String(a.resourceKind ?? "Pod"),
            resourceName: String(a.resourceName ?? ""),
            checkId: String(a.checkId ?? ""),
            findingType: "misconfiguration",
            status: "open",
            detectedAt: String(a.detectedAt ?? a.createdAt ?? ""),
            solvedAt: null,
          } as StoredInsight),
        );
        saveInsights(migrated);
        return sortInsightsByRecency(migrated);
      }
      return [];
    }
    const parsed = JSON.parse(raw) as StoredInsight[];
    return sortInsightsByRecency((Array.isArray(parsed) ? parsed : []).map(normalize));
  } catch {
    return [];
  }
}

function saveInsights(items: StoredInsight[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(INSIGHTS_CHANGED_EVENT));
}

export function syncInsightsFromCluster(
  clusterId: string,
  clusterName: string,
  insights: ClusterInsightItem[],
  options: SyncInsightsOptions = {},
): void {
  const markAbsentAsSolved = options.markAbsentAsSolved ?? false;
  const scanCollectedAt = options.scanCollectedAt ?? null;
  const existing = loadInsights();
  const byId = new Map(existing.map((i) => [i.id, i]));
  const now = new Date().toISOString();
  const activeIds = new Set(insights.map((i) => i.id));

  // Re-open items that were auto-solved without a confirmed successful scan (e.g. cluster went down).
  if (!markAbsentAsSolved) {
    for (const item of byId.values()) {
      if (item.clusterId !== clusterId) continue;
      if (item.status === "solved" && item.resolution !== "confirmed_absent") {
        byId.set(item.id, {
          ...item,
          status: "open",
          resolution: null,
          solvedAt: null,
          resolvedAtScan: null,
          updatedAt: now,
        });
      }
    }
  }

  for (const i of insights) {
    const fp = insightFingerprint(
      i.namespace,
      i.resource_kind,
      i.resource_name,
      i.check_id,
      i.container_name,
    );
    let prev = byId.get(i.id);
    for (const [oldId, item] of byId.entries()) {
      if (item.clusterId !== clusterId || oldId === i.id) continue;
      const itemFp = insightFingerprint(
        item.namespace,
        item.resourceKind,
        item.resourceName,
        item.checkId,
        item.containerName,
      );
      if (itemFp === fp) {
        if (!prev) prev = item;
        byId.delete(oldId);
      }
    }
    byId.set(i.id, normalize({
      id: i.id,
      clusterId,
      clusterName,
      title: i.title,
      severity: i.severity,
      category: i.category,
      namespace: i.namespace,
      resourceKind: i.resource_kind,
      resourceName: i.resource_name,
      resource: `${i.resource_kind}/${i.resource_name}`,
      detail: i.detail,
      remediation: i.remediation,
      checkId: i.check_id,
      relatedPods: i.related_pods,
      containerName: i.container_name,
      findingType: i.finding_type ?? "misconfiguration",
      disposition: i.disposition,
      suppressionReason: i.suppression_reason,
      references: i.references,
      rawSeverity: i.raw_severity,
      status: "open",
      resolution: null,
      readAt: prev?.readAt ?? null,
      detectedAt: prev?.detectedAt ?? now,
      solvedAt: null,
      resolvedAtScan: null,
      updatedAt: now,
    }));
  }

  if (markAbsentAsSolved) {
    for (const item of byId.values()) {
      if (item.clusterId !== clusterId) continue;
      if (activeIds.has(item.id)) continue;
      if (item.status === "open") {
        byId.set(item.id, {
          ...item,
          status: "solved",
          resolution: "confirmed_absent",
          solvedAt: now,
          resolvedAtScan: scanCollectedAt,
          updatedAt: now,
        });
      }
    }
  }

  const merged = sortInsightsByRecency([...byId.values()]);
  saveInsights(merged);
}

export function markInsightRead(id: string): void {
  const items = loadInsights();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  items[idx] = { ...items[idx], readAt: new Date().toISOString() };
  saveInsights(items);
}

export function getUnreadBellCount(): number {
  return loadInsights().filter(
    (i) => i.status === "open" && !i.readAt && isBellSeverity(i.severity),
  ).length;
}

export function getInsightById(id: string): StoredInsight | undefined {
  return loadInsights().find((i) => i.id === id);
}

export function getUniqueClusters(): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const i of loadInsights()) {
    if (!seen.has(i.clusterId)) seen.set(i.clusterId, i.clusterName);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatInsightTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleString();
}

export function countByUiSeverity(items: StoredInsight[], includeSolved = false): Record<UiSeverity | "all", number> {
  const pool = includeSolved ? items : items.filter((i) => i.status === "open");
  return {
    all: pool.length,
    critical: pool.filter((i) => toUiSeverity(i.severity) === "critical").length,
    warning: pool.filter((i) => toUiSeverity(i.severity) === "warning").length,
    info: pool.filter((i) => toUiSeverity(i.severity) === "info").length,
  };
}

/** Per-tier counts aligned with cluster Findings panel (Critical / High / Medium / Info). */
export function countBySeverityTier(
  items: StoredInsight[],
  options?: { includeSolved?: boolean },
): Record<SeverityTier, number> {
  const pool = options?.includeSolved ? items : items.filter((i) => i.status === "open");
  return {
    all: pool.length,
    critical: pool.filter((i) => matchesSeverityTier(i.severity, "critical")).length,
    high: pool.filter((i) => matchesSeverityTier(i.severity, "high")).length,
    medium: pool.filter((i) => matchesSeverityTier(i.severity, "medium")).length,
    info: pool.filter((i) => matchesSeverityTier(i.severity, "info")).length,
  };
}

export function storedInsightToFindingRow(item: StoredInsight): {
  id: string;
  title: string;
  severity: string;
  category: string;
  namespace: string;
  resourceKind: string;
  resourceName: string;
  findingType?: string;
} {
  return {
    id: item.id,
    title: item.title,
    severity: item.severity,
    category: item.category,
    namespace: item.namespace,
    resourceKind: item.resourceKind,
    resourceName: item.resourceName,
    findingType: item.findingType,
  };
}

// Re-export legacy names used during migration
export const ALERTS_CHANGED_EVENT = INSIGHTS_CHANGED_EVENT;
export const syncInsightsToAlerts = syncInsightsFromCluster;
export const loadAlerts = loadInsights;
export type StoredAlert = StoredInsight;
