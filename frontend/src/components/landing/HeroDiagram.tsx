import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  DollarSign,
  FileText,
  Gauge,
  Home,
  LayoutDashboard,
  Lock,
  Settings,
  Shield,
} from "lucide-react";

export function HeroDiagram() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-kp-blue/10 blur-3xl pointer-events-none" />
      <div className="relative rounded-2xl border border-kp-border bg-kp-surface/60 p-5 shadow-xl kp-glow-blue backdrop-blur-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] lg:items-stretch">
          <SourcePanel />
          <BoundaryColumn />
          <DashboardPanel />
        </div>
      </div>
    </div>
  );
}

function SourcePanel() {
  return (
    <div className="rounded-xl border border-kp-border bg-kp-bg-deep/90 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-kp-muted">
        Your AWS EKS Environment
      </p>
      <ul className="mt-3 space-y-2.5 text-sm">
        <li className="flex items-start gap-2.5 rounded-lg border border-kp-border/50 bg-kp-surface/40 px-3 py-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-kp-blue-glow" />
          <span>
            <strong className="text-kp-text">Logs</strong>
            <span className="block text-xs text-kp-muted">CloudWatch / Fluent Bit</span>
          </span>
        </li>
        <li className="flex items-start gap-2.5 rounded-lg border border-kp-border/50 bg-kp-surface/40 px-3 py-2">
          <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-kp-green" />
          <span>
            <strong className="text-kp-text">Metrics</strong>
            <span className="block text-xs text-kp-muted">Prometheus / Metrics Server</span>
          </span>
        </li>
        <li className="flex items-start gap-2.5 rounded-lg border border-kp-border/50 bg-kp-surface/40 px-3 py-2">
          <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-kp-purple" />
          <span>
            <strong className="text-kp-text">Cost</strong>
            <span className="block text-xs text-kp-muted">AWS Cost Explorer</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

function BoundaryColumn() {
  return (
    <div className="flex flex-row items-center justify-center gap-2 lg:flex-col lg:py-6">
      <div className="hidden h-px flex-1 bg-gradient-to-r from-transparent via-kp-green/50 to-transparent lg:block lg:h-16 lg:w-px lg:flex-none lg:bg-gradient-to-b" />
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-kp-green/50 bg-kp-green/5 px-3 py-3 text-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kp-green/15 ring-1 ring-kp-green/40">
          <Lock className="h-4 w-4 text-kp-green" />
        </div>
        <span className="max-w-[7rem] text-[9px] font-bold uppercase leading-tight tracking-wider text-kp-green">
          IRSA Read-Only Boundary
        </span>
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-kp-blue/40 via-kp-green/50 to-kp-purple/40 lg:hidden" />
    </div>
  );
}

function DashboardPanel() {
  return (
    <div className="overflow-hidden rounded-xl border border-kp-border bg-kp-bg-deep">
      <div className="border-b border-kp-border/60 bg-kp-surface/50 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-kp-muted">
          KubePilot Platform (Read-Only)
        </p>
      </div>
      <div className="flex min-h-[220px]">
        <aside className="flex w-10 flex-col items-center gap-3 border-r border-kp-border/60 bg-kp-surface/30 py-3">
          <NavIcon icon={Home} active />
          <NavIcon icon={LayoutDashboard} />
          <NavIcon icon={Shield} />
          <NavIcon icon={FileText} />
          <NavIcon icon={Bell} />
          <NavIcon icon={Settings} />
        </aside>
        <div className="flex-1 p-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="AI Insights" value="12 Open" tone="blue" />
            <HealthCard />
            <MetricCard label="Cost Overview" value="₹4,25,000" tone="purple" sub="This month" />
            <MetricCard label="Policy Compliance" value="78%" tone="green" sub="Compliant" />
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-kp-muted">
              Top Alerts
            </p>
            <ul className="mt-1.5 space-y-1">
              <AlertRow text="Pod OOMKilled in payment-service" time="5m ago" />
              <AlertRow text="High CPU on envoy-gateway" time="12m ago" severity="warn" />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavIcon({
  icon: Icon,
  active,
}: {
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-md ${
        active ? "bg-kp-blue/20 text-kp-blue-glow" : "text-kp-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "purple";
  sub?: string;
}) {
  const valueClass =
    tone === "blue"
      ? "text-kp-blue-glow"
      : tone === "green"
        ? "text-kp-green"
        : "text-kp-purple";
  return (
    <div className="rounded-lg border border-kp-border/60 bg-kp-surface/50 p-2">
      <p className="text-[9px] text-kp-muted">{label}</p>
      <p className={`text-sm font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-[9px] text-kp-muted">{sub}</p>}
    </div>
  );
}

function HealthCard() {
  return (
    <div className="rounded-lg border border-kp-border/60 bg-kp-surface/50 p-2">
      <p className="text-[9px] text-kp-muted">Cluster Health</p>
      <p className="text-sm font-bold text-kp-green">82/100</p>
      <div className="mt-1 flex gap-2 text-[8px] text-kp-muted">
        <span>
          <span className="text-kp-green">●</span> 16
        </span>
        <span>
          <span className="text-amber-400">●</span> 2
        </span>
        <span>
          <span className="text-kp-muted">●</span> 0
        </span>
      </div>
    </div>
  );
}

function AlertRow({
  text,
  time,
  severity = "critical",
}: {
  text: string;
  time: string;
  severity?: "critical" | "warn";
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-kp-border/40 bg-kp-surface/30 px-2 py-1 text-[10px]">
      <AlertTriangle
        className={`h-3 w-3 shrink-0 ${severity === "warn" ? "text-amber-400" : "text-red-400"}`}
      />
      <span className="min-w-0 flex-1 truncate text-kp-muted">{text}</span>
      <span className="shrink-0 text-kp-muted">{time}</span>
    </li>
  );
}
