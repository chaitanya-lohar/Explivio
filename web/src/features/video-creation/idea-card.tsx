import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { VideoIdea } from "@/config/ideas";

export interface IdeaCardProps {
  idea: VideoIdea;
  onUse: (idea: VideoIdea) => void;
}

/** Suggested topic; "Use idea" fills the prompt field. */
export function IdeaCard({ idea, onUse }: IdeaCardProps) {
  const Icon = idea.icon;
  return (
    <Card interactive padding="none" className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-control border border-border bg-surface-raised text-[#c7bfff]">
          <Icon className="size-5" />
        </span>
        <h3 className="text-title text-foreground">{idea.title}</h3>
        <p className="text-meta text-muted">{idea.description}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        <span className="text-meta text-muted">
          {idea.category} · {idea.durationSeconds}s
        </span>
        <button type="button" onClick={() => onUse(idea)} aria-label={`Use idea: ${idea.title}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-meta font-semibold whitespace-nowrap text-[#c7bfff] hover:text-foreground">
          Use idea
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </Card>
  );
}
