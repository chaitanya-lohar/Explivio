import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div aria-hidden="true" className="mb-4 flex size-12 items-center justify-center rounded-card border border-border bg-surface-raised text-secondary [&_svg]:size-6">
        {icon}
      </div>
      <h2 className="text-section text-foreground">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-body text-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
