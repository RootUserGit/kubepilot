"use client";

import { FindingContextBadges } from "@/components/dashboard/FindingContextBadges";
import { RemediationPlanPanel } from "@/components/dashboard/RemediationPlanPanel";
import { SeverityBadge } from "@/components/dashboard/ui/DashboardUi";
import {
  formatAlertTime,
  toAlertBadgeSeverity,
  type StoredAlert,
} from "@/lib/alert-store";

export function AlertDetailPanel({ alert }: { alert: StoredAlert }) {
  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={toAlertBadgeSeverity(alert.severity)} label={alert.severity} />
          <span className="text-[10px] uppercase text-kp-muted">{alert.category}</span>
          {!alert.readAt && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
              Unread
            </span>
          )}
        </div>
        <span className="text-xs text-kp-muted">Detected {formatAlertTime(alert.detectedAt)}</span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-kp-text">{alert.title}</h2>
      <p className="mt-1 text-sm text-kp-muted">
        {alert.clusterName} · {alert.namespace}/{alert.resourceKind}/{alert.resourceName}
      </p>
      <dl className="mt-6 space-y-4 text-sm">
        {alert.containerName && (
          <div>
            <dt className="text-xs text-kp-muted">Container</dt>
            <dd className="mt-0.5 text-kp-text">{alert.containerName}</dd>
          </div>
        )}
        {alert.checkId && (
          <div>
            <dt className="text-xs text-kp-muted">Check</dt>
            <dd className="mt-0.5 font-mono text-xs text-kp-muted">{alert.checkId}</dd>
          </div>
        )}
        {alert.detail && (
          <div>
            <dt className="text-xs text-kp-muted">Details</dt>
            <dd className="mt-1 whitespace-pre-wrap text-kp-text">{alert.detail}</dd>
          </div>
        )}
        {alert.relatedPods.length > 0 && (
          <div>
            <dt className="text-xs text-kp-muted">Affected pods</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {alert.relatedPods.map((p) => (
                <span
                  key={p}
                  className="rounded bg-kp-surface px-1.5 py-0.5 font-mono text-[10px] text-kp-text"
                >
                  {p}
                </span>
              ))}
            </dd>
          </div>
        )}
        {alert.remediation && (
          <div>
            <dt className="text-xs text-kp-muted">Remediation</dt>
            <dd className="mt-1 text-kp-text">{alert.remediation}</dd>
          </div>
        )}
        {"finding_type" in alert && (alert as { finding_type?: string }).finding_type === "behavioral" && (
          <div>
            <dt className="text-xs text-kp-muted">Detection</dt>
            <dd className="mt-1 text-purple-300">Runtime behavioral anomaly (metrics baseline)</dd>
          </div>
        )}
      </dl>
      {"disposition" in alert && (
        <div className="mt-6 border-t border-kp-border/40 pt-4">
          <FindingContextBadges
            disposition={(alert as { disposition?: string }).disposition}
            suppressionReason={(alert as { suppressionReason?: string | null }).suppressionReason}
            references={(alert as { references?: { title: string; url: string }[] }).references}
            rawSeverity={(alert as { rawSeverity?: string | null }).rawSeverity}
            severity={alert.severity}
          />
        </div>
      )}
      {alert.clusterId && (
        <div className="mt-6">
          <RemediationPlanPanel
            clusterId={alert.clusterId}
            insightId={alert.id}
            context={{
              namespace: alert.namespace,
              resource_kind: alert.resourceKind,
              resource_name: alert.resourceName,
              check_id: alert.checkId,
              container_name: alert.containerName,
              title: alert.title,
              severity: alert.severity,
              category: alert.category,
              detail: alert.detail,
              remediation: alert.remediation,
            }}
          />
        </div>
      )}
    </div>
  );
}
