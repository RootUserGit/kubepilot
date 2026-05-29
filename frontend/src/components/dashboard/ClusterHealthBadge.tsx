"use client";

export type ClusterHealthData = {
  health_score: number | null;
  health_status: string;
  health_label: string;
  summary?: string;
  critical_count?: number;
  high_count?: number;
};

const STATUS_STYLES: Record<string, { ring: string; text: string; bar: string }> = {
  healthy: {
    ring: "border-kp-green/50 text-kp-green",
    text: "text-kp-green",
    bar: "bg-kp-green",
  },
  degraded: {
    ring: "border-amber-500/50 text-amber-300",
    text: "text-amber-300",
    bar: "bg-amber-400",
  },
  at_risk: {
    ring: "border-orange-500/50 text-orange-300",
    text: "text-orange-300",
    bar: "bg-orange-400",
  },
  critical: {
    ring: "border-red-500/50 text-red-300",
    text: "text-red-300",
    bar: "bg-red-500",
  },
  unknown: {
    ring: "border-kp-border text-kp-muted",
    text: "text-kp-muted",
    bar: "bg-kp-muted",
  },
};

export function ClusterHealthRing({
  health,
  size = "md",
}: {
  health: ClusterHealthData;
  size?: "sm" | "md" | "lg";
}) {
  const score = health.health_score;
  const status = health.health_status in STATUS_STYLES ? health.health_status : "unknown";
  const styles = STATUS_STYLES[status];
  const dim =
    size === "sm" ? "h-10 w-10 text-xs" : size === "lg" ? "h-20 w-20 text-xl" : "h-14 w-14 text-sm";

  if (score == null) {
    return (
      <div
        className={`flex ${dim} items-center justify-center rounded-full border-2 ${styles.ring}`}
        title={health.summary ?? health.health_label}
      >
        <span className="text-[10px]">—</span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex ${dim} flex-col items-center justify-center rounded-full border-2 ${styles.ring}`}
      title={health.summary ?? health.health_label}
    >
      <span className={`font-bold ${styles.text}`}>{score}%</span>
    </div>
  );
}

export function ClusterHealthBar({ health }: { health: ClusterHealthData }) {
  const score = health.health_score ?? 0;
  const status = health.health_status in STATUS_STYLES ? health.health_status : "unknown";
  const styles = STATUS_STYLES[status];

  return (
    <div className="min-w-[8rem]">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={styles.text}>{health.health_label}</span>
        {health.health_score != null && (
          <span className="font-semibold text-kp-text">{health.health_score}%</span>
        )}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-kp-surface">
        <div
          className={`h-full rounded-full transition-all ${styles.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      {health.summary && (
        <p className="mt-1 line-clamp-1 text-[10px] text-kp-muted">{health.summary}</p>
      )}
    </div>
  );
}
