import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { parseRange } from "@/lib/http-range";
import { getCurrentUser } from "@/lib/auth/session";
import { ObjectNotFoundError, objectStore } from "@/lib/storage";
import { getVideo, getVideoSource } from "@/services";

/** How long a signed download link stays valid (it is used immediately by the browser). */
const DOWNLOAD_LINK_SECONDS = 300;

/**
 * Streams a rendered MP4. Supports HTTP Range requests so the player can seek; `?download=1` asks the browser to save
 * the file instead of playing it. Only the owner gets the file (F10): another user's video answers like an unknown id.
 *
 * F11: a video stored in Cloudflare R2 is streamed through this route (Range forwarded to R2, so only the requested
 * bytes are read and nothing is buffered whole); its download redirects to a short-lived signed R2 link made after the
 * owner check. The bucket stays private and no credentials or permanent object URLs reach the browser.
 * Videos stored locally (runs/) are served from disk exactly as before.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/videos/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to watch this video", { status: 401 });
  const { id } = await ctx.params;
  const source = await getVideoSource(id, user.id);
  if (!source) return new Response("Video file not available", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const fileName = download ? await downloadName(id, user.id) : null;

  if (source.kind === "r2") {
    const objects = objectStore();
    if (!objects) return new Response("Cloud storage isn't configured on this server", { status: 503 });
    try {
      if (fileName) {
        const url = await objects.presignGet(source.key, { expiresInSeconds: DOWNLOAD_LINK_SECONDS, downloadName: fileName });
        return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
      }
      return await stream(request, source.size, (range) => objects.get(source.key, range).then((body) => body.stream));
    } catch (error) {
      if (error instanceof ObjectNotFoundError) return new Response("Video file not available", { status: 404 });
      return new Response("Cloud storage is unavailable right now. Please try again shortly.", { status: 503 });
    }
  }

  const { size } = await stat(source.path);
  const response = await stream(request, size, async (range) => Readable.toWeb(createReadStream(source.path, range)) as ReadableStream);
  if (fileName) response.headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
  return response;
}

async function downloadName(id: string, userId: string): Promise<string> {
  const video = await getVideo(id, userId);
  const name = (video?.title ?? id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "video";
  return `${name}.mp4`;
}

/** Answers a full (200) or partial (206) request for a file of known size; 416 for a range outside it. */
async function stream(request: Request, size: number, open: (range?: { start: number; end: number }) => Promise<ReadableStream>): Promise<Response> {
  const headers = new Headers({ "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=0" });
  const range = parseRange(request.headers.get("range"), size);
  if (range.kind === "unsatisfiable") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  if (range.kind === "partial") {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(await open({ start: range.start, end: range.end }), { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(await open(), { status: 200, headers });
}
