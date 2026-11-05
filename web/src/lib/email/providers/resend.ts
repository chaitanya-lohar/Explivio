import type { EmailProvider, SendResult } from "../types.ts";

/*
 * Resend provider (F13): direct HTTPS call to the official API (POST /emails), no SDK. Server-only; the key is only
 * ever put in the Authorization header and never appears in results, errors or logs.
 *
 * Outcomes (checked against resend.com/docs on 2026-11-05):
 *  - 2xx with an id → accepted (the provider took it; NOT proof of inbox delivery);
 *  - 429 rate_limit_exceeded or 5xx → one quick retry with the SAME body and Idempotency-Key (Resend drops duplicates
 *    for 24 h); a second 429 is a retryable rejection, a second 5xx is unknown (it may have been processed);
 *  - 429 daily/monthly_quota_exceeded → rejected with `quota` (free plan: refused, never billed);
 *  - other 4xx (validation, testing-domain recipient restriction, keys) → permanent rejection, never retried;
 *  - timeout or a broken connection after sending → unknown; a connection that never opened → retryable rejection.
 */

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;
const MAX_RETRY_WAIT_MS = 5_000;
const NOT_CONNECTED = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH/;

type Options = { apiKey: string; from: string; endpoint?: string; timeoutMs?: number; sleep?: (ms: number) => Promise<void> };

export function createResendProvider(options: Options): EmailProvider {
  const endpoint = options.endpoint ?? ENDPOINT;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function attempt(body: string, idempotencyKey: string): Promise<SendResult & { transient?: boolean }> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "explivio/1.0",
          "Idempotency-Key": idempotencyKey,
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const err = error as { name?: string; cause?: { code?: string; message?: string } };
      if (err.name === "TimeoutError" || err.name === "AbortError") return { status: "unknown", code: "timeout" };
      const cause = `${err.cause?.code ?? ""} ${err.cause?.message ?? ""}`;
      return NOT_CONNECTED.test(cause) ? { status: "rejected", code: "network_unreachable", retryable: true } : { status: "unknown", code: "network_error" };
    }
    let payload: { id?: unknown; name?: unknown } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      /* not JSON */
    }
    if (response.ok) return typeof payload.id === "string" && payload.id ? { status: "accepted", messageId: payload.id } : { status: "unknown", code: "malformed_response" };
    const name = typeof payload.name === "string" ? payload.name.replace(/[^a-z_]/g, "").slice(0, 40) : "";
    const retryAfterMs = Math.max(0, Number(response.headers.get("retry-after")) * 1000 || 0);
    if (response.status === 429) {
      if (name === "daily_quota_exceeded") return { status: "rejected", code: name, retryable: false, quota: "daily" };
      if (name === "monthly_quota_exceeded") return { status: "rejected", code: name, retryable: false, quota: "monthly" };
      return { status: "rejected", code: name || "rate_limit_exceeded", retryable: true, retryAfterMs, transient: true };
    }
    if (response.status >= 500) return { status: "unknown", code: name || `http_${response.status}`, transient: true };
    return { status: "rejected", code: name || `http_${response.status}`, retryable: false };
  }

  return {
    name: "resend",
    async send(email, idempotencyKey) {
      const body = JSON.stringify({ from: options.from, to: [email.to], subject: email.subject, html: email.html, text: email.text });
      const first = await attempt(body, idempotencyKey);
      if (!first.transient) return strip(first);
      // One quick retry, identical request: safe because of the Idempotency-Key.
      await sleep(Math.min(first.status === "rejected" && first.retryAfterMs ? first.retryAfterMs : 1000, MAX_RETRY_WAIT_MS));
      return strip(await attempt(body, idempotencyKey));
    },
  };
}

function strip(result: SendResult & { transient?: boolean }): SendResult {
  const { transient: _transient, ...rest } = result;
  void _transient;
  return rest as SendResult;
}
