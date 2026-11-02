"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Captions, CircleAlert, Music, Pencil, Shapes, Smartphone, Sparkles, UserRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioCard } from "@/components/ui/radio-card";
import { Switch } from "@/components/ui/switch";
import { appConfig, formatLabel } from "@/config/app";
import { cn } from "@/lib/cn";
import { progressHref } from "@/lib/routes";
import { usePreferences } from "@/features/settings/use-preferences";
import { chosenOr } from "@/lib/preferences";
import { creationHref, parseDurationParam, validatePrompt } from "@/lib/video-request";
import type { VideoDuration, VoiceId } from "@/types/video";
import { generateVideo } from "./actions";
import { FixedOption } from "./fixed-option";
import { IconLabel } from "./icon-label";

const { video } = appConfig;

/**
 * Step 2: choose settings and start generation. Reads the prompt (and any duration already chosen) from the URL.
 * Every option starts at the saved default from Settings; a choice made here wins for this video only.
 */
export function ConfigureForm() {
  const router = useRouter();
  const params = useSearchParams();
  const prompt = (params.get("prompt") ?? "").trim();
  const { preferences, ready } = usePreferences();
  const [chosenDuration, setDuration] = useState<VideoDuration | null>(() => parseDurationParam(params.get("duration")));
  const [chosenVoice, setVoice] = useState<VoiceId | null>(null);
  const [chosenCaptions, setCaptions] = useState<boolean | null>(null);
  const [chosenMusic, setMusic] = useState<boolean | null>(null);
  const duration = chosenOr(chosenDuration, preferences.durationSeconds);
  const voice = chosenOr(chosenVoice, preferences.voice);
  const captions = chosenOr(chosenCaptions, preferences.captions);
  const music = chosenOr(chosenMusic, preferences.music);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (validatePrompt(prompt)) {
    return (
      <Card padding="none">
        <EmptyState
          icon={<CircleAlert />}
          title="Start by describing your video"
          description="We need a topic before you can choose settings."
          action={
            <Link href={creationHref("/create", { prompt })} className={buttonStyles()}>
              Describe your video
            </Link>
          }
        />
      </Card>
    );
  }

  const editHref = creationHref("/create", { prompt, durationSeconds: duration });
  const voiceLabel = video.voices.find((v) => v.value === voice)?.label ?? "";

  function generate() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await generateVideo({ prompt, durationSeconds: duration, voice, captions, music });
      if (result.ok) router.push(progressHref(result.videoId));
      else setSubmitError(result.error);
    });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending && ready) generate();
      }}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="inline-flex items-center gap-2 text-meta font-semibold tracking-wide text-muted uppercase">
              <Sparkles aria-hidden="true" className="size-4 text-[#c7bfff]" />
              Your prompt
            </h2>
            <Link href={editHref} className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-meta font-semibold text-[#c7bfff] hover:text-foreground">
              Edit prompt
              <Pencil aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          <p className="mt-3 rounded-control border border-border bg-background p-4 text-body text-foreground">{prompt}</p>
        </Card>

        <Card className="flex flex-col gap-8">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-title text-foreground">Duration</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {video.durations.map((option) => (
                <RadioCard key={option.value} layout="stacked" name="duration" value={option.value} checked={duration === option.value} onChange={() => setDuration(option.value)} title={`${option.value}s`} description={option.label} />
              ))}
            </div>
            <p className="text-meta text-muted">Final length may vary slightly so the narration sounds natural.</p>
          </fieldset>

          <section aria-labelledby="format-heading" className="flex flex-col gap-3">
            <h3 id="format-heading" className="text-title text-foreground">
              Format
            </h3>
            <FixedOption icon={<Smartphone />} title={formatLabel} description="Made for vertical mobile feeds" />
          </section>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-title text-foreground">Narration voice</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {video.voices.map((option) => (
                <RadioCard key={option.value} name="voice" value={option.value} checked={voice === option.value} onChange={() => setVoice(option.value)} icon={<UserRound />} title={option.label} description={option.description} />
              ))}
            </div>
          </fieldset>

          <section aria-labelledby="audio-heading" className="flex flex-col gap-3">
            <h3 id="audio-heading" className="text-title text-foreground">
              Captions and music
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-card border border-border bg-background px-4 py-2">
                <Switch id="captions" label={<IconLabel icon={<Captions />}>Captions</IconLabel>} description="Burned into the video" checked={captions} onChange={(event) => setCaptions(event.target.checked)} />
              </div>
              <div className="rounded-card border border-border bg-background px-4 py-2">
                <Switch id="music" label={<IconLabel icon={<Music />}>Background music</IconLabel>} description="Soft instrumental music kept quiet under the narration" checked={music} onChange={(event) => setMusic(event.target.checked)} />
              </div>
            </div>
          </section>

          <section aria-labelledby="style-heading" className="flex flex-col gap-3">
            <h3 id="style-heading" className="text-title text-foreground">
              Visual style
            </h3>
            <FixedOption icon={<Shapes />} title={video.visualStyle.name} description={video.visualStyle.description} />
          </section>
        </Card>
      </div>

      <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-8">
        <Card className="flex flex-col gap-5">
          <h2 id="summary-heading" className="text-section text-foreground">
            Summary
          </h2>
          <div aria-hidden="true" className="mx-auto flex aspect-[9/16] w-24 flex-col items-center justify-center gap-1 rounded-control border-2 border-dashed border-primary/60 text-meta text-[#c7bfff]">
            <Smartphone className="size-5" />
            {video.aspectRatio}
          </div>
          <dl className="flex flex-col text-body">
            <SummaryRow label="Duration" value={`${duration}s`} />
            <SummaryRow label="Format" value={`${video.aspectRatio} vertical MP4`} />
            <SummaryRow label="Voice" value={voiceLabel} />
            <SummaryRow label="Captions" value={captions ? "On" : "Off"} />
            <SummaryRow label="Music" value={music ? "On" : "Off"} last />
          </dl>
          <p className="text-meta text-muted">
            Starting choices come from your{" "}
            <Link href="/settings" className="font-semibold text-[#c7bfff] underline-offset-2 hover:underline">
              Settings
            </Link>
            . Changes here apply to this video only.
          </p>
          {submitError ? (
            <p role="alert" className="flex items-start gap-2 text-meta text-error">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {submitError}
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            {/* Waits for the saved defaults to load, so a click can't send the product defaults by mistake. */}
            <Button type="submit" fullWidth disabled={!ready} loading={pending} loadingText="Starting…" icon={<Sparkles className="size-5" />}>
              Generate video
            </Button>
            <Link href={editHref} className={buttonStyles({ variant: "outline", fullWidth: true })}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </Link>
          </div>
        </Card>
      </aside>
    </form>
  );
}

function SummaryRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4 py-2.5", !last && "border-b border-border")}>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
