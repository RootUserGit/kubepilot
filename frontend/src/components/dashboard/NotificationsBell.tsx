"use client";

import { AppLink } from "@/components/ui/AppLink";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Bell } from "lucide-react";
import { NOTIFICATION_ALERTS, ALERT_BADGE_COUNT } from "@/lib/notifications";
import { useClickOutside } from "@/hooks/useClickOutside";
import { SeverityBadge } from "@/components/dashboard/ui/DashboardUi";

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false), open);

  function openAlert(id: string) {
    setOpen(false);
    router.push(`/dashboard/alerts?alert=${id}`);
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
        {ALERT_BADGE_COUNT > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {ALERT_BADGE_COUNT}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-xl border border-kp-border bg-kp-surface-elevated shadow-xl sm:w-80">
          <div className="flex items-center justify-between border-b border-kp-border px-4 py-3">
            <h3 className="text-sm font-semibold text-kp-text">Alerts</h3>
            <AppLink
              href="/dashboard/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-kp-blue-glow hover:underline"
            >
              View all
            </AppLink>
          </div>

          <ul className="max-h-80 overflow-y-auto overscroll-contain">
            {NOTIFICATION_ALERTS.map((alert) => (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => openAlert(alert.id)}
                  className="flex w-full flex-col gap-1 border-b border-kp-border/50 px-4 py-3 text-left transition-colors hover:bg-kp-surface/80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-kp-text">{alert.title}</span>
                    <span className="shrink-0 text-[10px] text-kp-muted">{alert.time}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-[10px] text-kp-muted">
                      {alert.cluster} · {alert.resource}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-kp-border px-4 py-2">
            <AppLink
              href="/dashboard/alerts"
              onClick={() => setOpen(false)}
              className="block py-1.5 text-center text-xs font-medium text-kp-blue-glow hover:underline"
            >
              Open Alerts page →
            </AppLink>
          </div>
        </div>
      )}
    </div>
  );
}
