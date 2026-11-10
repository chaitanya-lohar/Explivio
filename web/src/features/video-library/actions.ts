"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { securityEvent } from "@/lib/security/log";
import { deleteVideo } from "@/services";

export type DeleteVideoResult = { ok: true } | { ok: false; error: string };

/** Deletes one of the signed-in user's videos (record and file). Other users' videos answer "not found". */
export async function deleteVideoAction(videoId: string): Promise<DeleteVideoResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  try {
    const result = await deleteVideo(String(videoId), user.id);
    if (result === "deleted") {
      securityEvent("video_deleted", { userId: user.id });
      return { ok: true };
    }
    if (result === "busy") return { ok: false, error: "This video is still being made. You can delete it once it has finished or failed." };
    securityEvent("access_denied", { userId: user.id, reason: "delete_not_found" });
    return { ok: false, error: "We couldn't find this video. It may already be deleted." };
  } catch (error) {
    console.warn(`[videos] delete failed (${error instanceof Error ? error.name : "Error"})`);
    return { ok: false, error: "We couldn't delete this video right now. Please try again." };
  }
}
