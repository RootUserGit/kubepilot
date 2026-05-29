"use client";

import { AppLink } from "@/components/ui/AppLink";
import { useAuth } from "@/components/auth/AuthProvider";

type LogoLinkProps = {
  showBadge?: boolean;
  className?: string;
  onNavigate?: () => void;
};

export function LogoLink({ showBadge = false, className = "", onNavigate }: LogoLinkProps) {
  const { user, loading } = useAuth();
  const href = !loading && user ? "/dashboard" : "/";

  return (
    <AppLink href={href} onClick={onNavigate} className={`flex items-center gap-2.5 group ${className}`}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-kp-blue/20 ring-1 ring-kp-blue/40">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-kp-blue-glow" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zm0 8L4.5 6.5 12 10l7.5-3.5L12 10zm0 2.5l-8-4v5l8 4 8-4v-5l-8 4z" />
        </svg>
      </div>
      <span className="text-lg font-semibold tracking-tight text-kp-text group-hover:text-kp-blue-glow transition-colors">
        KubePilot
      </span>
      {showBadge && (
        <span className="rounded-full border border-kp-border bg-kp-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-kp-muted">
          Internal
        </span>
      )}
    </AppLink>
  );
}
