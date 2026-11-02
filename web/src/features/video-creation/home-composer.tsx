"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { appConfig, formatLabel } from "@/config/app";
import type { VideoIdea } from "@/config/ideas";
import { usePreferences } from "@/features/settings/use-preferences";
import { chosenOr } from "@/lib/preferences";
import { creationHref, validatePrompt } from "@/lib/video-request";
import type { VideoDuration } from "@/types/video";
import { IdeaGrid } from "./idea-grid";
import { PromptField } from "./prompt-field";

const durationOptions = appConfig.video.durations.map((d) => ({ value: d.value, label: `${d.value}s` }));

/** Home prompt composer plus idea suggestions; "Create video" goes straight to the settings step. */
export function HomeComposer() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const { preferences } = usePreferences();
  // Starts at the saved default; a choice made here wins for this video.
  const [chosenDuration, setDuration] = useState<VideoDuration | null>(null);
  const duration = chosenOr(chosenDuration, preferences.durationSeconds);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  function submit() {
    const problem = validatePrompt(prompt);
    setError(problem);
    if (problem) {
      textareaRef.current?.focus();
      return;
    }
    setNavigating(true);
    router.push(creationHref("/configure", { prompt, durationSeconds: duration }));
  }

  function applyIdea(idea: VideoIdea) {
    setPrompt(idea.prompt);
    setDuration(idea.durationSeconds);
    setError(null);
    textareaRef.current?.focus();
  }

  return (
    <>
      <Card padding="none">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex flex-col gap-5 p-5 sm:p-6"
        >
          <PromptField
            id="home-prompt"
            label="Describe your video"
            value={prompt}
            onChange={(value) => {
              setPrompt(value);
              if (error) setError(null);
            }}
            error={error}
            tip="Tip: include your topic, audience, and the key idea you want viewers to remember."
            textareaRef={textareaRef}
          />
          <Divider />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-meta text-muted">
                  <Timer aria-hidden="true" className="size-4" />
                  Duration
                </span>
                <SegmentedControl name="home-duration" legend="Duration" options={durationOptions} value={duration} onChange={setDuration} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-meta text-muted">Format</span>
                <span className="inline-flex h-11 items-center gap-2 rounded-control border border-border bg-background px-3 text-meta text-foreground">
                  <Smartphone aria-hidden="true" className="size-4 text-secondary" />
                  {formatLabel}
                </span>
              </div>
            </div>
            <Button type="submit" icon={<Sparkles className="size-5" />} loading={navigating} loadingText="Opening settings…" className="w-full sm:w-auto">
              Create video
            </Button>
          </div>
        </form>
      </Card>
      <IdeaGrid heading="Need inspiration? Try one of these." onUse={applyIdea} />
    </>
  );
}
