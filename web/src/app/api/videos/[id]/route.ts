import { getVideo } from "@/services";

/** Current status of a video; polled by the generation progress screen. */
export async function GET(_request: Request, ctx: RouteContext<"/api/videos/[id]">) {
  const video = await getVideo((await ctx.params).id);
  if (!video) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(video, { headers: { "Cache-Control": "no-store" } });
}
