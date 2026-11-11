"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { improvePrompt, type ImprovePromptResult } from "./actions";

/**
 * "Improve my prompt": asks Gemini (on the server) for a clearer version of the prompt and three related topics.
 * Nothing changes until the user chooses "Use this" or taps a suggestion.
 */
export function PromptAssist({ prompt, onApply }: { prompt: string; onApply: (text: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImprovePromptResult | null>(null);
  const tooShort = prompt.trim().length < 3;

  const run = () =>
    startTransition(async () => {
      setResult(null);
      setResult(await improvePrompt(prompt));
    });
  const apply = (text: string) => {
    onApply(text);
    setResult(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" icon={<Sparkles className="size-4" />} onClick={run} loading={pending} loadingText="Improving…" disabled={tooShort}>
          Improve my prompt
        </Button>
        <span className="text-meta text-muted">{tooShort ? "Type your topic, then let AI make it clearer." : "AI rewrites it as a clear brief and suggests related topics."}</span>
      </div>

      {result && !result.ok ? (
        <p role="status" className="text-meta text-warning">
          {result.error}
        </p>
      ) : null}

      {result?.ok ? (
        <div role="region" aria-label="Prompt suggestions" className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-meta font-semibold tracking-wide text-secondary uppercase">Suggested prompt</p>
            <button type="button" onClick={() => setResult(null)} aria-label="Dismiss suggestions" className="text-muted hover:text-foreground">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="text-body text-foreground">{result.polished}</p>
          {result.note ? <p className="text-meta text-muted">{result.note}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" icon={<Check className="size-4" />} onClick={() => apply(result.polished)}>
              Use this
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setResult(null)}>
              Keep mine
            </Button>
          </div>
          {result.suggestions.length ? (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-meta text-muted">Related ideas — tap one to use it:</p>
              <ul className="flex flex-col gap-2">
                {result.suggestions.map((idea) => (
                  <li key={idea}>
                    <button type="button" onClick={() => apply(idea)} className="w-full rounded-control border border-border bg-background px-3 py-2 text-left text-meta text-foreground transition hover:border-primary hover:bg-surface">
                      {idea}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
