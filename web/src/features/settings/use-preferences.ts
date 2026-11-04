"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PREFERENCES, type VideoPreferences } from "@/lib/preferences";
import { loadPreferencesAction, savePreferencesAction } from "./actions";

/*
 * The signed-in user's defaults for new videos, stored in their account (MongoDB) since F10 (F7 kept them in the
 * browser). Loaded fresh on every mount — no cross-page cache — so after a sign-out and another sign-in in the same
 * tab, one account's settings can never show for another.
 */

/**
 * `ready` is false until the saved values arrive (product defaults are shown meanwhile). `save` and `reset` update
 * the screen at once, then resolve to whether the server stored the change (on failure the screen goes back).
 */
export function usePreferences() {
  const [preferences, setState] = useState<VideoPreferences>({ ...DEFAULT_PREFERENCES });
  const [ready, setReady] = useState(false);
  // The latest values, for saves that build on them; updated together with the state (never during render).
  const latest = useRef<VideoPreferences>({ ...DEFAULT_PREFERENCES });
  const setPreferences = useCallback((next: VideoPreferences) => {
    latest.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPreferencesAction()
      .then((loaded) => !cancelled && setPreferences(loaded))
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [setPreferences]);

  const store = useCallback(async (next: VideoPreferences): Promise<boolean> => {
    const previous = latest.current;
    setPreferences(next);
    try {
      const result = await savePreferencesAction(next);
      if (result.ok && result.preferences) {
        setPreferences(result.preferences);
        return true;
      }
    } catch {
      /* falls through to the rollback */
    }
    setPreferences(previous);
    return false;
  }, [setPreferences]);

  const save = useCallback((patch: Partial<VideoPreferences>) => store({ ...latest.current, ...patch }), [store]);
  const reset = useCallback(() => store({ ...DEFAULT_PREFERENCES }), [store]);
  return { preferences, ready, save, reset };
}
