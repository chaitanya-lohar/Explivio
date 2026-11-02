"use client";

import { useEffect, useState } from "react";
import { Captions, CircleAlert, CircleCheck, Languages, Music, RotateCcw, Smartphone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { appConfig, formatLabel } from "@/config/app";
import { FixedOption } from "@/features/video-creation/fixed-option";
import { IconLabel } from "@/features/video-creation/icon-label";
import { isDefaultPreferences, type VideoPreferences } from "@/lib/preferences";
import { ResetPreferencesDialog } from "./reset-preferences-dialog";
import { SettingsSection } from "./settings-section";
import { usePreferences } from "./use-preferences";

const { video } = appConfig;

type Feedback = { tone: "success" | "error"; text: string } | null;

/** How long a save confirmation stays on screen. Errors stay until the next change. */
const FEEDBACK_MS = 4000;

/** Defaults for new videos. Each change is saved immediately in this browser and confirmed below the form. */
export function SettingsForm() {
  const { preferences, ready, save, reset } = usePreferences();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (feedback?.tone !== "success") return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  function update(patch: Partial<VideoPreferences>) {
    setFeedback(save(patch) ? { tone: "success", text: "Saved. New videos will start with these settings." } : { tone: "error", text: "Couldn't save: this browser is blocking site storage, so this choice won't be kept." });
  }

  function confirmDefaults() {
    setConfirmReset(false);
    setFeedback(reset() ? { tone: "success", text: "Defaults restored. New videos will start with the original settings." } : { tone: "error", text: "Couldn't reset: this browser is blocking site storage." });
  }

  if (!ready) {
    return (
      <div role="status" aria-label="Loading your settings" className="flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection id="general-heading" title="General" description="These are the same for every Explivio video.">
        <div className="grid gap-3 md:grid-cols-2">
          <FixedOption icon={<Languages />} title="English" description="Narration, captions and on-screen text" />
          <FixedOption icon={<Smartphone />} title={formatLabel} description="Made for vertical mobile feeds" />
        </div>
      </SettingsSection>

      <SettingsSection id="narration-heading" title="Narration" description="The voice that reads your script.">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-title text-foreground">Default voice</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {video.voices.map((option) => (
              <RadioCard key={option.value} name="default-voice" value={option.value} checked={preferences.voice === option.value} onChange={() => update({ voice: option.value })} icon={<UserRound />} title={option.label} description={option.description} />
            ))}
          </div>
        </fieldset>
      </SettingsSection>

      <SettingsSection id="video-heading" title="Video" description="Starting choices on the video settings step. You can still change them for any single video.">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-title text-foreground">Default duration</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {video.durations.map((option) => (
              <RadioCard key={option.value} layout="stacked" name="default-duration" value={option.value} checked={preferences.durationSeconds === option.value} onChange={() => update({ durationSeconds: option.value })} title={`${option.value}s`} description={option.label} />
            ))}
          </div>
          <p className="text-meta text-muted">Final length may vary slightly so the narration sounds natural.</p>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-border bg-background px-4 py-2">
            <Switch id="default-captions" label={<IconLabel icon={<Captions />}>Captions</IconLabel>} description="Burned into the video" checked={preferences.captions} onChange={(event) => update({ captions: event.target.checked })} />
          </div>
          <div className="rounded-card border border-border bg-background px-4 py-2">
            <Switch id="default-music" label={<IconLabel icon={<Music />}>Background music</IconLabel>} description="Soft instrumental music kept quiet under the narration" checked={preferences.music} onChange={(event) => update({ music: event.target.checked })} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection id="reset-heading" title="Saved settings" description="Stored only in this browser on this device: duration, voice, captions and music. No account, password or personal data is stored, and nothing is sent to a server.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-meta text-muted">{isDefaultPreferences(preferences) ? "You're using the default settings." : "You've changed some defaults."}</p>
          <Button variant="secondary" onClick={() => setConfirmReset(true)} disabled={isDefaultPreferences(preferences)}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Reset to defaults
          </Button>
        </div>
      </SettingsSection>

      {/* Toast at the bottom of the screen, always in the DOM so screen readers announce each save. */}
      <p
        role="status"
        aria-live="polite"
        data-testid="settings-feedback"
        className={
          feedback
            ? `fixed inset-x-4 bottom-4 z-40 flex items-start gap-2 rounded-card border bg-surface p-4 text-meta shadow-card sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm ${feedback.tone === "success" ? "border-success/50 text-success" : "border-error/50 text-error"}`
            : "sr-only"
        }
      >
        {feedback ? (
          <>
            {feedback.tone === "success" ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
            {feedback.text}
          </>
        ) : null}
      </p>

      <ResetPreferencesDialog open={confirmReset} onCancel={() => setConfirmReset(false)} onConfirm={confirmDefaults} />
    </div>
  );
}
