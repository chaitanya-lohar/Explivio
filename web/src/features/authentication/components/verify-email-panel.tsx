"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { AtSign, Info, MailCheck, RotateCw } from "lucide-react";
import { AuthBackLink } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { resendVerificationAction } from "../actions";

const RESEND_COOLDOWN_S = 30;

/** "Check your inbox" screen. Shows only the masked address passed from sign-up, never a real one. */
export function VerifyEmailPanel() {
  const masked = useSearchParams().get("to")?.trim() ?? "";
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ variant: "info" | "error"; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function resend() {
    if (pending || cooldown > 0) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await resendVerificationAction();
        setFeedback(result.ok ? { variant: "info", text: result.message } : { variant: "error", text: result.message });
        if (result.ok) setCooldown(RESEND_COOLDOWN_S);
      } catch {
        setFeedback({ variant: "error", text: "We couldn't reach the server. Please try again." });
      }
    });
  }

  return (
    <>
      <AuthHeader align="center" icon={<MailCheck />} title="Verify your email" description="We'll send a verification link to your email address. Open it to activate your account." />
      <div className="flex items-center gap-3 rounded-control border border-border bg-background p-4">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-raised text-[#c7bfff]">
          <AtSign className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-meta text-muted">Sent to</p>
          <p className="truncate font-mono text-body text-foreground">{masked || "the email address you signed up with"}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <Button size="lg" fullWidth onClick={resend} loading={pending} loadingText="Sending…" disabled={cooldown > 0} icon={<RotateCw className="size-4" />}>
          {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend verification email"}
        </Button>
        {feedback ? (
          <AuthMessage variant={feedback.variant} title={feedback.variant === "info" ? "Demo only" : undefined}>
            {feedback.text}
          </AuthMessage>
        ) : null}
      </div>
      <p className="mt-6 flex items-start gap-2 rounded-control border border-border bg-background p-4 text-meta text-muted">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
        Didn&apos;t get the email? Check your spam folder, or make sure the address above is correct.
      </p>
      <AuthBackLink />
    </>
  );
}
