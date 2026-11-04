"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AtSign, Info, MailCheck, RotateCw } from "lucide-react";
import { AuthBackLink } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button, buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { resendVerificationAction, verifyEmailAction } from "../actions";

const RESEND_COOLDOWN_S = 60;

/**
 * Two states in the existing design: "check your inbox" after sign-up, and opening the emailed link (?token=).
 * The link is confirmed from the browser (not when the page is fetched), so email scanners that pre-open links
 * can't use it up.
 */
export function VerifyEmailPanel() {
  const token = useSearchParams().get("token");
  return token ? <VerifyLink token={token} /> : <CheckInbox />;
}

function VerifyLink({ token }: { token: string }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    verifyEmailAction(token)
      .then((r) => setResult({ ok: r.ok, text: r.message }))
      .catch(() => setResult({ ok: false, text: "We couldn't reach the server. Please try again." }));
  }, [token]);

  if (!result) {
    return (
      <>
        <AuthHeader align="center" icon={<MailCheck />} title="Verifying your email" description="One moment…" />
        <Skeleton className="h-16" />
      </>
    );
  }
  return (
    <>
      <AuthHeader align="center" icon={<MailCheck />} title={result.ok ? "Email verified" : "We couldn't verify your email"} description={result.ok ? "Your Explivio account is active." : "The link didn't work."} />
      <AuthMessage variant={result.ok ? "success" : "error"}>{result.text}</AuthMessage>
      <div className="mt-6 flex flex-col gap-3">
        {result.ok ? (
          <Link href="/login?verified=1" className={buttonStyles({ size: "lg", fullWidth: true })}>
            Sign in
          </Link>
        ) : (
          <>
            <Link href="/login" className={buttonStyles({ size: "lg", fullWidth: true })}>
              Sign in to get a new link
            </Link>
            <p className="text-center text-meta text-muted">Signing in with an unverified account lets you request a new verification email.</p>
          </>
        )}
      </div>
    </>
  );
}

function CheckInbox() {
  const params = useSearchParams();
  const masked = params.get("to")?.trim() ?? "";
  const outbox = params.get("delivery") === "outbox";
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ variant: "info" | "error"; text: string; outbox: boolean } | null>(null);
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
        setFeedback(result.ok ? { variant: "info", text: result.message, outbox: result.delivery === "outbox" } : { variant: "error", text: result.message, outbox: false });
        if (result.ok) setCooldown(RESEND_COOLDOWN_S);
      } catch {
        setFeedback({ variant: "error", text: "We couldn't reach the server. Please try again.", outbox: false });
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
          <p className="text-meta text-muted">{outbox ? "For" : "Sent to"}</p>
          <p className="truncate font-mono text-body text-foreground">{masked || "the email address you signed up with"}</p>
        </div>
      </div>
      {outbox && !feedback ? (
        <AuthMessage variant="info" title="No email was sent" className="mt-4">
          Development mode: the verification message was saved to this server&apos;s outbox folder (data/outbox) instead of being emailed.
        </AuthMessage>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <Button size="lg" fullWidth onClick={resend} loading={pending} loadingText="Sending…" disabled={cooldown > 0} icon={<RotateCw className="size-4" />}>
          {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend verification email"}
        </Button>
        {feedback ? (
          <AuthMessage variant={feedback.variant} title={feedback.outbox ? "No email was sent" : undefined}>
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
