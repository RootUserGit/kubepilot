import Link from "next/link";
import { KpiCard, Panel, DataTable, SeverityBadge } from "@/components/dashboard/ui/DashboardUi";

export function SecurityPage() {
  return (
    <>
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Risks" value="27" sub="↓ 5 vs yesterday" subClassName="text-kp-green" />
          <KpiCard label="Critical" value="7" sub="↑ 2 vs yesterday" valueClassName="text-red-400" />
          <KpiCard label="High" value="12" sub="↑ 1 vs yesterday" valueClassName="text-amber-400" />
          <KpiCard label="Medium" value="8" sub="↑ 2 vs yesterday" valueClassName="text-yellow-300" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Risk by Severity">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-36 w-36 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="14" strokeDasharray="65 251" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray="110 251" strokeDashoffset="-65" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#eab308" strokeWidth="14" strokeDasharray="76 251" strokeDashoffset="-175" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-kp-text">27</div>
              </div>
              <ul className="space-y-1 text-xs text-kp-muted">
                <li><span className="text-red-400">Critical</span> · 7 (26%)</li>
                <li><span className="text-amber-400">High</span> · 12 (44%)</li>
                <li><span className="text-yellow-300">Medium</span> · 8 (30%)</li>
              </ul>
            </div>
          </Panel>
          <Panel title="Top Risk Categories">
            <ul className="space-y-2 text-sm">
              {[
                ["Privilege & Access", 6],
                ["Network", 5],
                ["Image Security", 4],
                ["Configuration", 4],
                ["RBAC issues", 3],
              ].map(([label, count]) => (
                <li key={String(label)} className="flex items-center gap-2">
                  <div className="h-2 flex-1 max-w-[120px] rounded-full bg-kp-border">
                    <div className="h-full rounded-full bg-kp-purple" style={{ width: `${Number(count) * 15}%` }} />
                  </div>
                  <span className="text-kp-text">{label}</span>
                  <span className="text-kp-muted">{count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel
          title="Top Security Risks"
          action={
            <Link href="#" className="text-xs text-kp-blue-glow hover:underline">
              View all risks →
            </Link>
          }
        >
          <DataTable
            columns={["Risk", "Severity", "Cluster", "Resource", "Detected"]}
            rows={[
              ["Container running as root", <SeverityBadge key="1" severity="critical" />, "prod-eks-apac", "payment-service", "10m ago"],
              ["Privileged container detected", <SeverityBadge key="2" severity="critical" />, "prod-eks-us", "istio-proxy", "25m ago"],
              ["No network policies", <SeverityBadge key="3" severity="high" />, "staging-eks", "payments", "1h ago"],
              ["Latest tag used in deployment", <SeverityBadge key="4" severity="high" />, "dev-eks", "user-service", "2h ago"],
              ["HostPath mount detected", <SeverityBadge key="5" severity="medium" />, "prod-gke", "legacy-app", "3h ago"],
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
