import Link from "next/link";
import { LineChart, Search, Shield, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroDiagram } from "./HeroDiagram";

const pillars = [
  {
    icon: Search,
    title: "Diagnose Faster.",
    description:
      "Trace 5xx errors and connection drops during infrastructure shifts, like routing traffic through our Envoy Gateway on EKS, without manual log grepping.",
    color: "text-kp-blue-glow bg-kp-blue/10 ring-kp-blue/30",
  },
  {
    icon: Wallet,
    title: "Track Your Team's Costs.",
    description:
      "View exactly how much your namespaces cost the company each month based on allocated limits.",
    color: "text-kp-green bg-kp-green/10 ring-kp-green/30",
  },
  {
    icon: Shield,
    title: "Pass Security Audits.",
    description:
      "Ensure your deployments meet internal baseline policies before the security team flags them.",
    color: "text-kp-purple bg-kp-purple/10 ring-kp-purple/30",
  },
];

export function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden kp-grid-bg">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-kp-blue/[0.07] via-transparent to-transparent" />
        <div className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-kp-blue/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-kp-green/40 bg-kp-green/10 px-3 py-1 text-xs font-medium text-kp-green">
                <span className="h-1.5 w-1.5 rounded-full bg-kp-green kp-pulse" />
                Internal Platform • Read-Only Intelligence
              </span>
              <h1 className="kp-page-title mt-6 sm:text-5xl lg:text-[3.25rem]">
                Operational Intelligence for our EKS Fleet.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-kp-muted">
                Correlate logs, track resource limits, and diagnose pod crashes instantly.
                Strictly read-only access to ensure your production workloads remain untouched.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button href="/login" icon={<LineChart className="h-4 w-4" />}>
                  Access KubePilot
                </Button>
              </div>
            </div>
            <HeroDiagram />
          </div>
        </div>
      </section>

      <section className="border-t border-kp-border/60 bg-kp-bg-deep py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-2xl border border-kp-border/80 bg-kp-surface/30 p-8 sm:p-10 lg:p-12">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold text-kp-text sm:text-3xl">Why Use KubePilot?</h2>
              <p className="mt-3 text-kp-muted">
                Internal feature pillars built for engineering self-service, production safety,
                and audit readiness.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {pillars.map((pillar) => (
                <article
                  key={pillar.title}
                  className="rounded-xl border border-kp-border bg-kp-bg-deep/50 p-6 transition-colors hover:border-kp-blue/30"
                >
                  <div className={`inline-flex rounded-full p-3 ring-1 ${pillar.color}`}>
                    <pillar.icon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-kp-text">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-kp-muted">{pillar.description}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/features"
                className="text-sm font-medium text-kp-blue-glow transition-colors hover:underline"
              >
                Explore platform architecture & capabilities →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-kp-border/60 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold text-kp-text sm:text-3xl">
            Ready to diagnose faster on our EKS fleet?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-kp-muted">
            Sign in with your corporate account. All access is read-only via IRSA—your workloads
            stay untouched.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button href="/login" icon={<LineChart className="h-4 w-4" />}>
              Access KubePilot
            </Button>
            <Button href="/contact" variant="secondary">
              Contact the platform team
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
