import { readEmailConfig } from "./config.ts";
import { outboxProvider } from "./providers/outbox.ts";
import { createResendProvider } from "./providers/resend.ts";
import { testProvider } from "./providers/test.ts";
import type { EmailProvider } from "./types.ts";

/*
 * The provider the worker uses, chosen once from EMAIL_TRANSPORT. A broken "resend" setup gives a provider that refuses
 * every message (failed job, clear startup warning) — it never quietly writes to the outbox instead.
 */

const holder = globalThis as typeof globalThis & { __explivioEmailProvider?: EmailProvider };

const misconfigured: EmailProvider = {
  name: "resend",
  async send() {
    return { status: "rejected", code: "not_configured", retryable: false };
  },
};

export function emailProvider(): EmailProvider {
  if (holder.__explivioEmailProvider) return holder.__explivioEmailProvider;
  const config = readEmailConfig();
  holder.__explivioEmailProvider = !config.ok ? misconfigured : config.transport === "resend" ? createResendProvider({ apiKey: config.apiKey, from: config.from }) : config.transport === "test" ? testProvider() : outboxProvider;
  return holder.__explivioEmailProvider;
}

/** Tests: use this provider (null = choose from the environment again). */
export function setEmailProvider(provider: EmailProvider | null): void {
  holder.__explivioEmailProvider = provider ?? undefined;
}

/**
 * What the screens may say about delivery. "outbox" only when messages really go to the local outbox; with
 * EMAIL_TRANSPORT=resend the screens never claim the outbox (even if the Resend setup is broken — that is reported at
 * startup and the job fails), they give the neutral "check your inbox" wording.
 */
export function deliveryMode(): "resend" | "outbox" {
  const config = readEmailConfig();
  return config.transport === "resend" ? "resend" : "outbox";
}
