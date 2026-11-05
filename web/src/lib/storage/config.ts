/*
 * Cloudflare R2 settings (server-only, F11). Read from the environment (web/.env.local in development); never exposed
 * through NEXT_PUBLIC_*. Nothing here ever returns or prints a secret value: messages name the variable only.
 *
 * R2 is optional: with none of the R2_* variables set, storage is "not configured" and videos stay on the local disk
 * exactly as before F11. A partial or malformed setup is "invalid" (reported at startup, uploads disabled).
 */

export type R2Config =
  | { ok: true; accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; endpoint: string }
  | { ok: false; problem: "not_configured" | "invalid"; message: string };

const ACCOUNT_ID = /^[0-9a-f]{32}$/i;
// R2 bucket names: 3–63 characters, lowercase letters, numbers and hyphens, starting and ending with a letter or number.
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const NO_SPACE = /^\S+$/;
// The official S3 API endpoint, optionally with a jurisdiction (eu, fedramp, us).
const ENDPOINT = /^https:\/\/[0-9a-f]{32}(?:\.(?:eu|fedramp|us))?\.r2\.cloudflarestorage\.com\/?$/i;

export function readR2Config(env: Record<string, string | undefined> = process.env): R2Config {
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = env.R2_BUCKET_NAME?.trim() ?? "";
  const endpointSetting = env.R2_ENDPOINT?.trim() ?? "";

  if (!accountId && !accessKeyId && !secretAccessKey && !endpointSetting) {
    return { ok: false, problem: "not_configured", message: "Cloudflare R2 is not configured: new videos are kept on this computer only." };
  }
  const missing = [
    ["R2_ACCOUNT_ID", accountId || endpointSetting],
    ["R2_ACCESS_KEY_ID", accessKeyId],
    ["R2_SECRET_ACCESS_KEY", secretAccessKey],
    ["R2_BUCKET_NAME", bucket],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) return { ok: false, problem: "invalid", message: `Cloudflare R2 is partly configured: ${missing.join(", ")} missing in web/.env.local.` };
  if (accountId && !ACCOUNT_ID.test(accountId)) return { ok: false, problem: "invalid", message: "R2_ACCOUNT_ID must be the 32-character account id shown on the R2 overview page." };
  if (!NO_SPACE.test(accessKeyId) || !NO_SPACE.test(secretAccessKey)) return { ok: false, problem: "invalid", message: "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must not contain spaces." };
  if (!BUCKET.test(bucket)) return { ok: false, problem: "invalid", message: "R2_BUCKET_NAME must be 3–63 lowercase letters, numbers or hyphens." };
  if (endpointSetting && !ENDPOINT.test(endpointSetting)) {
    return { ok: false, problem: "invalid", message: "R2_ENDPOINT must look like https://<account-id>.r2.cloudflarestorage.com (or leave it unset)." };
  }
  const endpoint = (endpointSetting || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/$/, "");
  if (accountId && !endpoint.toLowerCase().includes(accountId.toLowerCase())) {
    return { ok: false, problem: "invalid", message: "R2_ENDPOINT doesn't match R2_ACCOUNT_ID." };
  }
  return { ok: true, accountId: accountId || endpoint.slice(8, 40), accessKeyId, secretAccessKey, bucket, endpoint };
}

/** Removes anything secret-looking from text that may come from the SDK (signatures, long keys, signed URLs). */
export function redactStorage(text: string): string {
  return text
    .replace(/https:\/\/\S*r2\.cloudflarestorage\.com\S*/gi, "[r2-url]")
    .replace(/(X-Amz-(?:Signature|Credential|Security-Token)=)[^&\s]+/gi, "$1***")
    .replace(/\b[A-Za-z0-9/+_-]{32,}\b/g, "[redacted]");
}
