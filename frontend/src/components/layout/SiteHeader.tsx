"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Lock, Menu, X } from "lucide-react";
import { LogoLink } from "./LogoLink";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { landingNav } from "@/lib/site-links";

type NavItem = { href: string; label: string };

type SiteHeaderProps = {
  variant?: "landing" | "docs" | "auth";
  navItems?: NavItem[];
};

export const docsNav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/features#architecture", label: "Architecture" },
  { href: "/features#security", label: "Security" },
  { href: "/onboarding", label: "Docs" },
  { href: "/contact", label: "Contact" },
];

function NavLink({
  item,
  pathname,
  onNavigate,
  className = "text-sm text-kp-muted transition-colors hover:text-kp-text",
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const active =
    (item.label === "Features" && pathname === "/features") ||
    (item.label === "Contact" && pathname === "/contact");

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`${className} ${
        active
          ? "text-kp-text border-b-2 border-kp-blue pb-0.5 font-medium"
          : "hover:text-kp-text"
      }`}
    >
      {item.label}
    </Link>
  );
}

export function SiteHeader({ variant = "landing", navItems }: SiteHeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navItems ?? docsNav;
  const landingItems = landingNav;

  const closeMobile = () => setMobileOpen(false);

  if (variant === "auth") {
    return (
      <header className="sticky top-0 z-50 border-b border-kp-border/60 bg-kp-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <LogoLink />
          <ThemeToggle />
        </div>
      </header>
    );
  }

  if (variant === "landing") {
    return (
      <header className="sticky top-0 z-50 border-b border-kp-border/60 bg-kp-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <LogoLink onNavigate={closeMobile} />

          <nav className="hidden items-center gap-6 md:flex" aria-label="Site">
            {landingItems.map((item) => (
              <NavLink key={item.label} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-kp-blue px-4 py-2 text-sm font-medium text-white hover:bg-kp-blue/90 transition-colors kp-glow-blue"
            >
              <Lock className="h-4 w-4" />
              Sign In
            </Link>
            <Link
              href="/login"
              className="inline-flex sm:hidden items-center gap-2 rounded-lg bg-kp-blue px-3 py-2 text-sm font-medium text-white hover:bg-kp-blue/90"
              aria-label="Sign In"
            >
              <Lock className="h-4 w-4" />
            </Link>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-kp-border bg-kp-surface text-kp-muted md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-kp-border/60 bg-kp-bg-deep px-6 py-4 md:hidden">
            <nav className="flex flex-col gap-2" aria-label="Mobile">
              {landingItems.map((item) => (
                <NavLink
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  onNavigate={closeMobile}
                  className="py-2 text-base"
                />
              ))}
            </nav>
          </div>
        )}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-kp-border/60 bg-kp-bg-deep/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <LogoLink showBadge onNavigate={closeMobile} />

        <nav className="hidden flex-1 items-center justify-center gap-5 lg:flex" aria-label="Site">
          {items.map((item) => {
            const isActive =
              item.label === "Features"
                ? pathname === "/features"
                : item.label === "Home"
                  ? pathname === "/"
                  : item.label === "Contact"
                    ? pathname === "/contact"
                    : item.label === "Docs"
                      ? pathname === "/onboarding"
                      : false;
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={`text-sm transition-colors ${
                  isActive
                    ? "text-kp-text border-b-2 border-kp-blue pb-0.5"
                    : "text-kp-muted hover:text-kp-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden sm:inline-flex rounded-lg bg-kp-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-kp-blue/90"
          >
            Sign In
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-kp-border bg-kp-surface text-kp-muted lg:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-kp-border/60 bg-kp-bg-deep px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-2">
            {items.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                onClick={closeMobile}
                className="py-2 text-base text-kp-muted hover:text-kp-text"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={closeMobile}
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-kp-blue px-4 py-2.5 text-sm font-medium text-white"
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
