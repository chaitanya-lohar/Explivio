"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Mail } from "lucide-react";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button, buttonStyles } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextInput } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signInAction } from "../actions";
import type { LoginCredentials } from "../types";
import { validateLogin } from "../validation";
import { useAuthForm } from "./use-auth-form";

export function LoginForm() {
  const resetDone = useSearchParams().get("reset") === "1";
  const [values, setValues] = useState<LoginCredentials>({ email: "", password: "", rememberMe: false });
  const [success, setSuccess] = useState<string | null>(null);
  const form = useAuthForm<LoginCredentials>({ idPrefix: "login", fieldOrder: ["email", "password"], validate: validateLogin, submit: signInAction, onSuccess: (r) => setSuccess(r.message) });
  const update = (field: keyof LoginCredentials, value: string | boolean) => {
    setValues((v) => ({ ...v, [field]: value }));
    form.clearError(field);
  };

  if (success) {
    return (
      <>
        <AuthHeader title="You're signed in (demo)" description="This screen shows what happens after a successful sign-in." />
        <AuthMessage variant="info" title="Demo only">
          {success}
        </AuthMessage>
        <Link href="/" className={buttonStyles({ size: "lg", fullWidth: true, className: "mt-6" })}>
          Continue to dashboard
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeader title="Welcome back" description="Sign in to keep creating educational videos." />
      {resetDone ? (
        <AuthMessage variant="success" title="Password updated" className="mb-6">
          Sign in with your new password. (Demo only: no password was actually changed.)
        </AuthMessage>
      ) : null}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit(values);
        }}
        className="flex flex-col gap-5"
      >
        <TextInput id="login-email" label="Email address" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" leadingIcon={<Mail />} value={values.email} onChange={(e) => update("email", e.target.value)} error={form.errors.email} />
        <PasswordInput
          id="login-password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={(e) => update("password", e.target.value)}
          error={form.errors.password}
          labelAside={
            <Link href="/forgot-password" className="inline-flex items-center rounded-[4px] text-meta font-semibold text-[#c7bfff] hover:text-foreground max-sm:min-h-11">
              Forgot password?
            </Link>
          }
        />
        <Checkbox id="login-remember" label="Remember me" checked={values.rememberMe} onChange={(e) => update("rememberMe", e.target.checked)} />
        {form.formError ? <AuthMessage variant="error">{form.formError}</AuthMessage> : null}
        <Button type="submit" size="lg" fullWidth loading={form.pending} loadingText="Signing in…">
          Sign in
        </Button>
      </form>
      <AuthFooter prompt="Don't have an account?" href="/signup" linkText="Create an account" />
    </>
  );
}
