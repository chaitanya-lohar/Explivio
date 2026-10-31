import type { ReactNode } from "react";
import { videoIdeas, type VideoIdea } from "@/config/ideas";
import { IdeaCard } from "./idea-card";

export function IdeaGrid({ heading, onUse }: { heading: ReactNode; onUse: (idea: VideoIdea) => void }) {
  return (
    <section aria-labelledby="ideas-heading" className="flex flex-col gap-4">
      <h2 id="ideas-heading" className="text-section text-foreground">
        {heading}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videoIdeas.map((idea) => (
          <li key={idea.id}>
            <IdeaCard idea={idea} onUse={onUse} />
          </li>
        ))}
      </ul>
    </section>
  );
}
