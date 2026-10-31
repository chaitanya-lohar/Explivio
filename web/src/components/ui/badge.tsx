import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Clock, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "success" | "warning" | "error" | "processing" | "neutral";

const styles: Record<BadgeVariant, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  error: "border-error/40 bg-error/10 text-error",
  processing: "border-primary/40 bg-primary/10 text-[#c7bfff]",
  neutral: "border-border bg-surface-raised text-muted",
};

// Every status pairs colour with an icon so colour is never the only signal.
const defaultIcons: Record<BadgeVariant, ReactNode> = {
  success: <CircleCheck />,
  warning: <TriangleAlert />,
  error: <CircleAlert />,
  processing: <LoaderCircle className="animate-spin" />,
  neutral: <Clock />,
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  /** Overrides the variant's icon; pass `null` to hide it. */
  icon?: ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, icon, className }: BadgeProps) {
  const shownIcon = icon === undefined ? defaultIcons[variant] : icon;
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-meta font-medium", styles[variant], className)}>
      {shownIcon ? (
        <span aria-hidden="true" className="inline-flex [&_svg]:size-3.5">
          {shownIcon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
