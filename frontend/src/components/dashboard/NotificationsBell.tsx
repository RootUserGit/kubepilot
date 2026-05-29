"use client";

import { AppLink } from "@/components/ui/AppLink";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useInsights } from "@/hooks/useInsights";
import { useClickOutside } from "@/hooks/useClickOutside";
import { SeverityBadge } from "@/components/dashboard/ui/DashboardUi";
import {
  formatInsightTime,
  isBellSeverity,
  loadInsights,
  markInsightRead,
  sortInsightsByRecency,
  toAlertBadgeSeverity,
} from "@/lib/insights-store";

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { unreadBellCount, refresh } = useInsights();

  useClickOutside(ref, () => setOpen(false), open);

  const bellItems = sortInsightsByRecency(
    loadInsights().filter((i) => i.status === "open" && isBellSeverity(i.severity)),
  ).slice(0, 12);

  function openInsight(id: string) {
    markInsightRead(id);
    refresh();
    setOpen(false);
    router.push(`/dashboard/ai-insights?insight=${encodeURIComponent(id)}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-kp-muted hover:bg-kp-surface hover:text-kp-text"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadBellCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {unreadBellCount > 9 ? "9+" : unreadBellCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-xl border border-kp-border bg-kp-surface-elevated shadow-xl sm:w-80">
          <div className="flex items-center justify-between border-b border-kp-border px-4 py-3">
            <h3 className="text-sm font-semibold text-kp-text">
              Insights
              {unreadBellCount > 0 && (
                <span className="ml-1.5 text-xs font-normal text-red-400">{unreadBellCount} unread</span>
              )}
            </h3>
            <AppLink
              href="/dashboard/ai-insights"
              onClick={() => setOpen(false)}
              className="text-xs text-kp-blue-glow hover:underline"
            >
              View all
            </AppLink>
          </div>

          <ul className="max-h-80 overflow-y-auto overscroll-contain">
            {bellItems.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-kp-muted">
                No open critical/high insights. Refresh a cluster to scan.
              </li>
            ) : (
              bellItems.map((item) => {
                const isUnread = !item.readAt;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openInsight(item.id)}
                      className={`flex w-full flex-col gap-1 border-b border-kp-border/50 px-4 py-3 text-left transition-colors hover:bg-kp-surface/80 ${
                        isUnread ? "bg-kp-surface/40" : "opacity-75"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm text-kp-text ${isUnread ? "font-semibold" : ""}`}>
                          {isUnread && (
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />
                          )}
                          {item.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-kp-muted">
                          {formatInsightTime(item.detectedAt)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={toAlertBadgeSeverity(item.severity)} />
                        <span className="text-[10px] text-kp-muted">
                          {item.clusterName} · {item.namespace}/{item.resource}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-kp-border px-4 py-2">
            <AppLink
              href="/dashboard/ai-insights"
              onClick={() => setOpen(false)}
              className="block py-1.5 text-center text-xs font-medium text-kp-blue-glow hover:underline"
            >
              Open AI Insights →
            </AppLink>
          </div>
        </div>
      )}
    </div>
  );
}
