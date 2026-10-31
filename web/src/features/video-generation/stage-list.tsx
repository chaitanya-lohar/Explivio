import { Check, Circle, LoaderCircle } from "lucide-react";
import { generationStages } from "@/config/generation";
import { cn } from "@/lib/cn";
import type { GenerationStage } from "@/types/video";

/** Ordered pipeline stages with done / in progress / waiting states; text always accompanies the icon. */
export function StageList({ current }: { current: GenerationStage }) {
  const currentIndex = generationStages.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-col gap-2">
      {generationStages.map((stage, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "active" : "waiting";
        return (
          <li
            key={stage.id}
            aria-current={state === "active" ? "step" : undefined}
            className={cn("flex items-center gap-3 rounded-card border p-3", state === "active" ? "border-primary/60 bg-surface-raised" : "border-transparent")}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border",
                state === "done" && "border-success/50 bg-success/10 text-success",
                state === "active" && "border-primary/60 bg-primary/15 text-[#c7bfff]",
                state === "waiting" && "border-border text-muted",
              )}
            >
              {state === "done" ? <Check className="size-4" /> : state === "active" ? <LoaderCircle className="size-4 animate-spin" /> : <Circle className="size-3" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn("text-title", state === "waiting" ? "text-muted" : "text-foreground")}>{stage.label}</span>
              <span className="text-meta text-muted">{stage.description}</span>
            </span>
            <span className={cn("shrink-0 text-meta font-medium", state === "done" && "text-success", state === "active" && "text-[#c7bfff]", state === "waiting" && "text-muted")}>
              {state === "done" ? "Done" : state === "active" ? "In progress" : "Waiting"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
