import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/** The form panel used by every auth screen. */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card padding="none" className={cn("w-full max-w-md p-6 sm:p-10", className)}>
      {children}
    </Card>
  );
}

/** Centres a single AuthCard (forgot password, verify email, reset password). */
export function AuthCentered({ children }: { children: ReactNode }) {
  return <div className="flex w-full justify-center">{children}</div>;
}

/** Brand panel beside the form on large screens (login, sign-up); the form alone on smaller ones. */
export function AuthSplit({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_28rem] xl:gap-16">
      <div className="hidden lg:block">{aside}</div>
      <div className="flex justify-center lg:justify-end">{children}</div>
    </div>
  );
}
