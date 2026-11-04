import { getCurrentUser } from "@/lib/auth/session";
import { getVideo } from "@/services";

/** Current status of the signed-in user's video; polled by the generation progress screen. */
export async function GET(_request: Request, ctx: RouteContext<"/api/videos/[id]">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  // Another user's video answers exactly like an unknown id.
  const video = await getVideo((await ctx.params).id, user.id);
  if (!video) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(video, { headers: { "Cache-Control": "no-store" } });
}
