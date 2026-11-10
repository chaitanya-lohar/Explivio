import nodemailer, { type Transporter } from "nodemailer";
import type { EmailProvider, OutgoingEmail, SendResult } from "../types.ts";

/*
 * SMTP provider (pilot, 2026-11-10): e.g. Brevo's free plan (smtp-relay.brevo.com:587, about 300 emails/day) with a
 * single verified sender address, because free public domains can't be verified with Resend or Brevo.
 * Server-only. The SMTP password is only handed to Nodemailer; it never appears in results, errors or logs.
 *
 * Outcomes:
 *  - the server accepted the message (250) → accepted (NOT proof of inbox delivery);
 *  - 4xx reply (temporary: busy, rate limit) or a connection that never opened → retryable rejection;
 *  - 5xx reply (bad sender, bad recipient, auth, daily limit) → permanent rejection, never retried automatically;
 *  - a timeout or broken connection after the message was handed over → unknown (never resent: no duplicates).
 */

export type SmtpSettings = { host: string; port: number; user: string; pass: string; from: string };

const NOT_CONNECTED = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "ECONNECTION", "EDNS"]);

/** Turns a Nodemailer error into a safe outcome (codes only; no server text, which can echo addresses). */
export function classifySmtpError(error: unknown): SendResult {
  const err = (error ?? {}) as { code?: string; responseCode?: number; command?: string };
  const responseCode = Number(err.responseCode) || 0;
  if (err.code === "EAUTH") return { status: "rejected", code: "smtp_auth_failed", retryable: false };
  if (responseCode >= 500) return { status: "rejected", code: `smtp_${responseCode}`, retryable: false };
  if (responseCode >= 400) return { status: "rejected", code: `smtp_${responseCode}`, retryable: true };
  if (err.code && NOT_CONNECTED.has(err.code)) return { status: "rejected", code: "network_unreachable", retryable: true };
  // Timed out or dropped once the message data was being sent: it may have been accepted.
  if (err.code === "ETIMEDOUT" || err.code === "ESOCKET" || err.code === "ECONNRESET") return err.command === "CONN" ? { status: "rejected", code: "network_unreachable", retryable: true } : { status: "unknown", code: "smtp_connection_lost" };
  return { status: "unknown", code: "smtp_error" };
}

export function createSmtpProvider(settings: SmtpSettings, transport?: Pick<Transporter, "sendMail">): EmailProvider {
  const mailer =
    transport ??
    nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      // 465 = TLS from the start; 587 = STARTTLS, required (never send credentials in clear text).
      secure: settings.port === 465,
      requireTLS: settings.port !== 465,
      auth: { user: settings.user, pass: settings.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: { minVersion: "TLSv1.2" },
    });
  return {
    name: "smtp",
    async send(email: OutgoingEmail, idempotencyKey: string): Promise<SendResult> {
      try {
        const info = await mailer.sendMail({ from: settings.from, to: email.to, subject: email.subject, html: email.html, text: email.text, messageId: `<${idempotencyKey.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 64)}@explivio>` });
        if (Array.isArray(info.rejected) && info.rejected.length) return { status: "rejected", code: "smtp_recipient_rejected", retryable: false };
        return { status: "accepted", messageId: info.messageId };
      } catch (error) {
        return classifySmtpError(error);
      }
    },
  };
}

/** sendEmail(to, subject, htmlBody) for one-off use (e.g. the test script). App emails go through the queue instead. */
export async function sendEmail(settings: SmtpSettings, to: string, subject: string, htmlBody: string): Promise<SendResult> {
  const text = htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return createSmtpProvider(settings).send({ to, subject, html: htmlBody, text }, `test_${Date.now()}`);
}
