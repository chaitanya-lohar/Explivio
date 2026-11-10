import { test } from "node:test";
import assert from "node:assert/strict";
import { readEmailConfig } from "../src/lib/email/config.ts";
import { classifySmtpError, createSmtpProvider } from "../src/lib/email/providers/smtp.ts";

/* SMTP provider (pilot, Brevo free plan): configuration checks and outcome mapping. No network: a fake transport. */

const base = { EMAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp-relay.brevo.com", SMTP_USER: "login@smtp-brevo.com", SMTP_PASS: "xsmtpsib-secret", EMAIL_FROM: "explivio <sender@example.com>" };

test("smtp config: complete setup is accepted, port defaults to 587, MAIL_FROM is an alias", () => {
  const config = readEmailConfig(base);
  assert.equal(config.ok, true);
  assert.equal(config.ok && config.transport === "smtp" && config.port, 587);
  const alias = readEmailConfig({ ...base, EMAIL_FROM: undefined, MAIL_FROM: "sender@example.com" });
  assert.equal(alias.ok, true);
});

test("smtp config: missing or malformed settings are reported by name, never by value", () => {
  const missing = readEmailConfig({ EMAIL_TRANSPORT: "smtp", SMTP_PASS: "xsmtpsib-secret" });
  assert.equal(missing.ok, false);
  assert.match(!missing.ok ? missing.message : "", /SMTP_HOST, SMTP_USER, EMAIL_FROM/);
  assert.ok(!JSON.stringify(missing).includes("xsmtpsib-secret"), "the password never appears");
  assert.equal(readEmailConfig({ ...base, SMTP_PORT: "25" }).ok, false, "plain port 25 is refused");
  assert.equal(readEmailConfig({ ...base, EMAIL_FROM: "bad\r\nBcc: x@y.z" }).ok, false, "header injection refused");
});

test("smtp provider: accepted, rejected and unknown outcomes (never resend when unsure)", async () => {
  const sent: unknown[] = [];
  const ok = createSmtpProvider({ host: "h", port: 587, user: "u", pass: "p", from: "explivio <s@example.com>" }, { sendMail: async (m) => (sent.push(m), { messageId: "<abc@explivio>", rejected: [] }) });
  const email = { to: "a@example.com", subject: "S", html: "<p>x</p>", text: "x" };
  assert.deepEqual(await ok.send(email, "ej_123"), { status: "accepted", messageId: "<abc@explivio>" });
  assert.equal((sent[0] as { from: string }).from, "explivio <s@example.com>");

  assert.deepEqual(classifySmtpError({ code: "EAUTH", responseCode: 535 }), { status: "rejected", code: "smtp_auth_failed", retryable: false });
  assert.deepEqual(classifySmtpError({ code: "EENVELOPE", responseCode: 550 }), { status: "rejected", code: "smtp_550", retryable: false });
  assert.deepEqual(classifySmtpError({ code: "EMESSAGE", responseCode: 421 }), { status: "rejected", code: "smtp_421", retryable: true });
  assert.deepEqual(classifySmtpError({ code: "ECONNREFUSED" }), { status: "rejected", code: "network_unreachable", retryable: true });
  assert.deepEqual(classifySmtpError({ code: "ETIMEDOUT", command: "CONN" }), { status: "rejected", code: "network_unreachable", retryable: true });
  assert.deepEqual(classifySmtpError({ code: "ETIMEDOUT", command: "DATA" }), { status: "unknown", code: "smtp_connection_lost" });
});
