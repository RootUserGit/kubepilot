"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getUnreadBellCount,
  INSIGHTS_CHANGED_EVENT,
  loadInsights,
  reopenUnconfirmedSolvedInsights,
  type StoredInsight,
} from "@/lib/insights-store";

export function useInsights() {
  const [insights, setInsights] = useState<StoredInsight[]>([]);
  const [unreadBellCount, setUnreadBellCount] = useState(0);

  const refresh = useCallback(() => {
    reopenUnconfirmedSolvedInsights();
    setInsights(loadInsights());
    setUnreadBellCount(getUnreadBellCount());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(INSIGHTS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(INSIGHTS_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { insights, unreadBellCount, refresh };
}
