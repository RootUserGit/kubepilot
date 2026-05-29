const STORAGE_KEY = "kubepilot-health-history-v1";

export type HealthPoint = { score: number; at: string };

export function loadHealthHistory(): Record<string, HealthPoint[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, HealthPoint[]>;
  } catch {
    return {};
  }
}

export function recordHealthPoint(clusterId: string, score: number | null): HealthPoint[] {
  if (score == null) return loadHealthHistory()[clusterId] ?? [];
  const all = loadHealthHistory();
  const prev = all[clusterId] ?? [];
  const next = [...prev, { score, at: new Date().toISOString() }].slice(-12);
  all[clusterId] = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return next;
}

export function getHealthHistory(clusterId: string): HealthPoint[] {
  return loadHealthHistory()[clusterId] ?? [];
}

export type OperationalStatus = "syncing" | "active" | "degraded" | "unknown";

export function resolveOperationalStatus(options: {
  scanning: boolean;
  healthScore: number | null;
  healthStatus: string | null;
  history: HealthPoint[];
}): OperationalStatus {
  if (options.scanning) return "syncing";
  if (options.healthScore == null) return "unknown";
  const hist = options.history;
  if (hist.length >= 2) {
    const prev = hist[hist.length - 2]?.score;
    const cur = hist[hist.length - 1]?.score ?? options.healthScore;
    if (prev != null && cur < prev - 8) return "degraded";
  }
  const st = options.healthStatus ?? "";
  if (st === "critical" || st === "at_risk") return "degraded";
  if (st === "degraded") return "degraded";
  return "active";
}
