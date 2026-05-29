import { CodeTerminal } from "@/components/ui/CodeTerminal";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";

const CLUSTER_ROLE_YAML = `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubepilot-readonly
rules:
  - apiGroups: ["", "apps", "batch", "autoscaling", "metrics.k8s.io"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]`;

const finOpsRows = [
  { team: "payments", spend: "₹8,40,000", waste: "₹2,10,000", pct: 85 },
  { team: "customer-platform", spend: "₹6,20,000", waste: "₹1,55,000", pct: 70 },
  { team: "analytics", spend: "₹4,90,000", waste: "₹98,000", pct: 55 },
  { team: "infra-core", spend: "₹3,10,000", waste: "₹62,000", pct: 40 },
];

export function FeaturesPage() {
  return (
    <div className="kp-grid-bg">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <PublicPageHeader
          title="Platform Architecture & Capabilities"
          description="An interactive blueprint of KubePilot's non-mutating architecture, data privacy controls, and FinOps intelligence layer."
        />

        <div className="grid gap-8 lg:grid-cols-2">
          <section
            id="architecture"
            className="kp-card"
          >
            <span className="text-xs font-bold text-kp-blue-glow">01</span>
            <h2 className="mt-1 text-xl font-bold text-kp-text">
              VPC-Isolated AI Pipeline. Your Data Stays Local.
            </h2>
            <p className="mt-2 text-sm text-kp-muted">
              All data processing, redaction, and AI inference happens inside your AWS account.
            </p>

            <div className="mt-6 rounded-lg border border-dashed border-kp-blue/40 bg-kp-bg-deep p-4">
              <p className="text-center text-[10px] font-bold uppercase tracking-wider text-kp-blue-glow">
                AWS VPC Boundary (Your Account)
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PipelineBox title="Inputs">
                  <li>OpenSearch Logs</li>
                  <li>Metric Sampler</li>
                  <li>Kubernetes API (Read)</li>
                </PipelineBox>
                <PipelineBox title="Processing">
                  <li className="font-mono text-[11px] text-kp-warning">
                    Deterministic Redaction Pipeline
                  </li>
                  <li className="font-mono text-[11px] text-kp-muted">
                    Bearer eyJ… → [REDACTED]
                  </li>
                  <li className="font-mono text-[11px] text-kp-muted">
                    AKIA… → [REDACTED]
                  </li>
                  <li>Localized LLM Stack (vLLM/TGI)</li>
                </PipelineBox>
                <PipelineBox title="Outputs">
                  <li>Root Cause Analysis</li>
                  <li>Impact Assessment</li>
                  <li>Recommendations</li>
                  <li>Citations & Evidence</li>
                </PipelineBox>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-kp-blue/30 bg-kp-blue/10 p-4 text-sm text-kp-text">
              Your logs never leave our private AWS network. All tokens and secrets are
              deterministically redacted before entering the context window.
            </div>
          </section>

          <section className="kp-card">
            <span className="text-xs font-bold text-kp-blue-glow">02</span>
            <h2 className="mt-1 text-xl font-bold text-kp-text">
              FinOps Layer: Connecting Spend to Limits.
            </h2>
            <p className="mt-2 text-sm text-kp-muted">
              We correlate AWS spend with Kubernetes resource limits to surface waste and attribute
              costs to the right teams.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
              <FlowChip label="AWS Cost Explorer" value="₹24,50,000" />
              <span className="text-kp-muted">→</span>
              <FlowChip label="Resource Limits" value="PostgreSQL" />
              <span className="text-kp-muted">→</span>
              <FlowChip label="Correlation Engine" value="Internal" />
            </div>

            <div className="mt-6 overflow-hidden rounded-lg border border-kp-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-kp-bg-deep text-xs uppercase text-kp-muted">
                  <tr>
                    <th className="px-4 py-2">Namespace/Team</th>
                    <th className="px-4 py-2">Monthly Spend</th>
                    <th className="px-4 py-2">Calculated Waste</th>
                  </tr>
                </thead>
                <tbody>
                  {finOpsRows.map((row) => (
                    <tr key={row.team} className="border-t border-kp-border/60">
                      <td className="px-4 py-2 font-medium text-kp-text">{row.team}</td>
                      <td className="px-4 py-2 text-kp-muted">{row.spend}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 max-w-[100px] rounded-full bg-kp-border">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-kp-purple to-kp-blue"
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className="text-kp-purple">{row.waste}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-lg border border-kp-green/30 bg-kp-green/10 p-4">
              <p className="text-xs text-kp-muted">Total Potential Savings</p>
              <p className="text-2xl font-bold text-kp-green">₹6,63,000</p>
              <p className="text-xs text-kp-muted">27% of total spend · Confidence 87% (High)</p>
            </div>
          </section>
        </div>

        <section
          id="security"
          className="kp-card mt-8 border-kp-green/30 kp-glow-green"
        >
          <span className="text-xs font-bold text-kp-green">03</span>
          <h2 className="mt-1 text-xl font-bold text-kp-text">
            Strictly Read-Only Permissions. Non-Mutating Agent.
          </h2>
          <p className="mt-2 text-sm text-kp-muted">
            KubePilot uses a locked-down IRSA role and read-only ClusterRole. No write access.
            Ever.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <CodeTerminal
              code={CLUSTER_ROLE_YAML}
              title="ClusterRole — read-only"
              language="yaml"
            />
            <div className="space-y-4">
              <ul className="space-y-2 text-sm text-kp-muted">
                <li className="flex items-start gap-2">
                  <span className="text-kp-green">✓</span> Only get, list, watch verbs allowed
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-kp-green">✓</span> No create, update, patch, delete
                  permissions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-kp-green">✓</span> No mutating webhooks
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-kp-green">✓</span> All data access is audited and logged
                </li>
              </ul>
              <div className="rounded-lg border border-kp-green/50 bg-kp-green/10 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-kp-green">
                Verified Read-Only: No Create, Update, Patch, Delete.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PipelineBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-kp-border bg-kp-surface p-3">
      <p className="text-xs font-semibold text-kp-text">{title}</p>
      <ul className="mt-2 space-y-1 text-xs text-kp-muted">{children}</ul>
    </div>
  );
}

function FlowChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-kp-border bg-kp-surface px-3 py-2 text-center">
      <p className="font-medium text-kp-text">{label}</p>
      <p className="text-kp-muted">{value}</p>
    </div>
  );
}
