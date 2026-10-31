import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Closing line of an auth card, e.g. "Don't have an account? Create an account". */
export function AuthFooter({ prompt, href, linkText }: { prompt?: ReactNode; href: string; linkText: string }) {
  return (
    <p className="mt-8 border-t border-border pt-6 text-center text-body text-muted">
      {prompt ? <>{prompt} </> : null}
      <Link href={href} className="rounded-[4px] font-semibold whitespace-nowrap text-[#c7bfff] hover:text-foreground">
        {linkText}
      </Link>
    </p>
  );
}

/** "← Back to login" closing link used by the single-card auth screens. */
export function AuthBackLink({ href = "/login", children = "Back to login" }: { href?: string; children?: ReactNode }) {
  return (
    <p className="mt-8 border-t border-border pt-6 text-center">
      <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-body font-semibold text-[#c7bfff] hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {children}
      </Link>
    </p>
  );
}
