import { Film } from "lucide-react";
import { cn } from "@/lib/cn";

/** 9:16 frame for a video. No rendered thumbnails exist yet, so it shows a neutral placeholder with the duration. */
export function VideoThumbnail({ durationSeconds, className }: { durationSeconds: number; className?: string }) {
  return (
    <div className={cn("relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-control border border-border bg-gradient-to-b from-surface-raised to-background", className)}>
      <Film aria-hidden="true" className="size-8 text-muted" />
      <span className="absolute right-2 bottom-2 rounded-[6px] bg-background/90 px-1.5 py-0.5 font-mono text-meta text-foreground">{durationSeconds}s</span>
    </div>
  );
}
