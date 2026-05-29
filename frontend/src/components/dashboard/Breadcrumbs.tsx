"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-kp-muted">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-kp-border" aria-hidden />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="truncate text-kp-blue-glow transition-colors hover:text-kp-blue hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`truncate ${isLast ? "font-medium text-kp-text" : ""}`}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
