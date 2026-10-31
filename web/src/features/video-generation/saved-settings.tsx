import { SlidersHorizontal } from "lucide-react";
import { appConfig } from "@/config/app";
import type { VideoRequest } from "@/types/video";

/** Read-only view of the settings a video was created with. */
export function SavedSettings({ request }: { request: VideoRequest }) {
  const voice = appConfig.video.voices.find((v) => v.value === request.voice)?.label ?? request.voice;
  const items = [
    { label: "Duration", value: `${request.durationSeconds}s` },
    { label: "Format", value: `${appConfig.video.aspectRatio} vertical` },
    { label: "Voice", value: voice },
    { label: "Captions", value: request.captions ? "On" : "Off" },
    { label: "Music", value: request.music ? "On" : "Off" },
    { label: "Visual style", value: appConfig.video.visualStyle.name },
  ];
  return (
    <section aria-labelledby="saved-settings" className="flex flex-col gap-4 rounded-card border border-border bg-background p-4 sm:p-5">
      <h2 id="saved-settings" className="inline-flex items-center gap-2 text-title text-foreground">
        <SlidersHorizontal aria-hidden="true" className="size-4 text-[#c7bfff]" />
        Saved settings
      </h2>
      <div>
        <p className="text-meta text-muted">Prompt</p>
        <p className="mt-1 text-body text-foreground">{request.prompt}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-control border border-border bg-card p-3">
            <dt className="text-meta text-muted">{item.label}</dt>
            <dd className="mt-0.5 text-body text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
