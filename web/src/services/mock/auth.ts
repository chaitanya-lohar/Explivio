import type { AuthResponse, ForgotPasswordRequest, LoginCredentials, RegistrationDetails, ResetPasswordRequest } from "@/features/authentication/types";

/*
 * DEMO ONLY. Stand-in for a future authentication service. It does not check credentials,
 * create accounts or sessions, send email, or keep any submitted values (passwords included).
 * Replace these functions with real API calls; the server actions and forms stay unchanged.
 */

const DEMO_DELAY_MS = 600;
const pause = () => new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));

export async function mockSignIn(credentials: LoginCredentials): Promise<AuthResponse<LoginCredentials>> {
  void credentials; // never read or kept by the demo
  await pause();
  return { ok: true, message: "Demo sign-in complete. No account was checked and no session was created." };
}

export async function mockSignUp(details: RegistrationDetails): Promise<AuthResponse<RegistrationDetails>> {
  void details;
  await pause();
  return { ok: true, message: "Demo account step complete. No account was created." };
}

export async function mockRequestPasswordReset(request: ForgotPasswordRequest): Promise<AuthResponse<ForgotPasswordRequest>> {
  void request;
  await pause();
  return { ok: true, message: "Demo only: no email was sent." };
}

export async function mockResendVerification(): Promise<AuthResponse> {
  await pause();
  return { ok: true, message: "Demo only: no email was sent." };
}

export async function mockResetPassword(request: ResetPasswordRequest): Promise<AuthResponse<ResetPasswordRequest>> {
  void request;
  await pause();
  return { ok: true, message: "Demo only: no password was changed." };
}
