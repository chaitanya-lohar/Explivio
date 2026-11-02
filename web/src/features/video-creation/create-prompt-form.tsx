"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { VideoIdea } from "@/config/ideas";
import { creationHref, parseDurationParam, validatePrompt } from "@/lib/video-request";
import { IdeaGrid } from "./idea-grid";
import { PromptField } from "./prompt-field";

/** Step 1: describe the idea. Prefills from `?prompt=` when the user comes back to edit it. */
export function CreatePromptForm() {
  const router = useRouter();
  const params = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState(() => params.get("prompt") ?? "");
  // Only an explicit choice (from the URL or an idea) is carried forward; otherwise Configure applies the saved default.
  const [duration, setDuration] = useState(() => parseDurationParam(params.get("duration")));
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
    router.push(creationHref("/configure", { prompt, durationSeconds: duration ?? undefined }));
  }

  function applyIdea(idea: VideoIdea) {
    setPrompt(idea.prompt);
    setDuration(idea.durationSeconds);
    setError(null);
    textareaRef.current?.focus();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-8"
    >
      <Card>
        <PromptField
          id="create-prompt"
          label="Video prompt"
          value={prompt}
          onChange={(value) => {
            setPrompt(value);
            if (error) setError(null);
          }}
          error={error}
          tip="Tip: include your audience (for example, complete beginners) so the pacing fits."
          placeholder="Describe the video you want to make… e.g. Explain how APIs work to complete beginners."
          textareaRef={textareaRef}
        />
      </Card>
      <IdeaGrid heading="Need inspiration? Start from an idea." onUse={applyIdea} />
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className={buttonStyles({ variant: "outline" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to Home
        </Link>
        <Button type="submit" loading={navigating} loadingText="Opening settings…" className="sm:min-w-56">
          Continue to settings
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </form>
  );
}
