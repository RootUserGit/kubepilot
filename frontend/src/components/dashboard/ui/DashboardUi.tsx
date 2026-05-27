import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

/** Toolbar row below the layout header — actions only (title lives in DashboardLayout). */
export function PageHeader({
  action,
  children,
}: {
  action?: ReactNode;
  children?: ReactNode;
}) {
  if (!action && !children) return null;

  return (
    <div className="flex flex-col gap-3 border-b border-kp-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      {children && <div className="min-w-0 flex-1">{children}</div>}
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  valueClassName = "text-kp-text",
  subClassName = "text-kp-muted",
  icon: Icon,
  iconClassName = "text-kp-muted",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
  subClassName?: string;
  icon?: LucideIcon;
  iconClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-kp-muted">{label}</p>
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />}
      </div>
      <p className={`mt-2 text-xl font-bold sm:text-2xl ${valueClassName}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${subClassName}`}>{sub}</p>}
    </div>
  );
}

export function FilterPills({
  items,
  active,
  onChange,
}: {
  items: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            active === item.id
              ? "border-kp-blue bg-kp-blue/15 text-kp-text"
              : "border-kp-border text-kp-muted hover:border-kp-blue/40 hover:text-kp-text"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function SeverityBadge({
  severity,
}: {
  severity: "critical" | "high" | "warning" | "medium" | "info" | "healthy";
}) {
  const styles = {
    critical: "bg-red-500/15 text-red-800 dark:text-red-300 border-red-500/30",
    high: "kp-badge-warning border-amber-500/30",
    warning: "kp-badge-warning border-amber-500/30",
    medium: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200 border-yellow-500/30",
    info: "bg-kp-blue/15 text-kp-blue-glow border-kp-blue/30",
    healthy: "bg-kp-green/15 text-kp-green border-kp-green/30",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-[640px] w-full text-left text-xs sm:text-sm">
        <thead className="border-b border-kp-border text-kp-muted">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 font-medium whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-kp-border/50 hover:bg-kp-surface/30">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-kp-border bg-kp-surface/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-kp-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PrimaryButton({
  children,
  onClick,
  href,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const cls =
    "inline-flex items-center justify-center rounded-lg bg-kp-blue px-4 py-2 text-sm font-medium text-white hover:bg-kp-blue/90 transition-colors disabled:pointer-events-none disabled:opacity-50";
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded bg-kp-surface px-1.5 py-0.5 text-[10px] text-kp-muted">
      {children}
    </span>
  );
}
