/** Shapes shared by the auth forms, validation and the (future) auth backend. */

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegistrationDetails {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  /** One-time token from the reset link; optional until a backend issues real tokens. */
  token?: string;
  password: string;
  confirmPassword: string;
}

/** Per-field messages keyed by form field name. Never contains password values. */
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export type AuthErrorCode = "validation" | "invalid_credentials" | "unverified" | "rate_limited" | "token" | "unavailable" | "unknown";

/** How an email was handled: really sent, or (development) saved to the local outbox and NOT sent. */
export type EmailDelivery = "resend" | "outbox";

export type AuthResponse<T = unknown> =
  | { ok: true; message: string; redirectTo?: string; delivery?: EmailDelivery }
  | { ok: false; code: AuthErrorCode; message: string; fieldErrors?: FieldErrors<T> };
