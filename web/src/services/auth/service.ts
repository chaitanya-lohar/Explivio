import { getDatabase } from "../../lib/db/mongo.ts";
import { COLLECTIONS, type EmailTokenDoc, type SessionDoc, type UserDoc, type UserSettingsDoc } from "../../lib/db/collections.ts";
import { dummyPasswordHash, hashPassword, hashToken, newToken, newUserId, verifyPassword } from "../../lib/auth/crypto.ts";
import { emailMode, type DeliveryMode } from "../../lib/auth/email.ts";
import { enqueueEmail } from "../../lib/email/queue.ts";
import { clearLimit, hit, isLimited, LIMITS } from "../../lib/auth/rate-limit.ts";
import { validateEmail, validateNewPassword } from "../../features/authentication/validation/index.ts";
import { securityEvent } from "../../lib/security/log.ts";
import { parsePreferences, type VideoPreferences } from "../../lib/preferences.ts";

/*
 * Self-managed accounts on MongoDB Atlas (F10). Independent of Next.js: server actions and route checks call these
 * functions and handle the cookies. Rules:
 *  - passwords: scrypt; tokens: 256-bit random, only SHA-256 hashes stored, single use (atomic), expiring;
 *  - answers that could reveal whether an account exists are identical either way (sign-up, forgot, resend);
 *  - passwords, tokens, links and email bodies are never logged.
 * F12 hardening:
 *  - sign-in failures are limited per ACCOUNT (any address), stored in MongoDB (lib/auth/rate-limit.ts);
 *  - sign-up, forgot-password and resend take the same minimum time and do the same expensive work whether or not the
 *    account exists, so response time doesn't reveal registered emails;
 *  - passwords longer than MAX_PASSWORD_LENGTH are refused by the server (the UI rules are unchanged);
 *  - security events are logged without secrets (lib/security/log.ts).
 * F13: emails are queued (lib/email/queue.ts) and sent by a worker, so no request waits for an email provider. The
 * worker creates the email's link token at send time (createPendingEmailToken / settleEmailToken below), so no raw
 * token is ever stored, and a failed send never invalidates a link that was already delivered.
 */

export const SESSION_DAYS = 7;
export const REMEMBER_DAYS = 30;
export const VERIFY_HOURS = 24;
export const RESET_MINUTES = 30;
const DAY = 86_400_000;
/** Server-side cap (scrypt input). Longer inputs are rejected on sign-up/reset and are simply wrong on sign-in. */
export const MAX_PASSWORD_LENGTH = 256;

/**
 * Minimum response times (ms) for answers that must not reveal whether an account exists. Each is above the slowest
 * path measured against Atlas (see the F12 report); tests can lower them.
 */
const FLOORS = { signUp: 1500, forgot: 1200, resend: 1200 };
export function setResponseFloors(next: Partial<typeof FLOORS> | null): void {
  Object.assign(FLOORS, next ?? { signUp: 1500, forgot: 1200, resend: 1200 });
}
async function atLeast<T>(ms: number, work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await work();
  } finally {
    const left = ms - (Date.now() - started);
    if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
  }
}

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


const TTL: Record<Purpose, number> = { verify_email: VERIFY_HOURS * 3_600_000, reset_password: RESET_MINUTES * 60_000 };

/**
 * F13 worker: creates the link token for an email about to be sent, WITHOUT retiring the user's older links yet (the send
 * may still fail). Only the hash is stored. Settle it with settleEmailToken once the provider has answered.
 */
export async function createPendingEmailToken(userId: string, purpose: Purpose): Promise<{ token: string; hash: string }> {
  const { tokens } = await collections();
  const token = newToken();
  const now = new Date(clock());
  const hash = hashToken(token);
  await tokens.insertOne({ _id: hash, userId, purpose, createdAt: now, expiresAt: new Date(now.getTime() + TTL[purpose]), usedAt: null });
  return { token, hash };
}

/**
 * accepted → this becomes the only working link of its kind (older unused ones retired);
 * rejected → the never-delivered token is deleted (older links keep working);
 * unknown  → nothing changes (it may or may not have arrived; both stay valid until they expire).
 */
export async function settleEmailToken(userId: string, purpose: Purpose, hash: string, outcome: "accepted" | "rejected" | "unknown"): Promise<void> {
  const { tokens } = await collections();
  if (outcome === "accepted") await tokens.updateMany({ userId, purpose, usedAt: null, _id: { $ne: hash } }, { $set: { usedAt: new Date(clock()) } });
  if (outcome === "rejected") await tokens.deleteOne({ _id: hash, usedAt: null });
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

/** Queues the verification email (the worker creates the link when it sends). */
async function sendVerification(user: { id: string; email: string; name: string }): Promise<DeliveryMode> {
  await enqueueEmail("verify_email", user);
  return emailMode();
}

export type SignUpResult = { ok: true; delivery: DeliveryMode; pendingUserId: string | null } | { ok: false; code: "validation" | "rate_limited"; message: string };

/**
 * Creates an unverified account and emails a verification link. If the email already has an account, no second
 * account is created and its owner is told by email; the caller gets the same answer either way.
 */
export async function signUp(input: { name: string; email: string; password: string }, ip: string): Promise<SignUpResult> {
  const name = input.name.trim().slice(0, 80);
  const email = normalizeEmail(input.email);
  if (!name || validateEmail(email) || validateNewPassword(input.password) || input.password.length > MAX_PASSWORD_LENGTH) return { ok: false, code: "validation", message: "Check the highlighted fields." };
  return atLeast(FLOORS.signUp, () => createAccount(name, email, input, ip));
}

async function createAccount(name: string, email: string, input: { email: string; password: string }, ip: string): Promise<SignUpResult> {
  if (!(await hit(`signup:ip:${ip}`, LIMITS.signupPerIp, clock())).ok || !(await hit("signup:global", LIMITS.signupGlobal, clock())).ok) {
    securityEvent("signup_rate_limited", { ip });
    return { ok: false, code: "rate_limited", message: "Too many sign-up attempts from this network. Please try again later." };
  }
  // The password is hashed whether or not the email is taken: the same expensive work either way (F12).
  const passwordHash = await hashPassword(input.password);
  const { users } = await collections();
  const existing = await users.findOne({ emailNormalized: email });
  if (existing) {
    securityEvent("signup_existing_email", { userId: existing._id, ip });
    return { ok: true, delivery: await notifyExisting(existing), pendingUserId: null };
  }

  const now = new Date(clock());
  const doc: UserDoc = { _id: newUserId(), email: input.email.trim(), emailNormalized: email, name, passwordHash, emailVerified: false, emailVerifiedAt: null, status: "active", authProvider: "local", createdAt: now, updatedAt: now, passwordChangedAt: now };
  try {
    await users.insertOne(doc);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    // Lost a race with a simultaneous sign-up for the same email (unique index): same neutral answer.
    const winner = await users.findOne({ emailNormalized: email });
    return { ok: true, delivery: winner ? await notifyExisting(winner) : "outbox", pendingUserId: null };
  }
  await hit(`cooldown:verify:${doc._id}`, LIMITS.emailCooldown, clock());
  await hit(`email:${doc._id}`, LIMITS.emailPerAccount, clock());
  securityEvent("signup_created", { userId: doc._id, ip });
  return { ok: true, delivery: await sendVerification({ id: doc._id, email: doc.email, name }), pendingUserId: doc._id };
}

async function notifyExisting(user: UserDoc): Promise<DeliveryMode> {
  if (!(await hit(`email:${user._id}`, LIMITS.emailPerAccount, clock())).ok) return emailMode();
  await enqueueEmail("account_exists", { id: user._id, email: user.email, name: user.name });
  return emailMode();
}

export type VerifyResult = { ok: true; userId: string } | { ok: false; problem: TokenProblem };

export async function verifyEmail(token: string): Promise<VerifyResult> {
  const found = await consumeToken(token, "verify_email");
  if ("problem" in found) {
    securityEvent("verify_failed", { reason: found.problem });
    return { ok: false, problem: found.problem };
  }
  securityEvent("verify_success", { userId: found.userId });
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
  return atLeast(FLOORS.resend, async () => {
    const { users } = await collections();
    const user = pendingUserId ? await users.findOne({ _id: pendingUserId }) : null;
    const mode = emailMode();
    if (!user || user.emailVerified || user.status !== "active") return { ok: true, delivery: mode };
    if ((await isLimited(`cooldown:verify:${user._id}`, LIMITS.emailCooldown, clock())) || !(await hit(`email:${user._id}`, LIMITS.emailPerAccount, clock())).ok) {
      return { ok: false, code: "rate_limited", message: "Please wait a little before requesting another email." };
    }
    await hit(`cooldown:verify:${user._id}`, LIMITS.emailCooldown, clock());
    securityEvent("verification_resent", { userId: user._id });
    return { ok: true, delivery: await sendVerification({ id: user._id, email: user.email, name: user.name }) };
  });
}

// ---- Sign in / sessions ----------------------------------------------------------------------------------------------

export type SignInResult =
  | { ok: true; sessionToken: string; expiresAt: Date; user: User }
  | { ok: false; code: "invalid_credentials" | "rate_limited" | "disabled"; message: string }
  | { ok: false; code: "unverified"; message: string; pendingUserId: string };

const INVALID = { ok: false as const, code: "invalid_credentials" as const, message: "Email or password is incorrect." };

export async function signIn(input: { email: string; password: string; rememberMe: boolean }, ip: string): Promise<SignInResult> {
  const email = normalizeEmail(input.email);
  // Per account, whatever the client address (the address can be forged): F12.
  const accountKey = `login:acct:${email}`;
  const ipKey = `login:ip:${ip}`;
  const now = clock();
  if ((await isLimited(accountKey, LIMITS.loginPerAccount, now)) || (await isLimited(ipKey, LIMITS.loginPerIp, now))) {
    securityEvent("signin_rate_limited", { ip });
    return { ok: false, code: "rate_limited", message: "Too many sign-in attempts. Wait 15 minutes and try again, or reset your password." };
  }
  const { users } = await collections();
  const doc = await users.findOne({ emailNormalized: email });
  // Same work whether or not the account exists, so response time doesn't reveal it. Over-long input is just wrong.
  const valid = input.password.length <= MAX_PASSWORD_LENGTH && (await verifyPassword(input.password, doc?.passwordHash ?? (await dummyPasswordHash())));
  if (!doc || !valid) {
    const failures = await hit(accountKey, LIMITS.loginPerAccount, now);
    await hit(ipKey, LIMITS.loginPerIp, now);
    securityEvent("signin_failed", { userId: doc?._id, ip, count: failures.count });
    return INVALID;
  }
  if (doc.status !== "active") {
    securityEvent("signin_failed", { userId: doc._id, ip, reason: "disabled" });
    return { ok: false, code: "disabled", message: "This account is disabled." };
  }
  // Only someone who knows the password learns that the email is unverified.
  if (!doc.emailVerified) {
    securityEvent("signin_unverified", { userId: doc._id, ip });
    return { ok: false, code: "unverified", message: "Verify your email address before signing in. We can send you a new link.", pendingUserId: doc._id };
  }
  await clearLimit(accountKey);
  const session = await createSession(doc._id, input.rememberMe);
  securityEvent("signin_success", { userId: doc._id, ip });
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

/** Deletes the session behind a cookie value (sign-out, or the browser's old session on a new sign-in). */
export async function signOut(token: string | undefined, reason: "signout" | "replaced" = "signout"): Promise<void> {
  if (!token || token.length > 200) return;
  const { sessions } = await collections();
  const removed = await sessions.findOneAndDelete({ _id: hashToken(token) });
  if (removed) securityEvent(reason === "signout" ? "signout" : "signin_previous_session_revoked", { userId: removed.userId });
}

// ---- Forgot / reset ------------------------------------------------------------------------------------------------------

export type ForgotResult = { ok: true; delivery: DeliveryMode } | { ok: false; code: "rate_limited" | "validation"; message: string };

/** Always the same answer; an email is prepared only if the account exists (and limits allow). */
export async function requestPasswordReset(emailInput: string, ip: string): Promise<ForgotResult> {
  const email = normalizeEmail(emailInput);
  if (validateEmail(email)) return { ok: false, code: "validation", message: "Enter a valid email address." };
  return atLeast(FLOORS.forgot, () => prepareReset(email, ip));
}

async function prepareReset(email: string, ip: string): Promise<ForgotResult> {
  if (!(await hit(`reset-request:ip:${ip}`, LIMITS.resetPerIp, clock())).ok) {
    securityEvent("reset_rate_limited", { ip });
    return { ok: false, code: "rate_limited", message: "Too many requests from this network. Please try again later." };
  }
  const mode = emailMode();
  const { users } = await collections();
  const doc = await users.findOne({ emailNormalized: email });
  if (!doc || doc.status !== "active") return { ok: true, delivery: mode };
  if ((await isLimited(`cooldown:reset:${doc._id}`, LIMITS.emailCooldown, clock())) || !(await hit(`email:${doc._id}`, LIMITS.emailPerAccount, clock())).ok) return { ok: true, delivery: mode };
  await hit(`cooldown:reset:${doc._id}`, LIMITS.emailCooldown, clock());
  securityEvent("reset_requested", { userId: doc._id, ip });
  await enqueueEmail("reset_password", { id: doc._id, email: doc.email, name: doc.name });
  return { ok: true, delivery: mode };
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
  if (validateNewPassword(password) || password.length > MAX_PASSWORD_LENGTH) return { ok: false, code: "validation", message: "Check the highlighted fields." };
  if (!(await hit(`reset:ip:${ip}`, LIMITS.resetPerIp, clock())).ok) {
    securityEvent("reset_rate_limited", { ip });
    return { ok: false, code: "rate_limited", message: "Too many attempts from this network. Please try again later." };
  }
  const passwordHash = await hashPassword(password); // before using the token, so a slow hash can't leave it half-used
  const found = await consumeToken(token, "reset_password");
  if ("problem" in found) {
    securityEvent("reset_failed", { ip, reason: found.problem });
    return { ok: false, code: "token", problem: found.problem };
  }
  const { users, sessions, tokens } = await collections();
  const now = new Date(clock());
  await users.updateOne({ _id: found.userId }, { $set: { passwordHash, passwordChangedAt: now, updatedAt: now, emailVerified: true }, $min: { emailVerifiedAt: now } });
  await tokens.updateMany({ userId: found.userId, usedAt: null }, { $set: { usedAt: now } });
  const revoked = await sessions.deleteMany({ userId: found.userId });
  await clearLimit(`login:acct:${(await users.findOne({ _id: found.userId }, { projection: { emailNormalized: 1 } }))?.emailNormalized ?? ""}`);
  securityEvent("reset_completed", { userId: found.userId, ip, count: revoked.deletedCount });
  // F13: tell the owner (a queued job; a failure here never undoes the reset).
  const owner = await users.findOne({ _id: found.userId }, { projection: { email: 1, name: 1 } });
  if (owner) await enqueueEmail("password_changed", { id: owner._id, email: owner.email, name: owner.name }).catch(() => {});
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
