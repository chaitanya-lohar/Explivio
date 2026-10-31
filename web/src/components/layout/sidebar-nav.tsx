"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, primaryNavigation } from "@/config/navigation";
import { cn } from "@/lib/cn";

export interface SidebarNavProps {
  /** Icon-only links with screen-reader labels (tablet sidebar). */
  compact?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ compact = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  return <NavList pathname={pathname} compact={compact} onNavigate={onNavigate} />;
}

/** Rendered without an active item while the pathname is unknown (Suspense fallback). */
export function NavList({ pathname, compact = false, onNavigate }: SidebarNavProps & { pathname: string | null }) {
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1">
        {primaryNavigation.map((item) => {
          const active = pathname !== null && isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={compact ? item.label : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-control border-l-2 text-body font-medium transition-colors duration-150",
                  compact ? "justify-center" : "px-3",
                  active ? "border-primary bg-primary/15 text-[#c7bfff]" : "border-transparent text-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className={compact ? "sr-only" : undefined}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
