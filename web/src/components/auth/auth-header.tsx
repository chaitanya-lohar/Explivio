import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface AuthHeaderProps {
  title: string;
  description?: ReactNode;
  /** Optional icon tile above the title. */
  icon?: ReactNode;
  align?: "left" | "center";
}

/** Page heading for an auth card; renders the page's single h1. */
export function AuthHeader({ title, description, icon, align = "left" }: AuthHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col gap-3", align === "center" && "items-center text-center")}>
      {icon ? (
        <span aria-hidden="true" className="mb-2 flex size-14 items-center justify-center rounded-card border border-border bg-surface-raised text-[#c7bfff] [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <h1 className="text-page text-foreground">{title}</h1>
      {description ? <p className="text-body text-muted">{description}</p> : null}
    </div>
  );
}
