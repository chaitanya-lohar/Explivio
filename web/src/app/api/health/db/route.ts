import { connection } from "next/server";
import { checkDatabase } from "@/lib/db/health";

/** Database connectivity, for operators. Answers only a status word and a latency (no host, user or error text). */
export async function GET() {
  await connection();
  const health = await checkDatabase();
  return Response.json(health, { status: health.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
