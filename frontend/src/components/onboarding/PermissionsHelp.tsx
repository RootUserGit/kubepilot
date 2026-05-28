"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cloudFormationTemplateDownloadUrl } from "@/lib/api";

const KUBEPILOT_ACCOUNT = "787943461725";

const IAM_USER_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "KubePilotEKSRead",
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    }
  ]
}`;

type HelpKind = "iam_user" | "iam_role" | "cloudformation";

type Props = {
  kind: HelpKind;
  externalId?: string;
};

export function PermissionsHelp({ kind, externalId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1 text-kp-muted hover:bg-kp-surface hover:text-kp-text"
        aria-label="Permissions and setup help"
        aria-expanded={open}
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close help"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,28rem)] rounded-xl border border-kp-border bg-kp-bg-deep p-4 shadow-xl">
            {kind === "iam_user" && (
              <div className="space-y-3 text-xs text-kp-muted">
                <p className="font-semibold text-kp-text">IAM user — read-only policy</p>
                <p>Create a user with programmatic access and attach this policy:</p>
                <pre className="max-h-48 overflow-auto rounded-lg border border-kp-border bg-kp-surface p-2 font-mono text-[10px] text-kp-text">
                  {IAM_USER_POLICY}
                </pre>
                <p className="text-[11px]">CLI: aws iam put-user-policy --user-name NAME --policy-name KubePilotReadOnly --policy-document file://policy.json</p>
              </div>
            )}
            {kind === "iam_role" && (
              <div className="space-y-3 text-xs text-kp-muted">
                <p className="font-semibold text-kp-text">IAM role — trust policy</p>
                <p>
                  Allow KubePilot account <code className="text-kp-green">{KUBEPILOT_ACCOUNT}</code> to assume
                  this role with your External ID:
                </p>
                <pre className="overflow-auto rounded-lg border border-kp-border bg-kp-surface p-2 font-mono text-[10px] text-kp-text">
                  {`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::${KUBEPILOT_ACCOUNT}:root" },
    "Action": "sts:AssumeRole",
    "Condition": {
      "StringEquals": {
        "sts:ExternalId": "${externalId ?? "<your-external-id>"}"
      }
    }
  }]
}`}
                </pre>
              </div>
            )}
            {kind === "cloudformation" && (
              <div className="space-y-2 text-xs text-kp-muted">
                <p className="font-semibold text-kp-text">CloudFormation template</p>
                <p>
                  Deploys a read-only role trusting account {KUBEPILOT_ACCOUNT}. Parameter: ExternalId
                  {externalId ? ` = ${externalId}` : ""}.
                </p>
                <a
                  href={cloudFormationTemplateDownloadUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-kp-blue-glow hover:underline"
                >
                  Download kubepilot-readonly-role.yaml
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
