import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LoadingSpinner } from "./loading-spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:brightness-110 active:brightness-95",
  secondary: "bg-surface-raised text-foreground border border-border hover:bg-[#2c3245] active:bg-surface-raised",
  outline: "border border-border text-foreground hover:bg-surface-raised active:bg-card",
  ghost: "text-muted hover:bg-surface-raised hover:text-foreground active:bg-card",
  danger: "bg-error text-primary-foreground hover:brightness-110 active:brightness-95",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-meta gap-1.5",
  md: "h-11 px-4 text-body gap-2",
  lg: "h-12 px-6 text-body gap-2",
  icon: "h-11 text-body",
};

/** Shared button styling so links (e.g. `next/link`) can look like buttons. */
export function buttonStyles({ variant = "primary", size = "md", fullWidth = false, className }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-control font-medium transition-[background-color,filter,color] duration-150",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? "w-full" : size === "icon" && "w-11",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and announces the busy state. */
  loading?: boolean;
  /** Text shown while loading; defaults to the children. */
  loadingText?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({ variant, size, loading = false, loadingText, icon, fullWidth, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonStyles({ variant, size, fullWidth, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <LoadingSpinner size="sm" label="" /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
