"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { appConfig } from "@/config/app";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

const defaultVoice = appConfig.video.voices.find((v) => v.value === DEFAULT_PREFERENCES.voice)?.label ?? DEFAULT_PREFERENCES.voice;

/** Confirms before restoring the product defaults. Existing videos are never changed. */
export function ResetPreferencesDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onClose={onCancel} title="Reset to defaults?">
      <p className="text-body text-muted">New videos will start with the original settings again:</p>
      <ul className="mt-3 flex flex-col gap-1 text-body text-foreground">
        <li>{DEFAULT_PREFERENCES.durationSeconds} seconds</li>
        <li>{defaultVoice}</li>
        <li>Captions {DEFAULT_PREFERENCES.captions ? "on" : "off"}</li>
        <li>Background music {DEFAULT_PREFERENCES.music ? "on" : "off"}</li>
      </ul>
      <p className="mt-3 text-meta text-muted">Videos you have already created keep the settings they were made with.</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>Reset to defaults</Button>
      </div>
    </Dialog>
  );
}
