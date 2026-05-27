import { DollarSign } from "lucide-react";
import { KpiCard, Panel, DataTable } from "@/components/dashboard/ui/DashboardUi";

export function CostPage() {
  return (
    <>
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Potential Monthly Savings"
            value="₹1,80,000"
            sub="↑ 18% vs last month"
            subClassName="text-kp-green"
            icon={DollarSign}
            iconClassName="text-kp-green"
          />
          <KpiCard label="Total Monthly Cost" value="₹2,45,000" sub="↑ 6% vs last month" subClassName="text-red-700 dark:text-red-300" />
          <KpiCard label="Waste Percentage" value="34%" sub="Over-provisioned vs usage" />
          <KpiCard label="Rightsizing Opportunities" value="56" sub="Workloads actionable now" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Savings by Cluster">
            <ul className="space-y-3 text-sm">
              {[
                ["prod-eks-apac", "₹48,000", 85],
                ["prod-eks-us", "₹31,000", 65],
                ["staging-eks", "₹18,000", 45],
                ["dev-eks", "₹12,000", 30],
                ["prod-gke", "₹9,000", 22],
              ].map(([name, amt, pct]) => (
                <li key={String(name)} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-kp-text">{name}</span>
                  <div className="h-2 flex-1 rounded-full bg-kp-border">
                    <div className="h-full rounded-full bg-kp-purple" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-kp-muted">{amt}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Cost Breakdown">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-32 w-32 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#0052ff" strokeWidth="12" strokeDasharray="107 238" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#8b5cf6" strokeWidth="12" strokeDasharray="71 238" strokeDashoffset="-107" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" strokeWidth="12" strokeDasharray="36 238" strokeDashoffset="-178" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold text-kp-text">₹2.45L</span>
                  <span className="text-[9px] text-kp-muted">Total</span>
                </div>
              </div>
              <ul className="space-y-1 text-xs text-kp-muted">
                <li>Compute/Nodes · 45%</li>
                <li>Workloads · 30%</li>
                <li>Storage · 15%</li>
                <li>Network · 7%</li>
                <li>Others · 3%</li>
              </ul>
            </div>
          </Panel>
        </div>

        <Panel title="Top Overprovisioned Workloads">
          <DataTable
            columns={["Workload", "Cluster", "CPU Waste", "Memory Waste", "Monthly Impact"]}
            rows={[
              ["payment-service", "prod-eks-apac", "82%", "65%", "₹18,000"],
              ["reporting-api", "prod-eks-us", "78%", "71%", "₹12,000"],
              ["analytics-worker", "staging-eks", "71%", "68%", "₹8,400"],
              ["user-service", "dev-eks", "65%", "55%", "₹4,200"],
            ]}
          />
          <p className="mt-3 text-xs text-kp-muted">
            Phase 1 read-only: click a row to view recommended YAML spec (copy to your IaC repo).
          </p>
        </Panel>
      </div>
    </>
  );
}
