/*
 * Email types (F13). Authentication code queues jobs (queue.ts); the worker (worker.ts) renders templates and hands the
 * finished message to a provider (outbox, resend or test). Nothing outside lib/email knows which provider is in use.
 */

/** The transactional emails Explivio sends. No marketing. */
export type EmailKind = "verify_email" | "reset_password" | "password_changed" | "account_exists";

export type Transport = "outbox" | "resend" | "smtp" | "test";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * What a provider can say about one submission. `accepted` means the provider took the message — NOT that it reached
 * the inbox. `unknown` means it may or may not have been accepted (timeout, ambiguous server error): never resend
 * automatically, or the user could get duplicates.
 */
export type SendResult =
  | { status: "accepted"; messageId?: string }
  | { status: "rejected"; code: string; retryable: boolean; retryAfterMs?: number; quota?: "daily" | "monthly" }
  | { status: "unknown"; code: string };

export interface EmailProvider {
  readonly name: Transport;
  /** `idempotencyKey` is stable for this exact message: the provider may use it to drop duplicates. */
  send(email: OutgoingEmail, idempotencyKey: string): Promise<SendResult>;
}
