"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  DollarSign,
  FileText,
  LayoutDashboard,
  Menu,
  Search,
  Server,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { LogoLink } from "@/components/layout/LogoLink";
import { NotificationsBell } from "@/components/dashboard/NotificationsBell";
import { UserMenu, SidebarUserFooter } from "@/components/dashboard/UserMenu";
import { NAV_ITEMS, resolvePageMeta } from "@/components/dashboard/nav-config";
import { useAuth } from "@/components/auth/AuthProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
const ICONS = {
  Dashboard: LayoutDashboard,
  Clusters: Server,
  "AI Insights": Sparkles,
  Security: Shield,
  Cost: DollarSign,
  Governance: FileText,
  Reports: FileText,
  Alerts: AlertTriangle,
  Integrations: Server,
} as const;

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="space-y-0.5" aria-label="Dashboard">
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const Icon = ICONS[item.label as keyof typeof ICONS] ?? LayoutDashboard;
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => {
              onNavigate?.();
              if (!active) router.push(item.href);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              active
                ? "bg-kp-blue/15 text-kp-text ring-1 ring-kp-blue/30"
                : "text-kp-muted hover:bg-kp-surface hover:text-kp-text"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-kp-blue-glow" : ""}`} />
            <span className="flex-1 truncate">{item.label}</span>
            {"badge" in item && item.badge != null && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function AiAssistantWidget() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard/assistant")}
      className="mx-3 mb-3 block w-[calc(100%-1.5rem)] rounded-lg border border-kp-blue/30 bg-kp-blue/10 p-3 text-left transition-colors hover:bg-kp-blue/15"
    >
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-kp-blue-glow kp-pulse" />
        <span className="text-xs font-semibold text-kp-text">AI Assistant</span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-kp-muted">
        Ask about cluster health, costs, or security posture
      </p>
    </button>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-kp-border p-4">
        <LogoLink showBadge onNavigate={onNavigate} />
        <p className="mt-2 text-[10px] leading-snug text-kp-muted">
          Intelligent Kubernetes Management Platform
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="shrink-0 border-t border-kp-border/50 bg-kp-bg-deep pt-1">
        <AiAssistantWidget />
        <SidebarUserFooter />
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = resolvePageMeta(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kp-bg text-kp-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-kp-bg">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-kp-border bg-kp-bg-deep lg:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full min-h-0 w-[min(100%,18rem)] flex-col overflow-hidden bg-kp-bg-deep shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-1 text-kp-muted hover:text-kp-text"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-kp-border bg-kp-bg/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-kp-muted hover:bg-kp-surface hover:text-kp-text lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-kp-text sm:text-lg">{meta.title}</h1>
              {meta.subtitle && (
                <p className="hidden truncate text-xs text-kp-muted sm:block">{meta.subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/assistant")}
              className="rounded-lg p-2 text-kp-muted hover:bg-kp-surface hover:text-kp-text lg:hidden"
              aria-label="AI Assistant"
            >
              <Bot className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-kp-muted hover:bg-kp-surface hover:text-kp-text"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <NotificationsBell />
            <UserMenu align="right" variant="avatar" />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
