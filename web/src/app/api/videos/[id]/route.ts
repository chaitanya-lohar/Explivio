import { getCurrentUser } from "@/lib/auth/session";
import { securityEvent } from "@/lib/security/log";
import { getVideo } from "@/services";

/** Current status of the signed-in user's video; polled by the generation progress screen. */
export async function GET(_request: Request, ctx: RouteContext<"/api/videos/[id]">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  // Another user's video answers exactly like an unknown id.
  const id = (await ctx.params).id;
  const video = await getVideo(id, user.id);
  if (!video) {
    securityEvent("access_denied", { userId: user.id, videoId: id, reason: "video_status" });
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(video, { headers: { "Cache-Control": "no-store" } });
}
