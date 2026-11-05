import { anonymize } from "../auth/crypto.ts";

/*
 * Security event log (F12): one JSON line per event on stdout, prefixed "[security]", for monitoring later (F14).
 * Safe by construction — only these fields can be written:
 *   event   what happened (fixed vocabulary below)
 *   userId  the internal account id (usr_…), never an email or name
 *   ip      a keyed, non-reversible hash of the client address (anonymize), never the address itself
 *   videoId run ids are not secret
 *   reason  a short fixed code
 * Passwords, tokens, cookies, emails, links, keys and headers are never passed in, so they can never be logged.
 */

export type SecurityEvent =
  | "signin_success"
  | "signin_failed"
  | "signin_rate_limited"
  | "signin_unverified"
  | "signin_previous_session_revoked"
  | "signout"
  | "signup_created"
  | "signup_existing_email"
  | "signup_rate_limited"
  | "verify_success"
  | "verify_failed"
  | "verification_resent"
  | "reset_requested"
  | "reset_rate_limited"
  | "reset_completed"
  | "reset_failed"
  | "access_denied"
  | "generation_limited";

export type SecurityFields = { userId?: string | null; ip?: string | null; videoId?: string; reason?: string; count?: number };

type Sink = (line: string) => void;
let sink: Sink = (line) => console.info(line);

/** Tests: capture the lines (null restores stdout). */
export function setSecuritySink(next: Sink | null): void {
  sink = next ?? ((line) => console.info(line));
}

export function securityEvent(event: SecurityEvent, fields: SecurityFields = {}): void {
  const record: Record<string, string | number> = { ts: new Date().toISOString(), event };
  if (fields.userId && /^usr_[0-9a-f]{32}$/.test(fields.userId)) record.userId = fields.userId;
  if (fields.ip) record.ip = anonymize(fields.ip);
  if (fields.videoId && /^[A-Za-z0-9_-]{1,80}$/.test(fields.videoId)) record.videoId = fields.videoId;
  if (fields.reason && /^[a-z_]{1,40}$/.test(fields.reason)) record.reason = fields.reason;
  if (typeof fields.count === "number") record.count = fields.count;
  try {
    sink(`[security] ${JSON.stringify(record)}`);
  } catch {
    /* logging must never break a request */
  }
}
