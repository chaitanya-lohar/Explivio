"use server";

import { redirect } from "next/navigation";
import { clearPendingVerification, clearSessionCookie, clientIp, pendingVerification, sessionToken, setPendingVerification, setSessionCookie } from "@/lib/auth/session";
import * as auth from "@/services/auth/service";
import type { AuthResponse, EmailDelivery, ForgotPasswordRequest, LoginCredentials, RegistrationDetails, ResetPasswordRequest } from "./types";
import { validateForgotPassword, validateLogin, validateRegistration, validateResetPassword } from "./validation";

/*
 * Server boundary for authentication (F10). Each action re-validates its input (any POST can call it), calls the
 * account service (services/auth, MongoDB) and handles cookies. Next.js checks the Origin of every action call
 * (CSRF). Inputs are never logged or echoed back; messages describe rules, never values.
 */

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const invalid = { ok: false as const, code: "validation" as const, message: "Check the highlighted fields." };
const unavailable = { ok: false as const, code: "unavailable" as const, message: "Accounts are temporarily unavailable. Please try again in a moment." };

/** Honest wording: an outbox message was saved locally, not sent. */
function deliveryNote(delivery: EmailDelivery): string {
  return delivery === "outbox"
    ? "Development mode: no email was sent. The message was saved to this server's outbox folder (data/outbox)."
    : "Check your inbox (and spam folder).";
}

/** Any unexpected failure (e.g. database unreachable) becomes a generic message; details stay on the server. */
async function guarded<T>(work: () => Promise<AuthResponse<T>>): Promise<AuthResponse<T>> {
  try {
    return await work();
  } catch (error) {
    console.warn(`[auth] ${error instanceof Error ? error.name : "Error"} during an auth action`);
    return unavailable;
  }
}

export async function signInAction(input: LoginCredentials, next?: string): Promise<AuthResponse<LoginCredentials>> {
  const data: LoginCredentials = { email: asString(input?.email).trim(), password: asString(input?.password), rememberMe: Boolean(input?.rememberMe) };
  const fieldErrors = validateLogin(data);
  if (Object.keys(fieldErrors).length) return { ...invalid, fieldErrors };
  return guarded(async () => {
    const result = await auth.signIn(data, await clientIp());
    if (result.ok) {
      await setSessionCookie(result.sessionToken, result.expiresAt, data.rememberMe);
      await clearPendingVerification();
      return { ok: true, message: "Signed in.", redirectTo: auth.safeNextPath(asString(next)) };
    }
    if (result.code === "unverified") {
      await setPendingVerification(result.pendingUserId);
      return { ok: false, code: "unverified", message: result.message };
    }
    return { ok: false, code: result.code === "disabled" ? "invalid_credentials" : result.code, message: result.message };
  });
}

export async function signUpAction(input: RegistrationDetails): Promise<AuthResponse<RegistrationDetails>> {
  const data: RegistrationDetails = {
    name: asString(input?.name).trim(),
    email: asString(input?.email).trim(),
    password: asString(input?.password),
    confirmPassword: asString(input?.confirmPassword),
    acceptTerms: input?.acceptTerms === true,
  };
  const fieldErrors = validateRegistration(data);
  if (Object.keys(fieldErrors).length) return { ...invalid, fieldErrors };
  return guarded(async () => {
    const result = await auth.signUp(data, await clientIp());
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    // Same answer whether or not the email already had an account (no account enumeration).
    if (result.pendingUserId) await setPendingVerification(result.pendingUserId);
    return { ok: true, message: deliveryNote(result.delivery), delivery: result.delivery };
  });
}

export async function resendVerificationAction(): Promise<AuthResponse> {
  return guarded(async () => {
    const result = await auth.resendVerification(await pendingVerification());
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, message: `If this account still needs verifying, a new link was created. ${deliveryNote(result.delivery)}`, delivery: result.delivery };
  });
}

const TOKEN_MESSAGES: Record<auth.TokenProblem, string> = {
  invalid: "This link isn't valid. It may be incomplete; open it again from the email, or ask for a new one.",
  expired: "This link has expired. Ask for a new one.",
  used: "This link has already been used.",
};

export async function verifyEmailAction(token: string): Promise<AuthResponse> {
  return guarded(async () => {
    const result = await auth.verifyEmail(asString(token));
    if (!result.ok) return { ok: false, code: "token", message: TOKEN_MESSAGES[result.problem] };
    await clearPendingVerification();
    return { ok: true, message: "Your email address is verified. You can sign in now." };
  });
}

export async function requestPasswordResetAction(input: ForgotPasswordRequest): Promise<AuthResponse<ForgotPasswordRequest>> {
  const data: ForgotPasswordRequest = { email: asString(input?.email).trim() };
  const fieldErrors = validateForgotPassword(data);
  if (Object.keys(fieldErrors).length) return { ...invalid, fieldErrors };
  return guarded(async () => {
    const result = await auth.requestPasswordReset(data.email, await clientIp());
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, message: deliveryNote(result.delivery), delivery: result.delivery };
  });
}

export async function checkResetLinkAction(token: string): Promise<AuthResponse> {
  return guarded(async () => {
    const result = await auth.checkResetToken(asString(token));
    return result.ok ? { ok: true, message: "" } : { ok: false, code: "token", message: TOKEN_MESSAGES[result.problem] };
  });
}

export async function resetPasswordAction(input: ResetPasswordRequest): Promise<AuthResponse<ResetPasswordRequest>> {
  const data: ResetPasswordRequest = { token: asString(input?.token) || undefined, password: asString(input?.password), confirmPassword: asString(input?.confirmPassword) };
  const fieldErrors = validateResetPassword(data);
  if (Object.keys(fieldErrors).length) return { ...invalid, fieldErrors };
  if (!data.token) return { ok: false, code: "token", message: TOKEN_MESSAGES.invalid };
  return guarded(async () => {
    const result = await auth.resetPassword(data.token!, data.password, await clientIp());
    if (result.ok) {
      await clearSessionCookie(); // every session of this account was revoked
      return { ok: true, message: "Password updated." };
    }
    if (result.code === "token") return { ok: false, code: "token", message: TOKEN_MESSAGES[result.problem] };
    return { ok: false, code: result.code, message: result.message };
  });
}

export async function signOutAction(): Promise<void> {
  try {
    await auth.signOut(await sessionToken());
  } finally {
    await clearSessionCookie();
  }
  redirect("/login");
}
