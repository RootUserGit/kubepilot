"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const;
const MOUSE_MOVE_THROTTLE_MS = 2000;

type IdleActivityMonitorProps = {
  idleTimeoutSeconds: number;
};

/**
 * Client-side idle timer only. Session is verified on app load and when the tab
 * becomes visible again — not on every click or mouse move.
 */
export function IdleActivityMonitor({ idleTimeoutSeconds }: IdleActivityMonitorProps) {
  const { user, onIdleTimeout } = useAuth();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMoveRef = useRef(0);

  useEffect(() => {
    if (!user || idleTimeoutSeconds <= 0) return;

    const idleMs = idleTimeoutSeconds * 1000;

    const scheduleLogout = () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = setTimeout(() => {
        void onIdleTimeout();
      }, idleMs);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastMoveRef.current < MOUSE_MOVE_THROTTLE_MS) return;
      lastMoveRef.current = now;
      scheduleLogout();
    };

    scheduleLogout();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [user, idleTimeoutSeconds, onIdleTimeout]);

  return null;
}
