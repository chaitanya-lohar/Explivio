import type { FieldErrors, ForgotPasswordRequest, LoginCredentials, RegistrationDetails, ResetPasswordRequest } from "../types";

/** Shared by forms (instant feedback) and server actions (authoritative). Messages never echo passwords. */

export const PASSWORD_MIN_LENGTH = 8;
const NAME_MAX_LENGTH = 80;

// Pragmatic check: something@something.tld, no spaces. The server remains the final authority.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface PasswordRule {
  id: "length" | "numberOrSymbol";
  label: string;
  test: (password: string) => boolean;
}

/** Requirements for new passwords, shown as a checklist on sign-up and reset. */
export const passwordRules: readonly PasswordRule[] = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: "numberOrSymbol", label: "At least one number or symbol", test: (p) => /[\d\W_]/.test(p) },
];

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return "Enter a valid email address, like name@example.com.";
  return undefined;
}

/** For new passwords (sign-up and reset). */
export function validateNewPassword(password: string): string | undefined {
  if (!password) return "Enter a password.";
  const failed = passwordRules.find((rule) => !rule.test(password));
  return failed ? `Your password needs ${failed.label.charAt(0).toLowerCase()}${failed.label.slice(1)}.` : undefined;
}

function validateConfirmation(password: string, confirmPassword: string): string | undefined {
  if (!confirmPassword) return "Confirm your password.";
  if (password !== confirmPassword) return "Passwords don't match.";
  return undefined;
}

/** Drops undefined entries so an empty object means "valid". */
function compact<T>(errors: FieldErrors<T>): FieldErrors<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as FieldErrors<T>;
}

export function validateLogin(input: LoginCredentials): FieldErrors<LoginCredentials> {
  // Sign-in only checks presence: revealing the password policy here doesn't help the user.
  return compact<LoginCredentials>({ email: validateEmail(input.email), password: input.password ? undefined : "Enter your password." });
}

export function validateRegistration(input: RegistrationDetails): FieldErrors<RegistrationDetails> {
  const name = input.name.trim();
  return compact<RegistrationDetails>({
    name: !name ? "Enter your full name." : name.length > NAME_MAX_LENGTH ? `Keep your name under ${NAME_MAX_LENGTH} characters.` : undefined,
    email: validateEmail(input.email),
    password: validateNewPassword(input.password),
    confirmPassword: validateConfirmation(input.password, input.confirmPassword),
    acceptTerms: input.acceptTerms ? undefined : "Please accept the Terms of Service and Privacy Policy to continue.",
  });
}

export function validateForgotPassword(input: ForgotPasswordRequest): FieldErrors<ForgotPasswordRequest> {
  return compact<ForgotPasswordRequest>({ email: validateEmail(input.email) });
}

export function validateResetPassword(input: ResetPasswordRequest): FieldErrors<ResetPasswordRequest> {
  return compact<ResetPasswordRequest>({
    password: validateNewPassword(input.password),
    confirmPassword: validateConfirmation(input.password, input.confirmPassword),
  });
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: "Too short" | "Weak" | "Fair" | "Good" | "Strong" };

/** Rough guidance only (length and character variety); not a security guarantee. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return { score: 0, label: "Too short" };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const points = variety + (password.length >= 12 ? 1 : 0) + (password.length >= 16 ? 1 : 0);
  if (points >= 5) return { score: 4, label: "Strong" };
  if (points >= 4) return { score: 3, label: "Good" };
  if (points >= 3) return { score: 2, label: "Fair" };
  return { score: 1, label: "Weak" };
}

/** "alex.chen@studio.edu" -> "al***@studio.edu", for showing where a message would go without exposing the address. */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}
