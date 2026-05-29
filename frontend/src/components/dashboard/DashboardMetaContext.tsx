"use client";

import { createContext } from "react";

export type DashboardPageMeta = { title: string; subtitle?: string };

export const DashboardMetaContext = createContext<(meta: DashboardPageMeta | null) => void>(
  () => {},
);
