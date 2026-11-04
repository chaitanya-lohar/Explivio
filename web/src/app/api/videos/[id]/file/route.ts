import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth/session";
import { getVideo, getVideoFilePath } from "@/services";

/**
 * Streams a rendered MP4. Supports HTTP Range requests so the player can seek;
 * `?download=1` asks the browser to save the file instead of playing it. Only the owner gets the file (F10).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/videos/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to watch this video", { status: 401 });
  const { id } = await ctx.params;
  // Another user's video answers exactly like an unknown id.
  const filePath = await getVideoFilePath(id, user.id);
  if (!filePath) return new Response("Video file not available", { status: 404 });

  const { size } = await stat(filePath);
  const headers = new Headers({ "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=0" });
  if (new URL(request.url).searchParams.has("download")) {
    const video = await getVideo(id, user.id);
    const name = (video?.title ?? id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "video";
    headers.set("Content-Disposition", `attachment; filename="${name}.mp4"`);
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    // "bytes=start-end", "bytes=start-" or the suffix form "bytes=-length".
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, { status: 200, headers });
}
