"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { AuthBackLink } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPasswordAction } from "../actions";
import type { ResetPasswordRequest } from "../types";
import { validateResetPassword } from "../validation";
import { PasswordChecklist } from "./password-checklist";
import { PasswordStrengthIndicator, PasswordStrengthLabel } from "./password-strength-indicator";
import { useAuthForm } from "./use-auth-form";

export function ResetPasswordForm() {
  const router = useRouter();
  // A future backend will put a one-time token in the reset link; it is passed through untouched.
  const token = useSearchParams().get("token") ?? undefined;
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
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
