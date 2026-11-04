"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextInput } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signInAction } from "../actions";
import type { LoginCredentials } from "../types";
import { validateLogin } from "../validation";
import { useAuthForm } from "./use-auth-form";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const resetDone = params.get("reset") === "1";
  const verified = params.get("verified") === "1";
  // Where to go after signing in; the server only accepts same-site paths.
  const next = params.get("next") ?? undefined;
  const [values, setValues] = useState<LoginCredentials>({ email: "", password: "", rememberMe: false });
  const form = useAuthForm<LoginCredentials>({
    idPrefix: "login",
    fieldOrder: ["email", "password"],
    validate: validateLogin,
    submit: (v) => signInAction(v, next),
    onSuccess: (r) => {
      router.replace(r.redirectTo ?? "/");
      router.refresh();
    },
  });
  const update = (field: keyof LoginCredentials, value: string | boolean) => {
    setValues((v) => ({ ...v, [field]: value }));
    form.clearError(field);
  };

  return (
    <>
      <AuthHeader title="Welcome back" description="Sign in to keep creating educational videos." />
      {resetDone ? (
        <AuthMessage variant="success" title="Password updated" className="mb-6">
          Sign in with your new password. You were signed out on all devices.
        </AuthMessage>
      ) : null}
      {verified ? (
        <AuthMessage variant="success" title="Email verified" className="mb-6">
          Your account is active. Sign in to continue.
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
        {form.formError ? (
          <AuthMessage variant="error">
            {form.formError}
            {form.formCode === "unverified" ? (
              <>
                {" "}
                <Link href="/verify-email" className="font-semibold underline underline-offset-2">
                  Get a new verification link
                </Link>
              </>
            ) : null}
          </AuthMessage>
        ) : null}
        <Button type="submit" size="lg" fullWidth loading={form.pending} loadingText="Signing in…">
          Sign in
        </Button>
      </form>
      <AuthFooter prompt="Don't have an account?" href="/signup" linkText="Create an account" />
    </>
  );
}
