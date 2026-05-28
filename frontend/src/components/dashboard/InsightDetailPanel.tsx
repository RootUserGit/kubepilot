"use client";

import type { ReactNode } from "react";
import { FindingContextBadges } from "@/components/dashboard/FindingContextBadges";
import { RemediationPlanPanel } from "@/components/dashboard/RemediationPlanPanel";
import { SeverityBadge } from "@/components/dashboard/ui/DashboardUi";
import {
  categoryLabel,
  formatInsightTime,
  isConfirmedSolved,
  toAlertBadgeSeverity,
  type StoredInsight,
} from "@/lib/insights-store";

export function InsightDetailPanel({
  insight,
  extra,
}: {
  insight: StoredInsight & {
    disposition?: string;
    suppressionReason?: string | null;
    references?: { title: string; url: string }[];
    rawSeverity?: string | null;
  };
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={toAlertBadgeSeverity(insight.severity)} label={insight.severity} />
          <span className="text-[10px] uppercase text-kp-muted">{categoryLabel(insight.category)}</span>
          {isConfirmedSolved(insight) && (
            <span className="rounded-full border border-kp-green/30 bg-kp-green/10 px-2 py-0.5 text-[10px] text-kp-green">
              Resolved
            </span>
          )}
          {insight.status === "open" && !insight.readAt && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300">Unread</span>
          )}
        </div>
        <span className="text-xs text-kp-muted">
          Detected {formatInsightTime(insight.detectedAt)}
          {isConfirmedSolved(insight) && insight.solvedAt && (
            <span className="text-emerald-400/90">
              {" "}
              · Confirmed resolved {formatInsightTime(insight.solvedAt)}
              {insight.resolvedAtScan && (
                <span className="text-kp-muted"> (scan {formatInsightTime(insight.resolvedAtScan)})</span>
              )}
            </span>
          )}
        </span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-kp-text">{insight.title}</h2>
      <p className="mt-1 text-sm text-kp-muted">
        {insight.clusterName} · {insight.namespace}/{insight.resourceKind}/{insight.resourceName}
      </p>
      <dl className="mt-6 space-y-4 text-sm">
        {insight.containerName && (
          <div>
            <dt className="text-xs text-kp-muted">Container</dt>
            <dd className="mt-0.5 text-kp-text">{insight.containerName}</dd>
          </div>
        )}
        {insight.checkId && (
          <div>
            <dt className="text-xs text-kp-muted">Check</dt>
            <dd className="mt-0.5 font-mono text-xs text-kp-muted">{insight.checkId}</dd>
          </div>
        )}
        {insight.detail && (
          <div>
            <dt className="text-xs text-kp-muted">Details</dt>
            <dd className="mt-1 whitespace-pre-wrap text-kp-text">{insight.detail}</dd>
          </div>
        )}
        {insight.relatedPods.length > 0 && (
          <div>
            <dt className="text-xs text-kp-muted">Affected pods</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {insight.relatedPods.map((p) => (
                <span key={p} className="rounded bg-kp-surface px-1.5 py-0.5 font-mono text-[10px]">
                  {p}
                </span>
              ))}
            </dd>
          </div>
        )}
        {insight.remediation && (
          <div>
            <dt className="text-xs text-kp-muted">Remediation</dt>
            <dd className="mt-1 text-kp-text">{insight.remediation}</dd>
          </div>
        )}
      </dl>
      <div className="mt-6 border-t border-kp-border/40 pt-4">
        <FindingContextBadges
          disposition={insight.disposition}
          suppressionReason={insight.suppressionReason}
          references={insight.references}
          rawSeverity={insight.rawSeverity}
          severity={insight.severity}
        />
      </div>
      {extra}
      <div className="mt-6">
        <RemediationPlanPanel
          clusterId={insight.clusterId}
          insightId={insight.id}
          context={{
            namespace: insight.namespace,
            resource_kind: insight.resourceKind,
            resource_name: insight.resourceName,
            check_id: insight.checkId,
            container_name: insight.containerName,
            title: insight.title,
            severity: insight.severity,
            category: insight.category,
            detail: insight.detail,
            remediation: insight.remediation,
            disposition: insight.disposition,
            suppression_reason: insight.suppressionReason,
          }}
        />
      </div>
    </div>
  );
}
