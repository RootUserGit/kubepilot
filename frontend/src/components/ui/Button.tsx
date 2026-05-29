import Link from "next/link";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  href?: string;
  children: ReactNode;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-kp-blue text-white hover:bg-kp-blue/90 kp-glow-blue border border-kp-blue/50",
  secondary:
    "border border-kp-border bg-kp-surface text-kp-text hover:bg-kp-surface-elevated",
  ghost: "text-kp-muted hover:text-kp-text hover:bg-kp-surface/50",
};

export function Button({
  variant = "primary",
  href,
  children,
  icon,
  className = "",
  ...props
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {icon}
      {children}
    </button>
  );
}
