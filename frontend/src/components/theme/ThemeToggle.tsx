"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

type ThemeToggleProps = {
  className?: string;
};

/** Persists via next-themes (`kubepilot-theme`) — shared when logged in or out. */
export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className={`inline-block h-9 w-9 rounded-lg ${className}`} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-kp-border bg-kp-surface text-kp-muted transition-colors hover:bg-kp-surface-elevated hover:text-kp-text ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
