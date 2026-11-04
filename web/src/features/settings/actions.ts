"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_PREFERENCES, type VideoPreferences } from "@/lib/preferences";
import { getPreferences, savePreferences } from "@/services/auth/service";

/*
 * Settings are stored per account in MongoDB (F10). Each action works only on the signed-in user's own record: the
 * user id comes from the session, never from the request.
 */

export async function loadPreferencesAction(): Promise<VideoPreferences> {
  const user = await getCurrentUser();
  if (!user) return { ...DEFAULT_PREFERENCES };
  try {
    return await getPreferences(user.id);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferencesAction(preferences: VideoPreferences): Promise<{ ok: boolean; preferences?: VideoPreferences }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  try {
    return { ok: true, preferences: await savePreferences(user.id, preferences) };
  } catch {
    return { ok: false };
  }
}
