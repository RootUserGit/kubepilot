"use client";

type Point = { t: string; v: number };

function pathFor(points: Point[], width: number, height: number, pad: number): string {
  if (points.length === 0) return "";
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return points
    .map((p, i) => {
      const x = pad + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
      const y = pad + innerH - ((p.v - min) / span) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function ClusterTimeSeriesChart({
  series,
  label,
  unit,
  emptyHint,
}: {
  series: Point[];
  label: string;
  unit: string;
  emptyHint: string;
}) {
  const w = 480;
  const h = 120;
  const pad = 8;
  const d = pathFor(series, w, h, pad);
  const latest = series.length ? series[series.length - 1].v : null;

  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-kp-muted">{emptyHint}</p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs text-kp-muted">{label}</span>
        {latest != null && (
          <span className="text-sm font-semibold text-kp-text">
            {latest.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-28 w-full text-kp-blue-glow"
        role="img"
        aria-label={`${label} over time`}
      >
        <defs>
          <linearGradient id="ts-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {d && (
          <>
            <path d={`${d} L${w - pad},${h - pad} L${pad},${h - pad} Z`} fill="url(#ts-fill)" />
            <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <p className="mt-1 text-[10px] text-kp-muted">
        {series.length} sample{series.length === 1 ? "" : "s"}
        {series.length > 1 && (
          <>
            {" "}
            · {new Date(series[0].t).toLocaleTimeString()} –{" "}
            {new Date(series[series.length - 1].t).toLocaleTimeString()}
          </>
        )}
      </p>
    </div>
  );
}
