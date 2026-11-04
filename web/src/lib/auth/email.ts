import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./crypto.ts";

/*
 * Email with an honest result (F10). MongoDB does not send email. Two transports:
 *  - "outbox" (default): nothing leaves the machine; the message is saved under data/outbox/ (gitignored), a local
 *    development mailbox. Links are never returned in an HTTP response or written to logs.
 *  - "resend": only when EMAIL_TRANSPORT=resend and RESEND_API_KEY + EMAIL_FROM are set. Resend's free plan needs a
 *    domain you own and have verified ($0 policy: off until one exists).
 * Callers report delivery exactly as returned, so an outbox message is never described as "sent".
 */

export type EmailMessage = { to: string; subject: string; text: string };
export type DeliveryMode = "outbox" | "resend";
export type Delivery = { mode: DeliveryMode; delivered: boolean };

export function emailMode(): DeliveryMode {
  return process.env.EMAIL_TRANSPORT === "resend" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? "resend" : "outbox";
}

export function outboxDir(): string {
  return process.env.EXPLIVIO_OUTBOX_DIR ? path.resolve(process.env.EXPLIVIO_OUTBOX_DIR) : path.join(dataDir(), "outbox");
}

/** Base URL for links in emails. Falls back to the local server. */
export function appUrl(): string {
  return (process.env.EXPLIVIO_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendEmail(message: EmailMessage): Promise<Delivery> {
  if (emailMode() === "resend") {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
        signal: AbortSignal.timeout(15_000),
      });
      return { mode: "resend", delivered: response.ok };
    } catch {
      return { mode: "resend", delivered: false };
    }
  }
  const dir = outboxDir();
  mkdirSync(dir, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.txt`;
  writeFileSync(path.join(dir, name), `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`, { mode: 0o600 });
  return { mode: "outbox", delivered: false };
}
