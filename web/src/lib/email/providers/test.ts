import type { EmailProvider, OutgoingEmail, SendResult } from "../types.ts";

/** In-memory provider for automated tests: records every message and returns scripted outcomes (default: accepted). */
export type TestProvider = EmailProvider & { sent: { email: OutgoingEmail; idempotencyKey: string }[]; script: SendResult[] };

export function testProvider(): TestProvider {
  const provider: TestProvider = {
    name: "test",
    sent: [],
    script: [],
    async send(email, idempotencyKey) {
      provider.sent.push({ email, idempotencyKey });
      return provider.script.shift() ?? { status: "accepted", messageId: `test-${provider.sent.length}` };
    },
  };
  return provider;
}
