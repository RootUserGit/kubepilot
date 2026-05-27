"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useClickOutside } from "@/hooks/useClickOutside";

type UserMenuProps = {
  align?: "left" | "right";
  variant?: "avatar" | "sidebar";
};

export function UserMenu({ align = "right", variant = "avatar" }: UserMenuProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false), open);

  const displayName = user?.display_name ?? user?.user_email?.split("@")[0] ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  function goSettings(tab: string) {
    setOpen(false);
    router.push(`/dashboard/settings?tab=${tab}`);
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = "/login";
  }

  return (
    <div ref={ref} className="relative">
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-3 rounded-lg bg-kp-surface/50 px-3 py-2.5 text-left transition-colors hover:bg-kp-surface"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kp-blue text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-kp-text">{displayName}</p>
            <p className="truncate text-[10px] text-kp-muted">Platform Admin</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-kp-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-kp-blue text-xs font-bold text-white ring-2 ring-transparent transition-shadow hover:ring-kp-blue/40"
          aria-label="User menu"
          aria-expanded={open}
        >
          {initials}
        </button>
      )}

      {open && (
        <div
          className={`absolute z-50 min-w-[200px] overflow-hidden rounded-xl border border-kp-border bg-kp-surface-elevated shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          } ${variant === "sidebar" ? "bottom-full left-0 right-0 mb-2" : "top-full mt-2"}`}
        >
          <div className="border-b border-kp-border px-4 py-3">
            <p className="truncate text-sm font-medium text-kp-text">{displayName}</p>
            <p className="truncate text-xs text-kp-muted">{user?.user_email}</p>
          </div>
          <div className="py-1">
            <MenuItem icon={User} label="Profile" onClick={() => goSettings("profile")} />
            <MenuItem icon={Settings} label="Settings" onClick={() => goSettings("preferences")} />
          </div>
          <div className="border-t border-kp-border py-1">
            <MenuItem icon={LogOut} label="Sign out" onClick={() => void handleSignOut()} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof User;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-kp-surface ${
        danger ? "text-red-600 dark:text-red-400" : "text-kp-text"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      {label}
    </button>
  );
}

/** Sidebar footer: profile menu only (settings & sign out live in the dropdown). */
export function SidebarUserFooter() {
  return (
    <div className="border-t border-kp-border p-3">
      <UserMenu variant="sidebar" align="left" />
    </div>
  );
}
