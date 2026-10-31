import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover feedback for cards that contain or act as a link/button. */
  interactive?: boolean;
  /** Highlights the card as the chosen option. */
  selected?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = { none: "", sm: "p-4", md: "p-6", lg: "p-8" } as const;

export function Card({ interactive = false, selected = false, padding = "md", className, ...props }: CardProps) {
  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "rounded-card border bg-card shadow-card",
        selected ? "border-primary bg-surface-raised ring-1 ring-primary" : "border-border",
        interactive && "transition-colors duration-150 hover:border-[#454c66] hover:bg-surface-raised focus-within:border-primary",
        paddings[padding],
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-card text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-meta text-muted", className)} {...props} />;
}
