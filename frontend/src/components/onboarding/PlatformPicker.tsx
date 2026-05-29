"use client";

import { Cloud, HardDrive, Server } from "lucide-react";

export type PlatformChoice = "local" | "aws" | "azure" | "gcp";

type Props = {
  onSelect: (platform: PlatformChoice) => void;
};

const PLATFORMS = [
  {
    id: "local" as const,
    title: "Local",
    description: "Minikube, kind, or any cluster reachable via kubeconfig on your machine.",
    icon: HardDrive,
    enabled: true,
  },
  {
    id: "aws" as const,
    title: "AWS",
    description: "Amazon EKS with IAM Role or saved access-key profiles.",
    icon: Server,
    enabled: true,
  },
  {
    id: "azure" as const,
    title: "Azure",
    description: "Azure Kubernetes Service (AKS).",
    icon: Cloud,
    enabled: false,
  },
  {
    id: "gcp" as const,
    title: "GCP",
    description: "Google Kubernetes Engine (GKE).",
    icon: Cloud,
    enabled: false,
  },
];

export function PlatformPicker({ onSelect }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-kp-text sm:text-2xl">Where is your cluster?</h2>
        <p className="mt-2 text-sm text-kp-muted">
          Choose a platform to start onboarding. You can register multiple clusters per account.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!p.enabled}
              onClick={() => p.enabled && onSelect(p.id)}
              className={`flex flex-col rounded-2xl border p-6 text-left transition-colors ${
                p.enabled
                  ? "border-kp-border bg-kp-surface/50 hover:border-kp-blue/50 hover:bg-kp-blue/5"
                  : "cursor-not-allowed border-kp-border/60 bg-kp-bg-deep/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className={`h-8 w-8 shrink-0 ${p.enabled ? "text-kp-blue-glow" : "text-kp-muted"}`} />
                {!p.enabled && (
                  <span className="rounded-full bg-kp-surface px-2 py-0.5 text-[10px] font-medium text-kp-muted">
                    Coming soon
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-kp-text">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-kp-muted">{p.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
