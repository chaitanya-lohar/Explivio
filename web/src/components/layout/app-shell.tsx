import type { ReactNode } from "react";
import type { UserProfile } from "@/types/user";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

export function AppShell({ user, children }: { user: UserProfile; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-control bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={user} />
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
