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

export type AuthErrorCode = "validation" | "invalid_credentials" | "unavailable" | "unknown";

export type AuthResponse<T = unknown> =
  | { ok: true; message: string }
  | { ok: false; code: AuthErrorCode; message: string; fieldErrors?: FieldErrors<T> };
