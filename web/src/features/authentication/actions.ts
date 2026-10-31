"use server";

import * as authService from "@/services";
import type { AuthResponse, ForgotPasswordRequest, LoginCredentials, RegistrationDetails, ResetPasswordRequest } from "./types";
import { validateForgotPassword, validateLogin, validateRegistration, validateResetPassword } from "./validation";

/*
 * Server boundary for authentication. Each action re-validates its input (it can be called by any POST)
 * and then calls the auth service — currently a demo mock (see services/mock/auth.ts). Inputs are never
 * logged or echoed back; validation messages describe the rule, not the value.
 */

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const invalid = { ok: false as const, code: "validation" as const, message: "Check the highlighted fields." };
const failed = { ok: false as const, code: "unknown" as const, message: "Something went wrong. Please try again." };

export async function signInAction(input: LoginCredentials): Promise<AuthResponse<LoginCredentials>> {
  const data: LoginCredentials = { email: asString(input?.email).trim(), password: asString(input?.password), rememberMe: Boolean(input?.rememberMe) };
  const fieldErrors = validateLogin(data);
  if (Object.keys(fieldErrors).length) return { ...invalid, fieldErrors };
  try {
    return await authService.signIn(data);
  } catch {
    return failed;
  }
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
  try {
    return await authService.signUp(data);
  } catch {
    return failed;
  }
}

export async function requestPasswordResetAction(input: ForgotPasswordRequest): Promise<AuthResponse<ForgotPasswordRequest>> {
  const data: ForgotPasswordRequest = { email: asString(input?.email).trim() };
  const fieldErrors = validateForgotPassword(data);
  if (Object.keys(fieldErrors).length) return { ...invalid, fieldErrors };
  try {
    return await authService.requestPasswordReset(data);
  } catch {
    return failed;
  }
}

export async function resendVerificationAction(): Promise<AuthResponse> {
  try {
    return await authService.resendVerification();
  } catch {
    return failed;
  }
}

export async function resetPasswordAction(input: ResetPasswordRequest): Promise<AuthResponse<ResetPasswordRequest>> {
  const data: ResetPasswordRequest = { token: asString(input?.token) || undefined, password: asString(input?.password), confirmPassword: asString(input?.confirmPassword) };
  const fieldErrors = validateResetPassword(data);
  if (Object.keys(fieldErrors).length) return { ...invalid, fieldErrors };
  try {
    return await authService.resetPassword(data);
  } catch {
    return failed;
  }
}
