import { readFile } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth/session";
import { ObjectNotFoundError, objectStore } from "@/lib/storage";
import { getThumbnailSource } from "@/services";

/**
 * A video's thumbnail (JPEG, about 20–40 KB), for My Videos and the player's poster. Owner only: another user's video
 * answers like an unknown id. Cached privately in the browser (it never changes for a given video).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/videos/[id]/thumbnail">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to see this image", { status: 401 });
  const { id } = await ctx.params;
  const source = await getThumbnailSource(id, user.id);
  if (!source) return new Response("No thumbnail", { status: 404 });
  const headers = { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" };
  if (source.kind === "local") return new Response(new Uint8Array(await readFile(/* turbopackIgnore: true */ source.path)), { headers });
  const objects = objectStore();
  if (!objects) return new Response("Cloud storage isn't configured on this server", { status: 503 });
  try {
    const body = await objects.get(source.key);
    return new Response(body.stream, { headers: { ...headers, "Content-Length": String(body.contentLength) } });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return new Response("No thumbnail", { status: 404 });
    return new Response("Cloud storage is unavailable right now.", { status: 503 });
  }
}
