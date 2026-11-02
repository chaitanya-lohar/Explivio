import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** A setting the product doesn't let users change (e.g. format), shown with a "Fixed" badge. */
export function FixedOption({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-background p-4">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-raised text-[#c7bfff] [&_svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-title text-foreground">{title}</p>
        <p className="text-meta text-muted">{description}</p>
      </div>
      <Badge icon={null}>Fixed</Badge>
    </div>
  );
}
