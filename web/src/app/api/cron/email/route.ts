import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { runEmailWorkerOnce } from "@/lib/email/worker";

/*
 * Daily Vercel cron (F14, see vercel.json): sends any email still due (retries, or one whose after-response send was
 * cut short). Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; anything else gets 401. Answers counts only.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET ?? "";
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (secret.length < 16 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const sent = await runEmailWorkerOnce({ max: 200 });
  return Response.json({ processed: sent }, { headers: { "Cache-Control": "no-store" } });
}
