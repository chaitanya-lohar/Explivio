import { LogOut } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { signOutAction } from "@/features/authentication/actions";

/** Ends the session on the server (the session record is deleted) and returns to sign-in. Works without JavaScript. */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signOutAction}>
      <button type="submit" title={compact ? "Sign out" : undefined} className={buttonStyles({ variant: "ghost", size: compact ? "icon" : "md", fullWidth: !compact, className: compact ? undefined : "justify-start" })}>
        <LogOut aria-hidden="true" className="size-4" />
        <span className={compact ? "sr-only" : undefined}>Sign out</span>
      </button>
    </form>
  );
}
