import type { UserProfile } from "@/types/user";
import { cn } from "@/lib/cn";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export interface UserSummaryProps {
  user: UserProfile;
  /** Show only the avatar (compact tablet sidebar). */
  compact?: boolean;
  className?: string;
}

export function UserSummary({ user, compact = false, className }: UserSummaryProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} title={compact ? `${user.displayName}, ${user.role}` : undefined}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-meta font-semibold text-[#e4dfff]">
        {initials(user.displayName)}
      </span>
      <span className={cn("min-w-0 flex-col leading-tight", compact ? "sr-only" : "flex")}>
        <span className="truncate text-body font-medium text-foreground">{user.displayName}</span>
        <span className="truncate text-meta text-muted">{user.role}</span>
      </span>
    </div>
  );
}
