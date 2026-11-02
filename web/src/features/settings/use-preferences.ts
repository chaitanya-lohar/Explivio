"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_PREFERENCES, parsePreferences, serializePreferences, type VideoPreferences } from "@/lib/preferences";

/*
 * Preference storage for this single-user app: the browser's localStorage, one small JSON record, no secrets.
 * Everything goes through this hook, so it can later be swapped for a backend without touching the forms.
 */

const STORAGE_KEY = "explivio.preferences";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: VideoPreferences } | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked (private mode, policy): behave as if nothing is saved
  }
}

/** Same object for the same stored text, as useSyncExternalStore requires. */
function getSnapshot(): VideoPreferences {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, value: parsePreferences(raw) };
  return cache.value;
}

const getServerSnapshot = () => DEFAULT_PREFERENCES as VideoPreferences;

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the settings.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(preferences: VideoPreferences): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializePreferences(preferences));
    return true;
  } catch {
    return false;
  } finally {
    listeners.forEach((listener) => listener());
  }
}

const subscribeNoop = () => () => {};

/**
 * Saved defaults for new videos. `ready` is false during server rendering and hydration, when the saved values
 * aren't known yet (the product defaults are shown meanwhile). `save` and `reset` return false if storage failed.
 */
export function usePreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const save = useCallback((patch: Partial<VideoPreferences>) => write({ ...getSnapshot(), ...patch }), []);
  const reset = useCallback(() => write({ ...DEFAULT_PREFERENCES }), []);
  return { preferences, ready, save, reset };
}
