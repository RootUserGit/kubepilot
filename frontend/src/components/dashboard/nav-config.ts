export const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": {
    title: "Organization Overview",
    subtitle: "Real-time overview of your Kubernetes environment",
  },
  "/dashboard/clusters": {
    title: "Clusters",
    subtitle: "Health, status, and inventory across environments",
  },
  "/dashboard/clusters/register": {
    title: "Register Cluster",
    subtitle: "Connect a new EKS cluster with the read-only KubePilot agent",
  },
  "/dashboard/ai-insights": {
    title: "AI Insights",
    subtitle: "Intelligent correlation across all your clusters",
  },
  "/dashboard/security": {
    title: "Security Overview",
    subtitle: "Read-only posture audit across connected environments",
  },
  "/dashboard/cost": {
    title: "Cost Optimization",
    subtitle: "FinOps intelligence · spend correlated with K8s limits",
  },
  "/dashboard/governance": {
    title: "Governance",
    subtitle: "Policy compliance & organizational guardrails",
  },
  "/dashboard/reports": {
    title: "Reports",
    subtitle: "Generate and manage reports",
  },
  "/dashboard/integrations": {
    title: "Integrations",
    subtitle: "Manage your integrations",
  },
  "/dashboard/settings": {
    title: "Settings",
    subtitle: "Profile & platform preferences",
  },
  "/dashboard/assistant": {
    title: "AI Assistant",
    subtitle: "Ask anything about your Kubernetes environment",
  },
};

export function resolvePageMeta(pathname: string) {
  if (pathname === "/dashboard/clusters/register") {
    return PAGE_META["/dashboard/clusters/register"];
  }
  if (pathname.startsWith("/dashboard/clusters/")) {
    const slug = pathname.split("/").pop() ?? "cluster";
    const isClusterId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    return {
      title: isClusterId ? "Cluster details" : slug,
      subtitle: "Live inventory and workload insights",
    };
  }
  return PAGE_META[pathname] ?? { title: "KubePilot", subtitle: undefined };
}

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", match: (p: string) => p === "/dashboard" },
  {
    href: "/dashboard/clusters",
    label: "Clusters",
    match: (p: string) => p.startsWith("/dashboard/clusters"),
  },
  {
    href: "/dashboard/ai-insights",
    label: "AI Insights",
    match: (p: string) => p === "/dashboard/ai-insights",
  },
  {
    href: "/dashboard/security",
    label: "Security",
    match: (p: string) => p === "/dashboard/security",
  },
  { href: "/dashboard/cost", label: "Cost", match: (p: string) => p === "/dashboard/cost" },
  {
    href: "/dashboard/governance",
    label: "Governance",
    match: (p: string) => p === "/dashboard/governance",
  },
  { href: "/dashboard/reports", label: "Reports", match: (p: string) => p === "/dashboard/reports" },
  {
    href: "/dashboard/integrations",
    label: "Integrations",
    match: (p: string) => p === "/dashboard/integrations",
  },
] as const;
