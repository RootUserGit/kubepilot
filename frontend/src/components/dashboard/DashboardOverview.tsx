import { AlertTriangle, ArrowUpRight, DollarSign, Server, ShieldCheck, TrendingUp } from "lucide-react";
import { ClusterSummaryTable, TotalClustersKpi } from "@/components/dashboard/ClusterSummaryTable";

const kpis = [
  {
    label: "Healthy Nodes",
    value: "94%",
    sub: "of total nodes",
    icon: ShieldCheck,
    iconColor: "text-kp-green",
  },
  {
    label: "Critical Alerts",
    value: "4",
    sub: "Needs attention",
    valueColor: "text-red-400",
    icon: AlertTriangle,
    iconColor: "text-red-400",
  },
  {
    label: "Estimated Waste",
    value: "$2,450",
    sub: "Monthly",
    icon: DollarSign,
    iconColor: "text-amber-400",
  },
];

export function DashboardOverview() {
  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TotalClustersKpi />
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-kp-border bg-kp-surface/40 p-4"
          >
            <div className="flex items-start justify-between">
              <p className="text-xs text-kp-muted">{kpi.label}</p>
              <kpi.icon className={`h-4 w-4 ${kpi.iconColor ?? "text-kp-muted"}`} />
            </div>
            <p className={`mt-2 text-2xl font-bold ${kpi.valueColor ?? "text-kp-text"}`}>
              {kpi.value}
            </p>
            <p className={`mt-0.5 text-xs ${kpi.subColor ?? "text-kp-muted"}`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-kp-border bg-kp-surface/40 p-5">
          <h2 className="font-semibold text-kp-text">Cluster Health Summary</h2>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <DonutChart />
            <div className="space-y-2 text-sm">
              <HealthLegend color="#10b981" label="Healthy" pct="78%" count="9 clusters" />
              <HealthLegend color="#f59e0b" label="Warning" pct="16%" count="2 clusters" />
              <HealthLegend color="#ef4444" label="Critical" pct="6%" count="1 cluster" />
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <ClusterSummaryTable />
          </div>
        </section>

        <section className="rounded-xl border border-kp-border bg-kp-surface/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-kp-text">AI Insights Live Feed</h2>
            <span className="text-[10px] text-kp-muted">Real-time AI synthesized insights</span>
          </div>
          <div className="mt-4 space-y-3">
            <InsightCard
              severity="critical"
              title="prod-eks — payment-service"
              body="OOMKilled loops detected. Memory usage 1.82 Gi / 1.00 Gi limit exceeded repeatedly in the last 15 minutes."
              tags={["Log Excerpts", "HPA Events", "Metrics"]}
              action
            />
            <InsightCard
              severity="warning"
              title="Over-provisioning across 3 clusters"
              body="Rightsizing recommended. Potential savings $1,240/month from high CPU and memory requests vs actual usage."
              tags={["Cost Explorer", "Metrics Sampler"]}
            />
            <InsightCard
              severity="info"
              title="New suspicious activity blocked"
              body="12 blocked API calls to kube-apiserver from unauthorized service accounts in the last hour."
              tags={["Audit Logs", "RBAC"]}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function DonutChart() {
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" className="stroke-kp-border" strokeWidth="12" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#10b981"
          strokeWidth="12"
          strokeDasharray="196 251"
          strokeLinecap="round"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="12"
          strokeDasharray="40 251"
          strokeDashoffset="-196"
          strokeLinecap="round"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#ef4444"
          strokeWidth="12"
          strokeDasharray="15 251"
          strokeDashoffset="-236"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-kp-text">12</span>
        <span className="text-[10px] text-kp-muted">Total Clusters</span>
      </div>
    </div>
  );
}

function HealthLegend({
  color,
  label,
  pct,
  count,
}: {
  color: string;
  label: string;
  pct: string;
  count: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-kp-text">{label}</span>
      <span className="text-kp-muted">{pct}</span>
      <span className="text-kp-muted">· {count}</span>
    </div>
  );
}

function HealthPill({ health }: { health: string }) {
  const styles: Record<string, string> = {
    healthy: "bg-kp-green/15 text-kp-green border-kp-green/30",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    critical: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${styles[health] ?? styles.healthy}`}
    >
      {health}
    </span>
  );
}

function InsightCard({
  severity,
  title,
  body,
  tags,
  action,
}: {
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  tags: string[];
  action?: boolean;
}) {
  const border: Record<string, string> = {
    critical: "border-red-500/40",
    warning: "border-amber-500/40",
    info: "border-kp-blue/40",
  };
  const badge: Record<string, string> = {
    critical: "bg-red-500/20 text-red-800 dark:text-red-300",
    warning: "kp-badge-warning",
    info: "bg-kp-blue/20 text-kp-blue-glow",
  };

  return (
    <div className={`rounded-lg border bg-kp-bg-deep/50 p-4 ${border[severity]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${badge[severity]}`}
          >
            {severity}
          </span>
          <h3 className="mt-1 text-sm font-semibold text-kp-text">{title}</h3>
        </div>
        <TrendingUp className="h-4 w-4 shrink-0 text-kp-muted" />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-kp-muted">{body}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className="rounded bg-kp-surface px-1.5 py-0.5 text-[10px] text-kp-muted">
            {t}
          </span>
        ))}
      </div>
      {action && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-kp-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-kp-blue/90"
        >
          Investigate with KubePilot
          <ArrowUpRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
