import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/layout/brand";

/** Shell for authentication pages: brand bar, centred content, footer. Deliberately has no dashboard sidebar or navigation. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      {/* Soft brand glow, purely decorative. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(ellipse_at_top,rgb(139_124_255/0.14),transparent_60%)]" />
      <header className="relative z-10 flex h-16 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-8">
        <Brand />
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-meta text-muted hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to Explivio
        </Link>
      </header>
      <main id="main" className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:py-14">
        {children}
      </main>
      <footer className="relative z-10 border-t border-border px-4 py-5 text-center text-meta text-muted sm:px-8">© 2026 Explivio. Turn Ideas Into Videos.</footer>
    </div>
  );
}
