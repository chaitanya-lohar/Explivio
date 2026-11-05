import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../../auth/crypto.ts";
import type { EmailProvider } from "../types.ts";

/*
 * Development outbox (F10, kept in F13): the plain-text message is saved under data/outbox/ (gitignored), owner-only.
 * Nothing leaves the machine. Same file format as before, so local testing works unchanged.
 */

export function outboxDir(): string {
  return process.env.EXPLIVIO_OUTBOX_DIR ? path.resolve(process.env.EXPLIVIO_OUTBOX_DIR) : path.join(dataDir(), "outbox");
}

export const outboxProvider: EmailProvider = {
  name: "outbox",
  async send(email) {
    try {
      const dir = outboxDir();
      mkdirSync(dir, { recursive: true });
      const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.txt`;
      writeFileSync(path.join(dir, name), `To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`, { mode: 0o600 });
      return { status: "accepted" };
    } catch {
      return { status: "rejected", code: "outbox_write_failed", retryable: true };
    }
  },
};
