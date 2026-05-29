"use client";

import type { HealthPoint } from "@/lib/health-history";

function tone(
  score: number,
  variant?: "syncing" | "degraded" | "active" | "unknown",
): { stroke: string; fill: string } {
  if (variant === "syncing") return { stroke: "#60a5fa", fill: "rgba(96, 165, 250, 0.2)" };
  if (variant === "degraded") return { stroke: "#fbbf24", fill: "rgba(251, 191, 36, 0.2)" };
  if (score >= 85) return { stroke: "#34d399", fill: "rgba(52, 211, 153, 0.2)" };
  if (score >= 65) return { stroke: "#fbbf24", fill: "rgba(251, 191, 36, 0.2)" };
  return { stroke: "#f87171", fill: "rgba(248, 113, 113, 0.2)" };
}

export function HealthSparkline({
  points,
  score,
  variant,
  width = 72,
  height = 28,
}: {
  points: HealthPoint[];
  score?: number | null;
  variant?: "syncing" | "degraded" | "active" | "unknown";
  width?: number;
  height?: number;
}) {
  const latest = score ?? (points.length ? points[points.length - 1].score : null);
  const { stroke, fill } = tone(latest ?? 50, variant);

  if (points.length < 2) {
    const flatY = height / 2;
    return (
      <svg width={width} height={height} aria-hidden className="shrink-0">
        <path
          d={`M 2 ${flatY} L ${width - 2} ${flatY} L ${width - 2} ${height - 2} L 2 ${height - 2} Z`}
          fill={fill}
        />
        <path d={`M 2 ${flatY} L ${width - 2} ${flatY}`} stroke={stroke} strokeWidth={1.5} fill="none" />
      </svg>
    );
  }

  const vals = points.map((p) => p.score);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const padX = 2;
  const padY = 3;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * innerW;
    const y = padY + innerH - ((p.score - min) / span) * innerH;
    return { x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)},${(height - padY).toFixed(1)} L ${coords[0].x.toFixed(1)},${(height - padY).toFixed(1)} Z`;

  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
