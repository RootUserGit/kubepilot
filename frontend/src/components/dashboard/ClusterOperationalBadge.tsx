"use client";

import { CheckCircle2, Loader2, AlertTriangle, HelpCircle } from "lucide-react";
import type { OperationalStatus } from "@/lib/health-history";

const STYLES: Record<
  OperationalStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  active: {
    label: "Active",
    className: "border-kp-green/40 bg-kp-green/10 text-kp-green",
    icon: CheckCircle2,
  },
  syncing: {
    label: "Syncing",
    className: "border-kp-blue/40 bg-kp-blue/10 text-kp-blue-glow",
    icon: Loader2,
  },
  degraded: {
    label: "Degraded",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    icon: AlertTriangle,
  },
  unknown: {
    label: "Unknown",
    className: "border-kp-border bg-kp-surface/50 text-kp-muted",
    icon: HelpCircle,
  },
};

export function ClusterOperationalBadge({ status }: { status: OperationalStatus }) {
  const s = STYLES[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.className}`}
    >
      <Icon className={`h-3 w-3 ${status === "syncing" ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
}
