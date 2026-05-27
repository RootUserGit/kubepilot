import Link from "next/link";
import { LogoLink } from "./LogoLink";
import {
  footerPlatformLinks,
  footerResourceLinks,
  footerSupportLinks,
} from "@/lib/site-links";

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string; external?: boolean }[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-kp-muted">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-kp-muted transition-colors hover:text-kp-text"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-kp-muted transition-colors hover:text-kp-text"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-kp-border/60 bg-kp-bg-deep">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <LogoLink />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-kp-muted">
              Read-only operational intelligence for our EKS fleet. Correlate signals, track
              namespace costs, and pass audits—without mutating production workloads.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-kp-green/30 bg-kp-green/10 px-3 py-1 text-xs font-medium text-kp-green">
              <span className="h-1.5 w-1.5 rounded-full bg-kp-green" />
              Internal platform • IRSA read-only
            </p>
          </div>
          <FooterColumn title="Platform" links={footerPlatformLinks} />
          <FooterColumn title="Resources" links={footerResourceLinks} />
          <FooterColumn title="Support" links={footerSupportLinks} />
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-kp-border/60 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-kp-muted">
            © {year} KubePilot. For authorized internal use only.
          </p>
          <div className="flex flex-wrap gap-4 text-xs">
            <Link href="/contact" className="text-kp-muted hover:text-kp-text">
              Contact
            </Link>
            <Link href="/features#security" className="text-kp-muted hover:text-kp-text">
              Security
            </Link>
            <Link href="/onboarding" className="text-kp-muted hover:text-kp-text">
              Docs
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
