/** Public site URLs — set in `.env` as NEXT_PUBLIC_* (see env.example). */

export const siteLinks = {
  itPortal: process.env.NEXT_PUBLIC_KUBEPILOT_IT_PORTAL_URL?.trim() || "",
  supportEmail:
    process.env.NEXT_PUBLIC_KUBEPILOT_SUPPORT_EMAIL?.trim() || "kubepilot-support@internal",
} as const;

export type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

export const landingNav: FooterLink[] = [
  { label: "Features", href: "/features" },
  { label: "Architecture", href: "/features#architecture" },
  { label: "Contact", href: "/contact" },
];

export const footerPlatformLinks: FooterLink[] = [
  { label: "Platform Overview", href: "/features" },
  { label: "Architecture", href: "/features#architecture" },
  { label: "Security Model", href: "/features#security" },
  { label: "Agent Onboarding", href: "/onboarding" },
];

export const footerResourceLinks: FooterLink[] = [
  { label: "Internal Docs", href: "/onboarding" },
];

export const footerSupportLinks: FooterLink[] = [
  { label: "Contact Us", href: "/contact" },
  {
    label: "Request Access",
    href: siteLinks.itPortal || "/contact#access",
    external: Boolean(siteLinks.itPortal),
  },
];
