"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, UserRound } from "lucide-react";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextInput } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signUpAction } from "../actions";
import type { RegistrationDetails } from "../types";
import { maskEmail, validateRegistration } from "../validation";
import { PasswordChecklist } from "./password-checklist";
import { useAuthForm } from "./use-auth-form";

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState<RegistrationDetails>({ name: "", email: "", password: "", confirmPassword: "", acceptTerms: false });
  const form = useAuthForm<RegistrationDetails>({
    idPrefix: "signup",
    fieldOrder: ["name", "email", "password", "confirmPassword", "acceptTerms"],
    validate: validateRegistration,
    submit: signUpAction,
    // Only a masked address travels in the URL, never the full email.
    onSuccess: (r) => router.push(`/verify-email?to=${encodeURIComponent(maskEmail(values.email))}${r.delivery ? `&delivery=${r.delivery}` : ""}`),
  });
  const update = (field: keyof RegistrationDetails, value: string | boolean) => {
    setValues((v) => ({ ...v, [field]: value }));
    form.clearError(field);
  };

  return (
    <>
      <AuthHeader title="Create your account" description="Start turning your ideas into educational videos." />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit(values);
        }}
        className="flex flex-col gap-5"
      >
        <TextInput id="signup-name" label="Full name" autoComplete="name" placeholder="Your name" leadingIcon={<UserRound />} value={values.name} onChange={(e) => update("name", e.target.value)} error={form.errors.name} />
        <TextInput id="signup-email" label="Email address" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" leadingIcon={<Mail />} value={values.email} onChange={(e) => update("email", e.target.value)} error={form.errors.email} />
        <PasswordInput id="signup-password" label="Password" autoComplete="new-password" placeholder="Create a password" value={values.password} onChange={(e) => update("password", e.target.value)} error={form.errors.password} aria-describedby="signup-password-rules" />
        <PasswordInput id="signup-confirmPassword" label="Confirm password" autoComplete="new-password" placeholder="Re-enter your password" value={values.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} error={form.errors.confirmPassword} />
        <PasswordChecklist id="signup-password-rules" password={values.password} confirmPassword={values.confirmPassword} />
        <Checkbox id="signup-acceptTerms" label="I agree to the Terms of Service and Privacy Policy" checked={values.acceptTerms} onChange={(e) => update("acceptTerms", e.target.checked)} error={form.errors.acceptTerms} />
        {form.formError ? <AuthMessage variant="error">{form.formError}</AuthMessage> : null}
        <Button type="submit" size="lg" fullWidth loading={form.pending} loadingText="Creating account…">
          Create account
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </form>
      <AuthFooter prompt="Already have an account?" href="/login" linkText="Sign in" />
    </>
  );
}
