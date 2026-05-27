"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart3, ExternalLink, Sparkles } from "lucide-react";
import {
  DataTable,
  FilterPills,
  PageHeader,
  PrimaryButton,
  SeverityBadge,
} from "@/components/dashboard/ui/DashboardUi";

const CLUSTERS = [
  {
    slug: "prod-eks-envoy-gateway",
    name: "prod-eks-envoy-gateway",
    env: "production",
    provider: "AWS EKS",
    region: "ap-south-1",
    health: 98,
    status: "active",
    dot: "healthy",
  },
  {
    slug: "prod-eks-apac",
    name: "prod-eks-apac",
    env: "production",
    provider: "AWS EKS",
    region: "ap-southeast-1",
    health: 82,
    status: "active",
    dot: "healthy",
  },
  {
    slug: "staging-eks-main",
    name: "staging-eks-main",
    env: "staging",
    provider: "AWS EKS",
    region: "us-east-1",
    health: 88,
    status: "active",
    dot: "healthy",
  },
  {
    slug: "dev-eks-analytics",
    name: "dev-eks-analytics",
    env: "development",
    provider: "AWS EKS",
    region: "ap-south-1",
    health: 64,
    status: "degraded",
    dot: "warning",
  },
];

const envBadge: Record<string, string> = {
  production: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  staging: "bg-kp-blue/15 text-kp-blue-glow border-kp-blue/30",
  development: "bg-kp-green/15 text-kp-green border-kp-green/30",
};

export function ClustersPage() {
  const [filter, setFilter] = useState("all");

  const filtered = CLUSTERS.filter((c) => {
    if (filter === "all") return true;
    if (filter === "production") return c.env === "production";
    if (filter === "staging") return c.env === "staging";
    if (filter === "development") return c.env === "development";
    return true;
  });

  return (
    <>
      <PageHeader
        action={<PrimaryButton href="/dashboard/clusters/register">Register Cluster</PrimaryButton>}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <input
          type="search"
          placeholder="Search clusters by name, region, or provider…"
          className="w-full rounded-lg border border-kp-border bg-kp-bg-deep px-4 py-2.5 text-sm text-kp-text placeholder:text-kp-muted/60 focus:border-kp-blue focus:outline-none"
        />
        <FilterPills
          active={filter}
          onChange={setFilter}
          items={[
            { id: "all", label: "All (12)" },
            { id: "production", label: "Production (4)" },
            { id: "staging", label: "Staging (2)" },
            { id: "development", label: "Development (4)" },
          ]}
        />
        <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-2 sm:p-4">
          <DataTable
            columns={["Cluster", "Environment", "Provider", "Region", "Health", "Status", "Actions"]}
            rows={filtered.map((c) => [
              <Link
                key={c.slug}
                href={`/dashboard/clusters/${c.slug}`}
                className="flex items-center gap-2 font-medium text-kp-blue-glow hover:underline"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    c.dot === "healthy"
                      ? "bg-kp-green"
                      : c.dot === "warning"
                        ? "bg-amber-400"
                        : "bg-red-400"
                  }`}
                />
                {c.name}
              </Link>,
              <span
                key={`env-${c.slug}`}
                className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${envBadge[c.env]}`}
              >
                {c.env}
              </span>,
              c.provider,
              c.region,
              <span
                key={`h-${c.slug}`}
                className={c.health >= 90 ? "text-kp-green" : c.health >= 70 ? "text-amber-400" : "text-red-400"}
              >
                {c.health}/100
              </span>,
              <SeverityBadge
                key={`s-${c.slug}`}
                severity={c.status === "degraded" ? "warning" : "healthy"}
              />,
              <div key={`a-${c.slug}`} className="flex gap-2 text-kp-muted">
                <BarChart3 className="h-4 w-4 hover:text-kp-text" />
                <ExternalLink className="h-4 w-4 hover:text-kp-text" />
                <Sparkles className="h-4 w-4 hover:text-kp-blue-glow" />
              </div>,
            ])}
          />
        </div>
      </div>
    </>
  );
}
