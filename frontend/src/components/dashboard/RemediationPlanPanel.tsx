"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, Shield } from "lucide-react";
import {
  fetchFindingRemediate,
  type FindingContextPayload,
  type RemediationPlanResult,
  type RemediationStepItem,
} from "@/lib/api";

function impactBadgeClass(level: string): string {
  switch (level) {
    case "high":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "medium":
      return "bg-amber-500/15 text-amber-200 border-amber-500/30";
    case "low":
      return "bg-yellow-500/10 text-yellow-200 border-yellow-500/25";
    default:
      return "bg-kp-surface text-kp-muted border-kp-border";
  }
}

function isRawJsonSummary(summary: string): boolean {
  const s = summary.trim();
  return s.startsWith("{") && (s.includes('"steps"') || s.includes('"impact_level"'));
}

function displaySummary(plan: RemediationPlanResult): string | null {
  const s = plan.summary?.trim() ?? "";
  if (!s || isRawJsonSummary(s)) return null;
  return s;
}

function contextCacheKey(context?: FindingContextPayload): string {
  if (!context) return "";
  return JSON.stringify(context);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function StepBlock({ step }: { step: RemediationStepItem }) {
  return (
    <li className="rounded-lg border border-kp-border/50 bg-kp-bg-deep/40 p-3 text-sm">
      <p className="font-medium text-kp-text">
        Step {step.order}: {step.title}
      </p>
      {step.description && <p className="mt-1 text-kp-muted">{step.description}</p>}
      {step.command && (
        <div className="relative mt-2">
          <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-kp-text">
            {step.command}
          </pre>
          <button
            type="button"
            onClick={() => copyText(step.command!)}
            className="absolute right-2 top-2 rounded border border-kp-border/50 bg-kp-surface/80 p-1 text-kp-muted hover:text-kp-text"
            title="Copy command"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {step.dry_run_command && (
        <p className="mt-1 font-mono text-[10px] text-kp-muted">Dry run: {step.dry_run_command}</p>
      )}
      {step.verify_command && (
        <p className="mt-1 font-mono text-[10px] text-emerald-300/90">Verify: {step.verify_command}</p>
      )}
    </li>
  );
}

export function RemediationPlanPanel({
  clusterId,
  insightId,
  context,
}: {
  clusterId: string;
  insightId: string;
  context?: FindingContextPayload;
}) {
  const contextKey = useMemo(() => contextCacheKey(context), [context]);
  const [plan, setPlan] = useState<RemediationPlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPlan(null);
    setLoading(true);
    setError(null);
    // Do not abort the fetch on cleanup — React Strict Mode unmounts once in dev and
    // would cancel the POST while Ollama is still running. In-flight dedupe in api.ts
    // ensures only one request per finding; `cancelled` ignores stale setState only.
    fetchFindingRemediate(clusterId, insightId, context)
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load remediation");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clusterId, insightId, contextKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-kp-border/50 bg-kp-surface/30 px-4 py-6 text-sm text-kp-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading recommended fix…
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error ?? "Remediation unavailable"}
      </div>
    );
  }

  const sourceLabel =
    plan.remediation_source === "llm" ? "AI-generated (LLM)" : "Deterministic template";
  const summaryText = displaySummary(plan);

  return (
    <div className="space-y-4 rounded-xl border border-kp-border/60 bg-kp-surface/30 p-4">
      <div className="flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
        <Shield className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{plan.readonly_notice}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-kp-border bg-kp-surface px-2 py-0.5 text-[10px] text-kp-muted">
          Source: {sourceLabel}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${impactBadgeClass(plan.impact_level)}`}
        >
          Impact: {plan.impact_level}
        </span>
      </div>

      {summaryText && (
        <p className="text-sm leading-relaxed text-kp-text">{summaryText}</p>
      )}

      {plan.impact_summary && (
        <div className="rounded-lg border border-kp-border/40 bg-kp-bg-deep/30 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-kp-muted">Impact</p>
          <p className="mt-1 text-sm text-kp-text">{plan.impact_summary}</p>
          {plan.downtime_notes && (
            <p className="mt-1 text-xs text-kp-muted">{plan.downtime_notes}</p>
          )}
        </div>
      )}

      {plan.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {plan.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {plan.do_not_remediate ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
          <p className="font-medium">Do not remediate automatically</p>
          <p className="mt-1 text-xs">{plan.do_not_remediate_reason}</p>
        </div>
      ) : plan.steps.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-kp-text">Steps to fix</h3>
          <ol className="mt-3 space-y-3">
            {plan.steps.map((step) => (
              <StepBlock key={step.order} step={step} />
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-kp-muted">No remediation steps were returned. Re-scan and try again.</p>
      )}

      {plan.prerequisites.length > 0 && (
        <div>
          <p className="text-xs font-medium text-kp-muted">Prerequisites</p>
          <ul className="mt-1 list-inside list-disc text-xs text-kp-text">
            {plan.prerequisites.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.rollback_steps.length > 0 && !plan.do_not_remediate && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-kp-muted hover:text-kp-text">
            Rollback steps
          </summary>
          <ol className="mt-2 space-y-2">
            {plan.rollback_steps.map((step) => (
              <StepBlock key={`rb-${step.order}`} step={step} />
            ))}
          </ol>
        </details>
      )}

      {plan.llm_note && (
        <details className="rounded-lg border border-kp-border/50 bg-kp-bg-deep/50 px-3 py-2 text-xs text-kp-muted">
          <summary className="cursor-pointer font-medium text-kp-text">How this was produced</summary>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{plan.llm_note}</p>
        </details>
      )}
    </div>
  );
}
