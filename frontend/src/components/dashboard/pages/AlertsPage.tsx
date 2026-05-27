"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FilterPills,
  PageHeader,
  SeverityBadge,
} from "@/components/dashboard/ui/DashboardUi";
import { NOTIFICATION_ALERTS } from "@/lib/notifications";

function AlertsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("alert");
  const [severity, setSeverity] = useState("all");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const alerts = NOTIFICATION_ALERTS.map((a) => [a.title, a.severity, a.cluster, a.resource, a.time, a.id] as const);

  const filtered = alerts.filter((a) => severity === "all" || a[1] === severity);

  useEffect(() => {
    if (highlightId && rowRefs.current[highlightId]) {
      rowRefs.current[highlightId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId]);

  return (
    <>
      <PageHeader
        action={
          <select className="rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-1.5 text-xs text-kp-text">
            <option>Last 24 Hours</option>
            <option>Last 7 Days</option>
          </select>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <FilterPills
          active={severity}
          onChange={setSeverity}
          items={[
            { id: "all", label: "All (14)" },
            { id: "critical", label: "Critical (4)" },
            { id: "warning", label: "Warning (4)" },
            { id: "info", label: "Info (2)" },
          ]}
        />
        <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-2 sm:p-4">
          <table className="min-w-[640px] w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-kp-border text-kp-muted">
              <tr>
                {["Alert", "Severity", "Cluster", "Resource", "Time"].map((col) => (
                  <th key={col} className="px-4 py-2 font-medium whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(([name, sev, cluster, resource, time, id]) => (
                <tr
                  key={id}
                  ref={(el) => {
                    rowRefs.current[id] = el;
                  }}
                  className={`border-b border-kp-border/50 transition-colors hover:bg-kp-surface/30 ${
                    highlightId === id ? "bg-kp-blue/10 ring-1 ring-inset ring-kp-blue/40" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-kp-text">{name}</td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={sev as "critical" | "warning" | "info"} />
                  </td>
                  <td className="px-4 py-3 text-kp-muted">{cluster}</td>
                  <td className="px-4 py-3 text-kp-muted">{resource}</td>
                  <td className="px-4 py-3 text-kp-muted">{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function AlertsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-kp-muted">Loading alerts…</div>}>
      <AlertsContent />
    </Suspense>
  );
}
