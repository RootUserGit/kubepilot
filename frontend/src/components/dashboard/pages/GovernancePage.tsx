import { KpiCard, Panel, DataTable, SeverityBadge } from "@/components/dashboard/ui/DashboardUi";

export function GovernancePage() {
  return (
    <>
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Policy Compliance" value="78%" sub="↑ 6% vs last week" subClassName="text-kp-green" />
          <KpiCard label="Total Policies" value="42" sub="37 passed · 5 failed" />
          <KpiCard label="Violations" value="23" sub="↓ 4 vs last week" valueClassName="text-red-400" />
          <KpiCard label="Exceptions" value="3" sub="No change" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Compliance Trend (30d)">
            <div className="h-40 rounded-lg border border-kp-border bg-kp-bg-deep p-2">
              <svg viewBox="0 0 300 120" className="h-full w-full" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  points="0,90 30,85 60,80 90,75 120,70 150,65 180,60 210,55 240,50 270,45 300,40"
                />
                <polygon
                  fill="url(#grad)"
                  points="0,90 30,85 60,80 90,75 120,70 150,65 180,60 210,55 240,50 270,45 300,40 300,120 0,120"
                  opacity="0.2"
                />
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </Panel>
          <Panel title="Policy Status">
            <div className="flex items-center gap-6">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="12" strokeDasharray="210 251" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="12" strokeDasharray="41 251" strokeDashoffset="-210" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-kp-text">42</span>
                  <span className="text-[9px] text-kp-muted">Total</span>
                </div>
              </div>
              <ul className="text-xs text-kp-muted space-y-1">
                <li className="text-kp-green">Passed · 37 (88%)</li>
                <li className="text-red-400">Failed · 5 (12%)</li>
                <li>Not Evaluated · 0</li>
              </ul>
            </div>
          </Panel>
        </div>

        <Panel title="Top Policy Violations">
          <DataTable
            columns={["Policy", "Violations", "Clusters", "Severity", "Last Seen"]}
            rows={[
              ["Pods must set resource limits", "7", "prod-eks-apac", <SeverityBadge key="1" severity="high" />, "10m ago"],
              ["Images must not use latest tag", "6", "Multiple", <SeverityBadge key="2" severity="high" />, "15m ago"],
              ["Network policies must be defined", "5", "staging-eks", <SeverityBadge key="3" severity="high" />, "2h ago"],
              ["Pods must run as non-root", "3", "prod-eks-us", <SeverityBadge key="4" severity="medium" />, "3h ago"],
              ["Secrets should not be in configmaps", "2", "dev-eks", <SeverityBadge key="5" severity="medium" />, "5h ago"],
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
