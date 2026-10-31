"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, MailCheck, Send } from "lucide-react";
import { AuthBackLink } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button, buttonStyles } from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import { requestPasswordResetAction } from "../actions";
import type { ForgotPasswordRequest } from "../types";
import { maskEmail, validateForgotPassword } from "../validation";
import { useAuthForm } from "./use-auth-form";

export function ForgotPasswordForm() {
  const [values, setValues] = useState<ForgotPasswordRequest>({ email: "" });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const form = useAuthForm<ForgotPasswordRequest>({
    idPrefix: "forgot",
    fieldOrder: ["email"],
    validate: validateForgotPassword,
    submit: requestPasswordResetAction,
    onSuccess: (r) => {
      setSentTo(maskEmail(values.email));
      setNotice(r.message);
    },
  });

  if (sentTo) {
    return (
      <>
        <AuthHeader align="center" icon={<MailCheck />} title="Check your email" description={<>If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, you&apos;ll receive a link to reset your password.</>} />
        <AuthMessage variant="info" title="Demo only">
          {notice}
        </AuthMessage>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/login" className={buttonStyles({ size: "lg", fullWidth: true })}>
            Back to login
          </Link>
          <Button variant="ghost" fullWidth onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeader icon={<KeyRound />} title="Forgot your password?" description="Enter the email address you signed up with and we'll send you a link to reset your password." />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit(values);
        }}
        className="flex flex-col gap-5"
      >
        <TextInput
          id="forgot-email"
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
          leadingIcon={<Mail />}
          value={values.email}
          onChange={(e) => {
            setValues({ email: e.target.value });
            form.clearError("email");
          }}
          error={form.errors.email}
        />
        {form.formError ? <AuthMessage variant="error">{form.formError}</AuthMessage> : null}
        <Button type="submit" size="lg" fullWidth loading={form.pending} loadingText="Sending…" icon={<Send className="size-4" />}>
          Send reset link
        </Button>
      </form>
      <AuthBackLink />
    </>
  );
}

