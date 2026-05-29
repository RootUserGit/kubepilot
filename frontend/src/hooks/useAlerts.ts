"use client";

import { useCallback, useEffect, useState } from "react";
import {
  INSIGHTS_CHANGED_EVENT,
  getUnreadBellCount,
  loadInsights,
  type StoredInsight,
} from "@/lib/insights-store";

export function useAlerts() {
  const [alerts, setAlerts] = useState<StoredInsight[]>([]);
  const [unreadBellCount, setUnreadBellCount] = useState(0);

  const refresh = useCallback(() => {
    setAlerts(loadInsights());
    setUnreadBellCount(getUnreadBellCount());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(INSIGHTS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(INSIGHTS_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { alerts, unreadBellCount, refresh };
}
