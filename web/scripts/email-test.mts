// Sends ONE test email through the configured transport, to check the setup (pilot, 2026-11-10). Usage:
//   npm run email:test                    → to the sender address itself (EMAIL_FROM)
//   npm run email:test -- you@example.com → to that address
// Reads web/.env.local. Prints the outcome and a masked recipient only; never the password or the server's reply text.
// One message per run (counts toward the provider's daily limit like any other email).
import { readEmailConfig } from "../src/lib/email/config.ts";
import { sendEmail } from "../src/lib/email/providers/smtp.ts";

const config = readEmailConfig();
if (!config.ok) {
  console.error(`Email setup problem: ${config.message}`);
  process.exit(1);
}
if (config.transport !== "smtp") {
  console.error(`EMAIL_TRANSPORT is "${config.transport}"; this test is for "smtp". (Resend is tested by signing up or with npm run email:worker.)`);
  process.exit(1);
}
const address = (value: string) => value.match(/<([^>]+)>/)?.[1] ?? value;
const to = process.argv[2] ?? address(config.from);
if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) {
  console.error("Give a valid recipient address.");
  process.exit(1);
}
const masked = to.replace(/^(.).*(@.*)$/, "$1***$2");
console.log(`Sending a test email via ${config.host}:${config.port} to ${masked} …`);
const result = await sendEmail(config, to, "Explivio test email", `<p>This is a test email from <strong>Explivio</strong>, sent at ${new Date().toISOString()}.</p><p>If you can read this, email sending works.</p>`);
if (result.status === "accepted") console.log("Accepted by the SMTP server. Check the inbox (and the spam folder) in a minute.");
else console.error(`Not sent: ${result.status} (${result.code}).${result.status === "rejected" && result.code === "smtp_auth_failed" ? " Check SMTP_USER and SMTP_PASS." : ""}`);
process.exit(result.status === "accepted" ? 0 : 1);
