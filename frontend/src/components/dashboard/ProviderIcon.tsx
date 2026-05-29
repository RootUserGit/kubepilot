"use client";

import { Cloud, Server } from "lucide-react";

export function ProviderIcon({ provider }: { provider: string | null }) {
  const p = (provider ?? "").toLowerCase();
  if (p === "aws") {
    return (
      <span className="inline-flex items-center gap-1.5 text-kp-text">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
          <path
            fill="#FF9900"
            d="M6.76 18.8l.86-2.2c.2-.5.8-.7 1.2-.4 1.5 1.1 3.2 1.7 5 1.7 3.9 0 7.1-3.2 7.1-7.1 0-3.3-2.3-6.1-5.5-6.9l.9-2.3c.1-.3-.2-.6-.5-.4C8.2 5.4 4.5 9.5 4.5 14.3c0 4.7 3.8 8.5 8.5 8.5 2.8 0 5.4-1.3 7.1-3.5.3-.3.1-.8-.3-.8-.6 0-1.2-.1-1.8-.3-.5-.2-1.1 0-1.3.5l-.9 2.3c-.1.3.1.6.4.7 1.9.7 4 1.1 6.1 1.1 5.2 0 9.5-4.2 9.5-9.5 0-4.4-3-8.1-7.1-9.2l-.9 2.3c-.1.3.2.6.5.5z"
          />
        </svg>
        <span className="text-xs">AWS EKS</span>
      </span>
    );
  }
  if (p === "local") {
    return (
      <span className="inline-flex items-center gap-1.5 text-kp-text">
        <Server className="h-4 w-4 shrink-0 text-kp-muted" />
        <span className="text-xs">On-Prem</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-kp-text">
      <Cloud className="h-4 w-4 shrink-0 text-kp-muted" />
      <span className="text-xs capitalize">{provider ?? "—"}</span>
    </span>
  );
}
