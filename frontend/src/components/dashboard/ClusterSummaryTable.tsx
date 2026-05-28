"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { type ClusterPublic, fetchClusters } from "@/lib/api";

function statusHealth(status: string | null): "healthy" | "warning" | "critical" {
  if (status === "connected") return "healthy";
  if (status === "awaiting_agent") return "warning";
  return "critical";
}

function HealthPill({ status }: { status: string | null }) {
  const health = statusHealth(status);
  const styles = {
    healthy: "bg-kp-green/15 text-kp-green",
    warning: "bg-amber-500/15 text-amber-400",
    critical: "bg-red-500/15 text-red-400",
  };
  const label =
    status === "connected" ? "connected" : status === "awaiting_agent" ? "awaiting agent" : status ?? "—";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[health]}`}>
      {label}
    </span>
  );
}

export function ClusterSummaryTable() {
  const [clusters, setClusters] = useState<ClusterPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchClusters()
      .then(setClusters)
      .catch(() => setClusters([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-kp-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading clusters…
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-kp-muted">
        No clusters yet.{" "}
        <Link href="/dashboard/clusters/register" className="text-kp-blue-glow hover:underline">
          Register a cluster
        </Link>
      </p>
    );
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="text-kp-muted">
        <tr>
          <th className="pb-2 font-medium">Cluster</th>
          <th className="pb-2 font-medium">Status</th>
          <th className="pb-2 font-medium">Provider</th>
          <th className="pb-2 font-medium">Region</th>
        </tr>
      </thead>
      <tbody>
        {clusters.slice(0, 8).map((c) => (
          <tr key={c.id} className="border-t border-kp-border/60">
            <td className="py-2">
              <Link href={`/dashboard/clusters/${c.id}`} className="font-medium text-kp-blue-glow hover:underline">
                {c.name}
              </Link>
            </td>
            <td className="py-2">
              <HealthPill status={c.registration_status} />
            </td>
            <td className="py-2 text-kp-muted">{c.provider ?? "—"}</td>
            <td className="py-2 text-kp-muted">{c.region ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TotalClustersKpi() {
  const { total, connected, loading } = useClusterCount();
  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs text-kp-muted">Total Clusters</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-kp-text">{loading ? "…" : total}</p>
      <p className="mt-0.5 text-xs text-kp-green">
        {loading ? "Loading…" : `${connected} connected`}
      </p>
    </div>
  );
}

export function useClusterCount(): { total: number; connected: number; loading: boolean } {
  const [total, setTotal] = useState(0);
  const [connected, setConnected] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchClusters()
      .then((list) => {
        setTotal(list.length);
        setConnected(list.filter((c) => c.registration_status === "connected").length);
      })
      .catch(() => {
        setTotal(0);
        setConnected(0);
      })
      .finally(() => setLoading(false));
  }, []);

  return { total, connected, loading };
}
