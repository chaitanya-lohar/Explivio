import { VideoOff } from "lucide-react";
import { cn } from "@/lib/cn";

const frame = "mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-card border border-border bg-black";

/** 9:16 player using native controls (keyboard and screen-reader accessible). Captions are burned into the video. */
export function VideoPlayer({ src, title }: { src: string; title: string }) {
  return (
    <video className={cn(frame, "object-contain")} src={src} controls playsInline preload="metadata" aria-label={`Video: ${title}`}>
      Your browser can&apos;t play this video. Use the Download button instead.
    </video>
  );
}

/** Same frame when there is nothing to play. */
export function VideoPlaceholder({ message }: { message: string }) {
  return (
    <div className={cn(frame, "flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-card to-background p-6 text-center")}>
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-card border border-border bg-surface-raised text-muted">
        <VideoOff className="size-6" />
      </span>
      <p className="text-meta text-muted">{message}</p>
    </div>
  );
}
