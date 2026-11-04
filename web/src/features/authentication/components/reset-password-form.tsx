"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { AuthBackLink } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button, buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PasswordInput } from "@/components/ui/password-input";
import { checkResetLinkAction, resetPasswordAction } from "../actions";
import type { ResetPasswordRequest } from "../types";
import { validateResetPassword } from "../validation";
import { PasswordChecklist } from "./password-checklist";
import { PasswordStrengthIndicator, PasswordStrengthLabel } from "./password-strength-indicator";
import { useAuthForm } from "./use-auth-form";

export function ResetPasswordForm() {
  const router = useRouter();
  // One-time token from the emailed link (never logged); checked before the form is shown.
  const token = useSearchParams().get("token") ?? undefined;
  const [link, setLink] = useState<{ state: "checking" | "ok" | "bad"; message: string }>({ state: token ? "checking" : "bad", message: token ? "" : "This page needs the reset link from your email." });
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    checkResetLinkAction(token)
      .then((r) => !cancelled && setLink(r.ok ? { state: "ok", message: "" } : { state: "bad", message: r.message }))
      .catch(() => !cancelled && setLink({ state: "ok", message: "" })); // offline: let the submit report the problem
    return () => {
      cancelled = true;
    };
  }, [token]);
  const form = useAuthForm<ResetPasswordRequest>({
    idPrefix: "reset",
    fieldOrder: ["password", "confirmPassword"],
    validate: validateResetPassword,
    submit: resetPasswordAction,
    onSuccess: () => router.push("/login?reset=1"),
  });
  const update = (field: "password" | "confirmPassword", value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    form.clearError(field);
  };

  if (link.state === "checking") {
    return (
      <>
        <AuthHeader align="center" icon={<KeyRound />} title="Create a new password" description="Checking your reset link…" />
        <Skeleton className="h-64" />
      </>
    );
  }
  if (link.state === "bad" || form.formCode === "token") {
    return (
      <>
        <AuthHeader align="center" icon={<KeyRound />} title="This reset link can't be used" description="Reset links work once and expire after 30 minutes." />
        <AuthMessage variant="error">{form.formCode === "token" ? form.formError : link.message}</AuthMessage>
        <Link href="/forgot-password" className={buttonStyles({ size: "lg", fullWidth: true, className: "mt-6" })}>
          Get a new reset link
        </Link>
        <AuthBackLink />
      </>
    );
  }

  return (
    <>
      <AuthHeader align="center" icon={<KeyRound />} title="Create a new password" description="Choose a strong password for your Explivio account." />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit({ ...values, token });
        }}
        className="flex flex-col gap-5"
      >
        <PasswordInput id="reset-password" label="New password" autoComplete="new-password" placeholder="Create a new password" value={values.password} onChange={(e) => update("password", e.target.value)} error={form.errors.password} aria-describedby="reset-password-rules" labelAside={<PasswordStrengthLabel password={values.password} />} />
        <PasswordStrengthIndicator password={values.password} />
        <PasswordInput id="reset-confirmPassword" label="Confirm new password" autoComplete="new-password" placeholder="Re-enter your new password" value={values.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} error={form.errors.confirmPassword} />
        <PasswordChecklist id="reset-password-rules" password={values.password} confirmPassword={values.confirmPassword} />
        {form.formError ? <AuthMessage variant="error">{form.formError}</AuthMessage> : null}
        <Button type="submit" size="lg" fullWidth loading={form.pending} loadingText="Saving…">
          Reset password
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </form>
      <AuthBackLink />
    </>
  );
}
