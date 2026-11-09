import type { Transport } from "./types.ts";

/*
 * Which email transport to use (F13), from EMAIL_TRANSPORT (server-only):
 *   unset / "outbox"  development outbox (data/outbox), nothing leaves the machine — the safe default;
 *   "resend"          Resend's API; needs RESEND_API_KEY and EMAIL_FROM, otherwise it is "invalid" (never a silent
 *                     fallback to the outbox while claiming delivery);
 *   "test"            in-memory provider for automated tests.
 * Messages name variables only, never values.
 */

export type EmailConfig =
  | { ok: true; transport: "outbox" | "test" }
  | { ok: true; transport: "resend"; apiKey: string; from: string }
  | { ok: false; transport: Transport | "unknown"; message: string };

// "Name <address>" or a bare address; no line breaks (header injection) and nothing unusual.
const FROM = /^(?:[^<>\r\n"]{1,80} <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;

export function readEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig {
  const transport = (env.EMAIL_TRANSPORT ?? "outbox").trim().toLowerCase() || "outbox";
  // The outbox writes files, and nothing would be delivered: never on Vercel (F14).
  if (transport === "outbox" && env.VERCEL) return { ok: false, transport: "outbox", message: "EMAIL_TRANSPORT must be resend on Vercel (the outbox writes local files). No email will be sent." };
  if (transport === "outbox" || transport === "test") return { ok: true, transport };
  if (transport !== "resend") return { ok: false, transport: "unknown", message: 'EMAIL_TRANSPORT must be "outbox", "resend" or "test".' };
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.EMAIL_FROM?.trim() ?? "";
  const missing = [!apiKey && "RESEND_API_KEY", !from && "EMAIL_FROM"].filter(Boolean);
  if (missing.length) return { ok: false, transport: "resend", message: `EMAIL_TRANSPORT=resend but ${missing.join(" and ")} missing in web/.env.local. No email will be sent.` };
  if (!/^re_[A-Za-z0-9_]{8,}$/.test(apiKey)) return { ok: false, transport: "resend", message: "RESEND_API_KEY doesn't look like a Resend API key (re_…). No email will be sent." };
  if (!FROM.test(from)) return { ok: false, transport: "resend", message: 'EMAIL_FROM must be an address or "Name <address>" on one line. No email will be sent.' };
  return { ok: true, transport: "resend", apiKey, from };
}

/**
 * Base URL for links in emails: the trusted, configured address — never the request's Host header. On Vercel without
 * EXPLIVIO_APP_URL, Vercel's own system variables are used (production domain, or the preview branch's stable URL).
 */
export function appUrl(env: Record<string, string | undefined> = process.env): string {
  const vercelHost = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  return (env.EXPLIVIO_APP_URL ?? (vercelHost ? `https://${vercelHost}` : "http://localhost:3000")).replace(/\/+$/, "");
}
