import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

/*
 * Every dashboard page is for signed-in users only. proxy.ts already redirects visitors without a session cookie;
 * this checks the session itself on the server (a forged or expired cookie also ends up at sign-in). Data access
 * and actions check again, so this is not the only line of defence.
 */
async function SignedInShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={{ displayName: user.name, email: user.email }}>{children}</AppShell>;
}

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-[80dvh] rounded-card" />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}
