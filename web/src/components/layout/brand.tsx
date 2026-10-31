import Link from "next/link";
import { Sparkles } from "lucide-react";
import { appConfig } from "@/config/app";
import { cn } from "@/lib/cn";

export interface BrandProps {
  /** Hide the wordmark and subtitle (compact tablet sidebar). */
  compact?: boolean;
  className?: string;
}

export function Brand({ compact = false, className }: BrandProps) {
  return (
    <Link href="/" aria-label={`${appConfig.name} home`} className={cn("flex items-center gap-3 rounded-control", className)}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-control bg-gradient-to-br from-primary to-secondary text-primary-foreground">
        <Sparkles className="size-5" />
      </span>
      {compact ? null : (
        <span className="flex flex-col leading-tight">
          <span className="text-title text-foreground">{appConfig.name}</span>
          <span className="text-meta text-secondary">Studio Suite</span>
        </span>
      )}
    </Link>
  );
}
