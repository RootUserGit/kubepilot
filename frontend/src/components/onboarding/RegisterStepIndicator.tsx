"use client";

import { Check } from "lucide-react";

export type RegisterStepId =
  | "platform"
  | "local_details"
  | "aws_connection"
  | "aws_cluster"
  | "install_wait"
  | "connected"
  | "stalled";

type StepDef = { id: RegisterStepId; label: string };

type Props = {
  steps: StepDef[];
  current: RegisterStepId;
};

export function RegisterStepIndicator({ steps, current }: Props) {
  const currentIdx = steps.findIndex((s) => s.id === current);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8 sm:gap-3">
      {steps.map((step, idx) => {
        const complete = currentIdx > idx;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center gap-2 sm:gap-3">
            {idx > 0 && <div className="h-px w-4 bg-kp-border sm:w-8" aria-hidden />}
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                  complete
                    ? "border-kp-green/50 bg-kp-green/15 text-kp-green"
                    : active
                      ? "border-kp-blue/60 bg-kp-blue/10 text-kp-blue"
                      : "border-kp-border bg-kp-surface text-kp-muted"
                }`}
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <span
                className={`text-xs font-semibold sm:text-sm ${
                  active || complete ? "text-kp-text" : "text-kp-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const LOCAL_STEPS = [
  { id: "platform" as const, label: "Platform" },
  { id: "local_details" as const, label: "Details" },
  { id: "connected" as const, label: "Connected" },
];

export const AWS_STEPS = [
  { id: "platform" as const, label: "Platform" },
  { id: "aws_connection" as const, label: "Connection" },
  { id: "aws_cluster" as const, label: "Cluster" },
  { id: "install_wait" as const, label: "Install" },
  { id: "connected" as const, label: "Connected" },
];
