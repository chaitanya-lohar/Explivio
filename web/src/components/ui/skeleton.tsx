import { cn } from "@/lib/cn";

/** Placeholder block shown while content loads; hidden from assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-surface-raised", className)} />;
}
