import type { Ref } from "react";
import { Lightbulb, PenLine } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { appConfig } from "@/config/app";

export interface PromptFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  tip: string;
  placeholder?: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
}

/** Prompt textarea with icon label, character count, validation message and tip. */
export function PromptField({ id, label, value, onChange, error, tip, placeholder = "Describe the video you want to make…", textareaRef }: PromptFieldProps) {
  const { maxLength } = appConfig.video.prompt;
  return (
    <div className="flex flex-col gap-3">
      <Textarea
        ref={textareaRef}
        id={id}
        label={
          <span className="inline-flex items-center gap-2 text-title">
            <PenLine aria-hidden="true" className="size-4 text-[#c7bfff]" />
            {label}
          </span>
        }
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        error={error ?? undefined}
        rows={4}
      />
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-start gap-2 text-meta text-muted">
          <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
          {tip}
        </p>
        <p className="shrink-0 text-meta text-muted" aria-live="polite">
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}
