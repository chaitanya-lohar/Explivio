import { getDatabase } from "../../lib/db/mongo.ts";
import { COLLECTIONS, type EmailTokenDoc, type SessionDoc, type UserDoc, type UserSettingsDoc } from "../../lib/db/collections.ts";
import { dummyPasswordHash, hashPassword, hashToken, newToken, newUserId, verifyPassword } from "../../lib/auth/crypto.ts";
import { appUrl, emailMode, sendEmail, type DeliveryMode } from "../../lib/auth/email.ts";
import { clearLimit, hit, isLimited, LIMITS } from "../../lib/auth/rate-limit.ts";
import { validateEmail, validateNewPassword } from "../../features/authentication/validation/index.ts";
import { parsePreferences, type VideoPreferences } from "../../lib/preferences.ts";

/*
 * Self-managed accounts on MongoDB Atlas (F10). Independent of Next.js: server actions and route checks call these
 * functions and handle the cookies. Rules:
 *  - passwords: scrypt; tokens: 256-bit random, only SHA-256 hashes stored, single use (atomic), expiring;
 *  - answers that could reveal whether an account exists are identical either way (sign-up, forgot, resend);
 *  - passwords, tokens, links and email bodies are never logged.
 */

export const SESSION_DAYS = 7;
export const REMEMBER_DAYS = 30;
export const VERIFY_HOURS = 24;
export const RESET_MINUTES = 30;
const DAY = 86_400_000;

/** Overridable clock (tests). */
let clock = () => Date.now();
export function setClock(fn: (() => number) | null): void {
  clock = fn ?? (() => Date.now());
}

export type User = { id: string; email: string; name: string; emailVerified: boolean };
const toUser = (d: UserDoc): User => ({ id: d._id, email: d.email, name: d.name, emailVerified: d.emailVerified });

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function collections() {
  const db = await getDatabase();
  return {
    users: db.collection<UserDoc>(COLLECTIONS.users),
    sessions: db.collection<SessionDoc>(COLLECTIONS.sessions),
    tokens: db.collection<EmailTokenDoc>(COLLECTIONS.emailTokens),
    settings: db.collection<UserSettingsDoc>(COLLECTIONS.userSettings),
  };
}

const isDuplicateKey = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;

export async function findUserById(id: string): Promise<User | null> {
  const { users } = await collections();
  const doc = await users.findOne({ _id: id });
  return doc ? toUser(doc) : null;
}

// ---- Email tokens ------------------------------------------------------------------------------------------------

type Purpose = EmailTokenDoc["purpose"];
export type TokenProblem = "invalid" | "expired" | "used";

async function issueToken(userId: string, purpose: Purpose, ttlMs: number): Promise<string> {
  const { tokens } = await collections();
  const token = newToken();
  const now = new Date(clock());
  // Only the newest link of each kind works: older unused ones are retired.
  await tokens.updateMany({ userId, purpose, usedAt: null }, { $set: { usedAt: now } });
  await tokens.insertOne({ _id: hashToken(token), userId, purpose, createdAt: now, expiresAt: new Date(now.getTime() + ttlMs), usedAt: null });
  return token;
}

/** Uses a token exactly once (atomic), or says why it can't be used. */
async function consumeToken(token: string, purpose: Purpose): Promise<{ userId: string } | { problem: TokenProblem }> {
  if (!token || token.length > 200) return { problem: "invalid" };
  const { tokens } = await collections();
  const now = new Date(clock());
  const used = await tokens.findOneAndUpdate({ _id: hashToken(token), purpose, usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } });
  if (used) return { userId: used.userId };
  return { problem: await tokenProblem(token, purpose) };
}

async function tokenProblem(token: string, purpose: Purpose): Promise<TokenProblem> {
  const { tokens } = await collections();
  const doc = await tokens.findOne({ _id: hashToken(token), purpose });
  if (!doc) return "invalid";
  if (doc.usedAt) return "used";
  return doc.expiresAt.getTime() <= clock() ? "expired" : "invalid";
}

// ---- Sign up / verify / resend -------------------------------------------------------------------------------------

async function sendVerification(user: { id: string; email: string; name: string }): Promise<DeliveryMode> {
  const token = await issueToken(user.id, "verify_email", VERIFY_HOURS * 3_600_000);
  const result = await sendEmail({
    to: user.email,
    subject: "Verify your Explivio email address",
    text: `Hi ${user.name},\n\nConfirm your email address to activate your Explivio account:\n${appUrl()}/verify-email?token=${token}\n\nThis link works once and expires in ${VERIFY_HOURS} hours. If you didn't create an account, you can ignore this email.`,
  });
  return result.mode;
}

export type SignUpResult = { ok: true; delivery: DeliveryMode; pendingUserId: string | null } | { ok: false; code: "validation" | "rate_limited"; message: string };

/**
 * Creates an unverified account and emails a verification link. If the email already has an account, no second
 * account is created and its owner is told by email; the caller gets the same answer either way.
 */
export async function signUp(input: { name: string; email: string; password: string }, ip: string): Promise<SignUpResult> {
  const name = input.name.trim().slice(0, 80);
  const email = normalizeEmail(input.email);
  if (!name || validateEmail(email) || validateNewPassword(input.password)) return { ok: false, code: "validation", message: "Check the highlighted fields." };
  if (!hit(`signup:ip:${ip}`, LIMITS.signupPerIp).ok) return { ok: false, code: "rate_limited", message: "Too many sign-up attempts from this network. Please try again later." };

  const { users } = await collections();
  const existing = await users.findOne({ emailNormalized: email });
  if (existing) return { ok: true, delivery: await notifyExisting(existing), pendingUserId: null };

  const now = new Date(clock());
  const doc: UserDoc = { _id: newUserId(), email: input.email.trim(), emailNormalized: email, name, passwordHash: await hashPassword(input.password), emailVerified: false, emailVerifiedAt: null, status: "active", authProvider: "local", createdAt: now, updatedAt: now, passwordChangedAt: now };
  try {
    await users.insertOne(doc);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    // Lost a race with a simultaneous sign-up for the same email (unique index): same neutral answer.
    const winner = await users.findOne({ emailNormalized: email });
    return { ok: true, delivery: winner ? await notifyExisting(winner) : "outbox", pendingUserId: null };
  }
  hit(`cooldown:verify:${doc._id}`, LIMITS.emailCooldown);
  hit(`email:${doc._id}`, LIMITS.emailPerAccount);
  return { ok: true, delivery: await sendVerification({ id: doc._id, email: doc.email, name }), pendingUserId: doc._id };
}

async function notifyExisting(user: UserDoc): Promise<DeliveryMode> {
  if (!hit(`email:${user._id}`, LIMITS.emailPerAccount).ok) return emailMode();
  const result = await sendEmail({
    to: user.email,
    subject: "Someone tried to create an Explivio account with your email",
    text: `Hi ${user.name},\n\nSomeone tried to sign up for Explivio with this address, which already has an account.\nSign in: ${appUrl()}/login\nForgot your password? ${appUrl()}/forgot-password\n\nIf this wasn't you, you can ignore this email.`,
  });
  return result.mode;
}

export type VerifyResult = { ok: true; userId: string } | { ok: false; problem: TokenProblem };

export async function verifyEmail(token: string): Promise<VerifyResult> {
  const found = await consumeToken(token, "verify_email");
  if ("problem" in found) return { ok: false, problem: found.problem };
  const { users } = await collections();
  const now = new Date(clock());
  await users.updateOne({ _id: found.userId, emailVerified: false }, { $set: { emailVerified: true, emailVerifiedAt: now, updatedAt: now } });
  return { ok: true, userId: found.userId };
}

export type ResendResult = { ok: true; delivery: DeliveryMode } | { ok: false; code: "rate_limited"; message: string };

/**
 * Resends the verification link for the account waiting on verification (from the signed pending cookie). Without
 * such an account it answers the same way, so it can't be used to discover accounts.
 */
export async function resendVerification(pendingUserId: string | null): Promise<ResendResult> {
  const { users } = await collections();
  const user = pendingUserId ? await users.findOne({ _id: pendingUserId }) : null;
  const mode = emailMode();
  if (!user || user.emailVerified || user.status !== "active") return { ok: true, delivery: mode };
  if (isLimited(`cooldown:verify:${user._id}`, LIMITS.emailCooldown) || !hit(`email:${user._id}`, LIMITS.emailPerAccount).ok) return { ok: false, code: "rate_limited", message: "Please wait a little before requesting another email." };
  hit(`cooldown:verify:${user._id}`, LIMITS.emailCooldown);
  return { ok: true, delivery: await sendVerification({ id: user._id, email: user.email, name: user.name }) };
}

// ---- Sign in / sessions ----------------------------------------------------------------------------------------------

export type SignInResult =
  | { ok: true; sessionToken: string; expiresAt: Date; user: User }
  | { ok: false; code: "invalid_credentials" | "rate_limited" | "disabled"; message: string }
  | { ok: false; code: "unverified"; message: string; pendingUserId: string };

const INVALID = { ok: false as const, code: "invalid_credentials" as const, message: "Email or password is incorrect." };

export async function signIn(input: { email: string; password: string; rememberMe: boolean }, ip: string): Promise<SignInResult> {
  const email = normalizeEmail(input.email);
  const accountKey = `login:acct:${email}:${ip}`;
  if (isLimited(accountKey, LIMITS.loginPerAccount) || isLimited(`login:ip:${ip}`, LIMITS.loginPerIp)) {
    return { ok: false, code: "rate_limited", message: "Too many sign-in attempts. Wait 15 minutes and try again, or reset your password." };
  }
  const { users } = await collections();
  const doc = await users.findOne({ emailNormalized: email });
  // Same work whether or not the account exists, so response time doesn't reveal it.
  const valid = await verifyPassword(input.password, doc?.passwordHash ?? (await dummyPasswordHash()));
  if (!doc || !valid) {
    hit(accountKey, LIMITS.loginPerAccount);
    hit(`login:ip:${ip}`, LIMITS.loginPerIp);
    return INVALID;
  }
  if (doc.status !== "active") return { ok: false, code: "disabled", message: "This account is disabled." };
  // Only someone who knows the password learns that the email is unverified.
  if (!doc.emailVerified) return { ok: false, code: "unverified", message: "Verify your email address before signing in. We can send you a new link.", pendingUserId: doc._id };
  clearLimit(accountKey);
  const session = await createSession(doc._id, input.rememberMe);
  return { ok: true, sessionToken: session.token, expiresAt: session.expiresAt, user: toUser(doc) };
}

export async function createSession(userId: string, remember: boolean): Promise<{ token: string; expiresAt: Date }> {
  const { sessions } = await collections();
  const token = newToken();
  const now = new Date(clock());
  const expiresAt = new Date(now.getTime() + (remember ? REMEMBER_DAYS : SESSION_DAYS) * DAY);
  await sessions.insertOne({ _id: hashToken(token), userId, createdAt: now, expiresAt, lastSeenAt: now });
  return { token, expiresAt };
}

/** The signed-in user for a session cookie value, or null (unknown, expired, revoked, unverified or disabled). */
export async function userForSession(token: string | undefined): Promise<User | null> {
  if (!token || token.length > 200) return null;
  const { sessions, users } = await collections();
  const session = await sessions.findOne({ _id: hashToken(token) });
  if (!session) return null;
  const now = clock();
  // The TTL index deletes expired sessions within about a minute; this check covers the gap.
  if (session.expiresAt.getTime() <= now) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }
  const user = await users.findOne({ _id: session.userId });
  if (!user || user.status !== "active" || !user.emailVerified) return null;
  if (now - session.lastSeenAt.getTime() > 60_000) await sessions.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date(now) } });
  return toUser(user);
}

export async function signOut(token: string | undefined): Promise<void> {
  if (!token) return;
  const { sessions } = await collections();
  await sessions.deleteOne({ _id: hashToken(token) });
}

// ---- Forgot / reset ------------------------------------------------------------------------------------------------------

export type ForgotResult = { ok: true; delivery: DeliveryMode } | { ok: false; code: "rate_limited" | "validation"; message: string };

/** Always the same answer; an email is prepared only if the account exists (and limits allow). */
export async function requestPasswordReset(emailInput: string, ip: string): Promise<ForgotResult> {
  const email = normalizeEmail(emailInput);
  if (validateEmail(email)) return { ok: false, code: "validation", message: "Enter a valid email address." };
  if (!hit(`reset-request:ip:${ip}`, LIMITS.resetPerIp).ok) return { ok: false, code: "rate_limited", message: "Too many requests from this network. Please try again later." };
  const mode = emailMode();
  const { users } = await collections();
  const doc = await users.findOne({ emailNormalized: email });
  if (!doc || doc.status !== "active") return { ok: true, delivery: mode };
  if (isLimited(`cooldown:reset:${doc._id}`, LIMITS.emailCooldown) || !hit(`email:${doc._id}`, LIMITS.emailPerAccount).ok) return { ok: true, delivery: mode };
  hit(`cooldown:reset:${doc._id}`, LIMITS.emailCooldown);
  const token = await issueToken(doc._id, "reset_password", RESET_MINUTES * 60_000);
  const result = await sendEmail({
    to: doc.email,
    subject: "Reset your Explivio password",
    text: `Hi ${doc.name},\n\nUse this link to choose a new password:\n${appUrl()}/reset-password?token=${token}\n\nIt works once and expires in ${RESET_MINUTES} minutes. If you didn't ask for this, ignore this email: your password stays the same.`,
  });
  return { ok: true, delivery: result.mode };
}

/** Checks a reset link before the form is shown (doesn't use it). */
export async function checkResetToken(token: string): Promise<{ ok: true } | { ok: false; problem: TokenProblem }> {
  if (!token || token.length > 200) return { ok: false, problem: "invalid" };
  const { tokens } = await collections();
  const doc = await tokens.findOne({ _id: hashToken(token), purpose: "reset_password" });
  if (!doc) return { ok: false, problem: "invalid" };
  if (doc.usedAt) return { ok: false, problem: "used" };
  if (doc.expiresAt.getTime() <= clock()) return { ok: false, problem: "expired" };
  return { ok: true };
}

export type ResetResult = { ok: true } | { ok: false; code: "validation" | "rate_limited"; message: string } | { ok: false; code: "token"; problem: TokenProblem };

/** Sets a new password, uses up the link, signs the account out everywhere. Proves inbox access, so it also verifies. */
export async function resetPassword(token: string, password: string, ip: string): Promise<ResetResult> {
  if (validateNewPassword(password)) return { ok: false, code: "validation", message: "Check the highlighted fields." };
  if (!hit(`reset:ip:${ip}`, LIMITS.resetPerIp).ok) return { ok: false, code: "rate_limited", message: "Too many attempts from this network. Please try again later." };
  const passwordHash = await hashPassword(password); // before using the token, so a slow hash can't leave it half-used
  const found = await consumeToken(token, "reset_password");
  if ("problem" in found) return { ok: false, code: "token", problem: found.problem };
  const { users, sessions, tokens } = await collections();
  const now = new Date(clock());
  await users.updateOne({ _id: found.userId }, { $set: { passwordHash, passwordChangedAt: now, updatedAt: now, emailVerified: true }, $min: { emailVerifiedAt: now } });
  await tokens.updateMany({ userId: found.userId, usedAt: null }, { $set: { usedAt: now } });
  await sessions.deleteMany({ userId: found.userId });
  return { ok: true };
}

// ---- Per-user settings (the F7 preferences, now server-side) ---------------------------------------------------------------

export async function getPreferences(userId: string): Promise<VideoPreferences> {
  const { settings } = await collections();
  const doc = await settings.findOne({ _id: userId });
  return parsePreferences(doc ? JSON.stringify(doc.preferences) : null);
}

export async function savePreferences(userId: string, preferences: unknown): Promise<VideoPreferences> {
  // Validated field by field: anything invalid falls back to the default, nothing unknown is stored.
  const clean = parsePreferences(JSON.stringify(preferences ?? null));
  const { settings } = await collections();
  const now = new Date(clock());
  await settings.updateOne({ _id: userId }, { $set: { preferences: clean, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
  return clean;
}

// ---- Redirects ---------------------------------------------------------------------------------------------------------------

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

/** Only same-site paths are allowed after sign-in (no open redirects). Anything else goes home. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string" || next.length > 500) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\u0000-\u001f\\]/.test(next)) return "/";
  try {
    const url = new URL(next, "http://explivio.invalid");
    if (url.origin !== "http://explivio.invalid") return "/";
    return AUTH_PAGES.includes(url.pathname) ? "/" : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
