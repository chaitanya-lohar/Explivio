import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import type { UserProfile } from "@/types/user";
import { Brand } from "./brand";
import { NavList, SidebarNav } from "./sidebar-nav";
import { UserSummary } from "./user-summary";

export interface SidebarContentProps {
  user: UserProfile;
  compact?: boolean;
  onNavigate?: () => void;
}

/** Brand, primary action, navigation and profile; shared by the desktop/tablet sidebar and the mobile drawer. */
export function SidebarContent({ user, compact = false, onNavigate }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col gap-6">
      <Brand compact={compact} className={compact ? "self-center" : undefined} />
      <Link href="/create" onClick={onNavigate} title={compact ? "Create Video" : undefined} className={buttonStyles({ variant: "primary", size: compact ? "icon" : "md", fullWidth: true })}>
        <Plus aria-hidden="true" className="size-5" />
        <span className={compact ? "sr-only" : undefined}>Create Video</span>
      </Link>
      {/* usePathname suspends on routes with unknown dynamic params; fall back to the nav without an active item. */}
      <Suspense fallback={<NavList pathname={null} compact={compact} />}>
        <SidebarNav compact={compact} onNavigate={onNavigate} />
      </Suspense>
      <div className="mt-auto border-t border-border pt-4">
        <UserSummary user={user} compact={compact} className={compact ? "justify-center" : undefined} />
      </div>
    </div>
  );
}

/** Persistent sidebar: compact icons on tablet (md), full width on desktop (lg). Hidden on mobile. */
export function Sidebar({ user }: { user: UserProfile }) {
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-surface md:block md:w-20 lg:w-64">
      <div className="h-full px-3 py-6 lg:hidden">
        <SidebarContent user={user} compact />
      </div>
      <div className="hidden h-full px-4 py-6 lg:block">
        <SidebarContent user={user} />
      </div>
    </aside>
  );
}
