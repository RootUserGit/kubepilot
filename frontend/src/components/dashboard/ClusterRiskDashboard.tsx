"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ClusterInsightItem } from "@/lib/api";
import {
  computeSeverityTrend,
  countByRiskCategory,
  countInsightSeverities,
  donutSegments,
  getPreviousRiskSnapshot,
} from "@/lib/risk-analytics";
import { Panel } from "@/components/dashboard/ui/DashboardUi";

function TrendHint({ delta, invertGood = false }: { delta: number; invertGood?: boolean }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-kp-muted">
        <Minus className="h-3 w-3" /> no change vs last scan
      </span>
    );
  }
  const improved = invertGood ? delta < 0 : delta > 0;
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] ${improved ? "text-emerald-400" : "text-kp-muted"}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta)} vs last scan
    </span>
  );
}

function RiskKpiCard({
  label,
  value,
  valueClassName = "text-kp-text",
  trend,
  invertTrend,
}: {
  label: string;
  value: number;
  valueClassName?: string;
  trend: number;
  invertTrend?: boolean;
}) {
  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface/50 p-4 transition-all duration-150 hover:border-kp-blue/25 hover:bg-kp-surface/70">
      <p className="text-xs text-kp-muted">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${valueClassName}`}>{value}</p>
      <div className="mt-2">
        <TrendHint delta={trend} invertGood={invertTrend} />
      </div>
    </div>
  );
}

function SeverityDonut({
  segments,
  centerTotal,
}: {
  segments: ReturnType<typeof donutSegments>;
  centerTotal: number;
}) {
  const size = 120;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const pool = segments.reduce((s, x) => s + x.count, 0);

  let offset = 0;
  const arcs =
    pool === 0
      ? [{ d: "", color: "#374151", count: 1 }]
      : segments
          .filter((s) => s.count > 0)
          .map((s) => {
            const len = (s.count / pool) * circ;
            const dash = `${len} ${circ - len}`;
            const o = offset;
            offset += len;
            return { dash, offset: o, color: s.color, key: s.key };
          });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-kp-border/60"
          />
          {pool === 0 ? (
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="#374151"
              strokeWidth={stroke}
              strokeDasharray={`${circ * 0.25} ${circ * 0.75}`}
            />
          ) : (
            arcs.map((a) => (
              <circle
                key={a.key}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={stroke}
                strokeDasharray={a.dash}
                strokeDashoffset={-a.offset}
                strokeLinecap="butt"
                className="transition-all duration-300"
              />
            ))
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-kp-text">{centerTotal}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-xs">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-kp-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums text-kp-text">
              {s.count}{" "}
              <span className="text-kp-muted">({pool > 0 ? s.pct : 0}%)</span>
            </span>
          </li>
        ))}
        {centerTotal > segments.reduce((n, s) => n + s.count, 0) && (
          <li className="flex items-center justify-between gap-3 text-kp-muted">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500/80" />
              Info / Low
            </span>
            <span className="tabular-nums">
              {centerTotal - segments.reduce((n, s) => n + s.count, 0)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

function CategoryBars({ categories }: { categories: { label: string; count: number }[] }) {
  const max = Math.max(1, ...categories.map((c) => c.count));
  if (categories.length === 0) {
    return <p className="text-xs text-kp-muted">No findings yet. Run a cluster scan.</p>;
  }
  return (
    <ul className="space-y-3">
      {categories.map((cat) => (
        <li key={cat.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-kp-text">{cat.label}</span>
            <span className="tabular-nums text-kp-muted">{cat.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-kp-border/50">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${(cat.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ClusterRiskDashboard({
  insights,
  clusterId,
  loading,
}: {
  insights: ClusterInsightItem[];
  clusterId: string;
  loading?: boolean;
}) {
  const counts = useMemo(() => countInsightSeverities(insights), [insights]);
  const previous = useMemo(() => getPreviousRiskSnapshot(clusterId), [clusterId, insights]);
  const trend = useMemo(() => computeSeverityTrend(counts, previous), [counts, previous]);
  const segments = useMemo(() => donutSegments(counts), [counts]);
  const categories = useMemo(() => countByRiskCategory(insights), [insights]);

  const donutTotal = counts.critical + counts.high + counts.medium;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RiskKpiCard
          label="Total risks"
          value={counts.total}
          trend={trend.total}
          invertTrend
        />
        <RiskKpiCard
          label="Critical"
          value={counts.critical}
          valueClassName="text-red-400"
          trend={trend.critical}
          invertTrend
        />
        <RiskKpiCard
          label="High"
          value={counts.high}
          valueClassName="text-amber-400"
          trend={trend.high}
          invertTrend
        />
        <RiskKpiCard
          label="Medium"
          value={counts.medium}
          valueClassName="text-yellow-300"
          trend={trend.medium}
          invertTrend
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Risk by severity">
          {loading && insights.length === 0 ? (
            <p className="text-xs text-kp-muted">Scanning…</p>
          ) : counts.total === 0 ? (
            <p className="text-xs text-kp-muted">No risks detected in the last scan.</p>
          ) : (
            <SeverityDonut segments={segments} centerTotal={donutTotal || counts.total} />
          )}
        </Panel>
        <Panel title="Top risk categories">
          {loading && insights.length === 0 ? (
            <p className="text-xs text-kp-muted">Scanning…</p>
          ) : (
            <CategoryBars categories={categories} />
          )}
        </Panel>
      </div>
    </div>
  );
}
