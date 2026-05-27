import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Headphones, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { siteLinks } from "@/lib/site-links";

export function ContactPage() {
  return (
    <div className="kp-grid-bg min-h-full">
      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <PublicPageHeader
          title="Contact Us"
          description="Questions about access, architecture, or onboarding? Reach the KubePilot platform team through the channels below."
        />

        <div className="space-y-6">
          <ContactCard
            icon={Headphones}
            title="Request platform access"
            description="New users need a KubePilot role assigned via the internal IT portal before signing in with Google SSO."
            action={
              siteLinks.itPortal ? (
                <a
                  href={siteLinks.itPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-kp-blue-glow hover:underline"
                >
                  Open IT access portal →
                </a>
              ) : (
                <p className="text-sm text-kp-muted" id="access">
                  Configure{" "}
                  <code className="rounded bg-kp-surface px-1.5 py-0.5 text-xs">
                    NEXT_PUBLIC_KUBEPILOT_IT_PORTAL_URL
                  </code>{" "}
                  in your environment, or contact your platform SRE lead.
                </p>
              )
            }
          />

          <ContactCard
            icon={Mail}
            title="Platform support"
            description="For incidents, integration issues, or feature requests related to KubePilot."
            action={
              <a
                href={`mailto:${siteLinks.supportEmail}`}
                className="text-sm font-medium text-kp-blue-glow hover:underline"
              >
                {siteLinks.supportEmail}
              </a>
            }
          />

          <ContactCard
            icon={Shield}
            title="Security & compliance"
            description="Questions about IRSA boundaries, data residency, or audit evidence."
            action={
              <Link
                href="/features#security"
                className="text-sm font-medium text-kp-blue-glow hover:underline"
              >
                Read the security model →
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}

function ContactCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="kp-card">
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-kp-blue/10 text-kp-blue-glow">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-kp-text">{title}</h2>
          <p className="mt-1 text-sm text-kp-muted">{description}</p>
          <div className="mt-3">{action}</div>
        </div>
      </div>
    </div>
  );
}
