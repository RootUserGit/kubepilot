import { PageHeader, PrimaryButton } from "@/components/dashboard/ui/DashboardUi";
import { BrandLogo } from "@/components/integrations/BrandLogo";

const INTEGRATIONS = [
  { name: "AWS", sync: "2 mins. ago" },
  { name: "Prometheus", sync: "1 min. ago" },
  { name: "Grafana", sync: "3 mins. ago" },
  { name: "Slack", sync: "Just now" },
  { name: "Datadog", sync: "5 mins. ago" },
  { name: "Microsoft Teams", sync: "4 mins. ago" },
  { name: "GitHub", sync: "8 mins. ago" },
  { name: "Jira", sync: "12 mins. ago" },
] as const;

export function IntegrationsPage() {
  return (
    <>
      <PageHeader action={<PrimaryButton>Add Integration</PrimaryButton>} />
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
        {INTEGRATIONS.map((item) => (
          <div
            key={item.name}
            className="flex flex-col rounded-xl border border-kp-border bg-kp-surface/40 p-5 text-center transition-colors hover:border-kp-blue/30 hover:bg-kp-surface/60"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-kp-border/60 bg-white p-2.5 shadow-sm">
              <BrandLogo name={item.name} className="h-9 w-9" />
            </div>
            <h3 className="mt-3 font-semibold text-kp-text">{item.name}</h3>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-kp-green">
              <span className="h-2 w-2 rounded-full bg-kp-green kp-pulse" />
              Connected
            </p>
            <p className="mt-1 text-[10px] text-kp-muted">Last sync: {item.sync}</p>
            <button
              type="button"
              className="mt-4 rounded-lg border border-kp-border px-3 py-1.5 text-xs text-kp-text hover:bg-kp-surface"
            >
              Manage
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
