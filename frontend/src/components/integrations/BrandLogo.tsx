"use client";

import { useState } from "react";

/**
 * Colored brand marks served from /public/brands (official-style SVGs).
 */

type BrandLogoProps = {
  name: string;
  className?: string;
};

const BRAND_FILES: Record<string, string> = {
  AWS: "aws.svg",
  Prometheus: "prometheus.svg",
  Grafana: "grafana.svg",
  Slack: "slack.svg",
  Datadog: "datadog.svg",
  "Microsoft Teams": "microsoft-teams.svg",
  GitHub: "github.svg",
  Jira: "jira.svg",
};

export function BrandLogo({ name, className = "h-9 w-9" }: BrandLogoProps) {
  const file = BRAND_FILES[name];
  const [failed, setFailed] = useState(false);

  if (!file || failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md bg-kp-blue/15 text-xs font-bold text-kp-blue-glow ${className}`}
        aria-hidden
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG brand assets
    <img
      src={`/brands/${file}`}
      alt={`${name} logo`}
      className={`object-contain ${className}`}
      width={36}
      height={36}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
