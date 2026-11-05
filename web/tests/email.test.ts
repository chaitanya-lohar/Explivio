import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { appUrl, readEmailConfig } from "../src/lib/email/config.ts";
import { escapeHtml, renderEmail } from "../src/lib/email/templates.ts";
import { outboxProvider } from "../src/lib/email/providers/outbox.ts";
import { createResendProvider } from "../src/lib/email/providers/resend.ts";
import { deliveryMode } from "../src/lib/email/provider.ts";
import type { EmailKind } from "../src/lib/email/types.ts";

/*
 * F13 email tests, offline: configuration, templates (escaping, header injection, links), the outbox provider, and the
 * real Resend provider code against a local fake Resend endpoint (every outcome: accepted, rate limit + retry, quota,
 * validation, server errors, malformed, timeout, unreachable). No real email is sent and no quota is used.
 */

const KEY = "re_TESTKEY_1234567890abcdef";
const email = { to: "person@example.com", subject: "Subject", html: "<p>hi</p>", text: "hi" };

test("config: unset → outbox; test; resend needs a well-formed key and a one-line sender; messages never show values", () => {
  assert.deepEqual(readEmailConfig({}), { ok: true, transport: "outbox" });
  assert.deepEqual(readEmailConfig({ EMAIL_TRANSPORT: "TEST" }), { ok: true, transport: "test" });
  const missing = readEmailConfig({ EMAIL_TRANSPORT: "resend", RESEND_API_KEY: KEY });
  assert.ok(!missing.ok && /EMAIL_FROM missing/.test(missing.message));
  assert.ok(!readEmailConfig({ EMAIL_TRANSPORT: "resend", RESEND_API_KEY: "sk_live_wrong", EMAIL_FROM: "a@b.co" }).ok);
  const injected = readEmailConfig({ EMAIL_TRANSPORT: "resend", RESEND_API_KEY: KEY, EMAIL_FROM: "Explivio <a@b.co>\r\nBcc: victim@example.com" });
  assert.ok(!injected.ok, "a sender with a line break (header injection) is refused");
  assert.ok(!readEmailConfig({ EMAIL_TRANSPORT: "smtp" }).ok);
  const good = readEmailConfig({ EMAIL_TRANSPORT: "resend", RESEND_API_KEY: KEY, EMAIL_FROM: "Explivio <onboarding@resend.dev>" });
  assert.ok(good.ok && good.transport === "resend");
  for (const c of [missing, injected]) assert.ok(!JSON.stringify(c).includes(KEY.slice(3)), "the key value is never echoed");
});

test("links use the configured app URL only; screens say 'outbox' only when the outbox is really used", () => {
  assert.equal(appUrl({ EXPLIVIO_APP_URL: "https://app.example.test///" }), "https://app.example.test");
  assert.equal(appUrl({}), "http://localhost:3000");
  const saved = process.env.EMAIL_TRANSPORT;
  try {
    process.env.EMAIL_TRANSPORT = "resend";
    assert.equal(deliveryMode(), "resend", "even a broken resend setup never claims the outbox");
    delete process.env.EMAIL_TRANSPORT;
    assert.equal(deliveryMode(), "outbox");
  } finally {
    if (saved === undefined) delete process.env.EMAIL_TRANSPORT;
    else process.env.EMAIL_TRANSPORT = saved;
  }
});

test("templates: four kinds, HTML + text, escaped names, one-line names, no images or tracking, valid links only", () => {
  const evil = `<script>alert(1)</script>\r\nBcc: x@y.z "quoted" & 'single'`;
  const link = "https://app.example.test/verify-email?token=abc_DEF-123";
  for (const kind of ["verify_email", "reset_password", "password_changed", "account_exists"] as EmailKind[]) {
    const r = renderEmail(kind, { name: evil, link, appUrl: "https://app.example.test" });
    assert.ok(r.subject && !/[\r\n]/.test(r.subject), `${kind}: fixed one-line subject`);
    assert.ok(!r.html.includes("<script>") && r.html.includes("&lt;script&gt;"), `${kind}: name escaped in HTML`);
    assert.ok(!/<img|<script|track|pixel/i.test(r.html.replace(/&lt;script&gt;/g, "")), `${kind}: no images, scripts or tracking`);
    assert.ok(!/\r/.test(r.text) && r.text.includes("Bcc: x@y.z"), `${kind}: name on one line in text`);
    assert.ok(r.html.includes('name="viewport"') && r.html.includes("max-width:560px"), `${kind}: responsive`);
  }
  const verify = renderEmail("verify_email", { name: "Ana", link, appUrl: "https://app.example.test" });
  assert.ok(verify.text.includes(link) && verify.html.includes(escapeHtml(link)) && /24 hours/.test(verify.text));
  assert.ok(/30 minutes/.test(renderEmail("reset_password", { name: "Ana", link, appUrl: "https://x.test" }).text));
  assert.throws(() => renderEmail("verify_email", { name: "Ana", link: 'javascript:alert(1)"', appUrl: "https://x.test" }), /invalid link/);
});

test("outbox provider: saves the plain-text message under EXPLIVIO_OUTBOX_DIR and reports accepted", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "explivio-outbox-"));
  process.env.EXPLIVIO_OUTBOX_DIR = dir;
  try {
    assert.deepEqual(await outboxProvider.send(email, "k"), { status: "accepted" });
    const [file] = readdirSync(dir);
    assert.ok(readFileSync(path.join(dir, file), "utf8").startsWith("To: person@example.com\nSubject: Subject\n\nhi"));
  } finally {
    delete process.env.EXPLIVIO_OUTBOX_DIR;
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- Resend provider against a local fake endpoint ----

type Reply = { status: number; body?: unknown; headers?: Record<string, string>; hang?: boolean };
const replies: Reply[] = [];
const seen: { headers: IncomingMessage["headers"]; body: string }[] = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seen.push({ headers: req.headers, body });
    const r = replies.shift() ?? { status: 200, body: { id: "msg_default" } };
    if (r.hang) return; // never answers: the provider must time out
    res.writeHead(r.status, { "Content-Type": "application/json", ...(r.headers ?? {}) });
    res.end(r.body === undefined ? "" : typeof r.body === "string" ? r.body : JSON.stringify(r.body));
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
after(() => server.closeAllConnections?.() ?? server.close());
after(() => server.close());
const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/emails`;
const sleeps: number[] = [];
const provider = (timeoutMs = 2000) => createResendProvider({ apiKey: KEY, from: "Explivio <onboarding@resend.dev>", endpoint, timeoutMs, sleep: async (ms) => void sleeps.push(ms) });
const reset = (...r: Reply[]) => { replies.length = 0; replies.push(...r); seen.length = 0; sleeps.length = 0; };

test("resend: accepted → id; request carries Bearer key, Idempotency-Key, User-Agent, JSON with from/to/subject/html/text", async () => {
  reset({ status: 200, body: { id: "msg_1" } });
  assert.deepEqual(await provider().send(email, "job1:1"), { status: "accepted", messageId: "msg_1" });
  const [req] = seen;
  assert.equal(req.headers.authorization, `Bearer ${KEY}`);
  assert.equal(req.headers["idempotency-key"], "job1:1");
  assert.equal(req.headers["user-agent"], "explivio/1.0");
  assert.match(String(req.headers["content-type"]), /application\/json/);
  assert.deepEqual(JSON.parse(req.body), { from: "Explivio <onboarding@resend.dev>", to: ["person@example.com"], subject: "Subject", html: "<p>hi</p>", text: "hi" });
});

test("resend: one rate-limit retry with the SAME body and key, honouring Retry-After; a second 429 is a retryable refusal", async () => {
  reset({ status: 429, body: { name: "rate_limit_exceeded" }, headers: { "retry-after": "2" } }, { status: 200, body: { id: "msg_2" } });
  assert.deepEqual(await provider().send(email, "job2:1"), { status: "accepted", messageId: "msg_2" });
  assert.equal(seen.length, 2);
  assert.equal(seen[0].body, seen[1].body);
  assert.equal(seen[0].headers["idempotency-key"], seen[1].headers["idempotency-key"]);
  assert.deepEqual(sleeps, [2000]);
  reset({ status: 429, body: { name: "rate_limit_exceeded" } }, { status: 429, body: { name: "rate_limit_exceeded" } });
  const r = await provider().send(email, "job3:1");
  assert.ok(r.status === "rejected" && r.retryable && r.code === "rate_limit_exceeded");
});

test("resend: quota, validation (testing-domain recipient), auth errors are refused once and never retried", async () => {
  reset({ status: 429, body: { name: "daily_quota_exceeded" } });
  assert.deepEqual(await provider().send(email, "q:1"), { status: "rejected", code: "daily_quota_exceeded", retryable: false, quota: "daily" });
  reset({ status: 429, body: { name: "monthly_quota_exceeded" } });
  assert.deepEqual(await provider().send(email, "q:2"), { status: "rejected", code: "monthly_quota_exceeded", retryable: false, quota: "monthly" });
  reset({ status: 403, body: { name: "validation_error", message: "You can only send testing emails to your own email address" } });
  assert.deepEqual(await provider().send(email, "v:1"), { status: "rejected", code: "validation_error", retryable: false });
  reset({ status: 401, body: { name: "restricted_api_key" } });
  assert.deepEqual(await provider().send(email, "a:1"), { status: "rejected", code: "restricted_api_key", retryable: false });
  assert.equal(seen.length, 1, "no retry");
});

test("resend: ambiguous outcomes are 'unknown' — repeated 5xx, malformed 2xx, timeout; an unreachable host is a retryable refusal", async () => {
  reset({ status: 500, body: { name: "application_error" } }, { status: 500, body: { name: "application_error" } });
  assert.deepEqual(await provider().send(email, "s:1"), { status: "unknown", code: "application_error" });
  assert.equal(seen.length, 2, "one idempotent retry");
  reset({ status: 200, body: "not json" });
  assert.deepEqual(await provider().send(email, "m:1"), { status: "unknown", code: "malformed_response" });
  reset({ status: 200, body: { ok: true } });
  assert.deepEqual(await provider().send(email, "m:2"), { status: "unknown", code: "malformed_response" });
  reset({ status: 200, hang: true });
  assert.deepEqual(await provider(300).send(email, "t:1"), { status: "unknown", code: "timeout" });
  // A port that was just freed: nothing listens there, so the connection is refused (port 1 is a fetch "bad port").
  const closed = await new Promise<number>((resolve) => { const s = createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as AddressInfo).port; s.close(() => resolve(p)); }); });
  const offline = createResendProvider({ apiKey: KEY, from: "a@b.co", endpoint: `http://127.0.0.1:${closed}/emails`, timeoutMs: 2000 });
  const r = await offline.send(email, "n:1");
  assert.ok(r.status === "rejected" && r.retryable && r.code === "network_unreachable");
  assert.ok(!JSON.stringify(r).includes(KEY), "no key in results");
});
