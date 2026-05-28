/** @deprecated Use alert-store.ts — kept for type re-exports only. */
export type AlertPreview = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  cluster: string;
  resource: string;
  time: string;
};
