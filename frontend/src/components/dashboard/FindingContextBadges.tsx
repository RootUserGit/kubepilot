"use client";

import type { FindingReferenceItem } from "@/lib/api";

export function FindingContextBadges({
  disposition,
  suppressionReason,
  references,
  rawSeverity,
  severity,
}: {
  disposition?: string;
  suppressionReason?: string | null;
  references?: FindingReferenceItem[];
  rawSeverity?: string | null;
  severity: string;
}) {
  return (
    <div className="space-y-3">
      {disposition === "accepted_system_requirement" && (
        <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
          Accepted system requirement
        </span>
      )}
      {rawSeverity && rawSeverity !== severity && (
        <p className="text-xs text-kp-muted">
          Raw severity: <span className="uppercase">{rawSeverity}</span> → effective{" "}
          <span className="uppercase text-kp-text">{severity}</span>
        </p>
      )}
      {suppressionReason && (
        <p className="text-sm text-kp-muted">{suppressionReason}</p>
      )}
      {references && references.length > 0 && (
        <div>
          <p className="text-xs text-kp-muted">References</p>
          <ul className="mt-1 space-y-1">
            {references.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-kp-blue-glow hover:underline"
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
