import { Film } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * 9:16 frame for a video. With a thumbnail image (videos from 2026-11-11 on) it shows that; otherwise, when the MP4 is
 * available, a real frame from it (the browser fetches only the metadata and the frame at 1s); otherwise, or until
 * that loads, a neutral placeholder. `length` is shown in the corner. The caller sets the width.
 */
export function VideoThumbnail({ src, poster, length, className }: { src?: string; poster?: string; length?: string; className?: string }) {
  return (
    <div className={cn("relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-control border border-border bg-gradient-to-b from-surface-raised to-background", className)}>
      <Film aria-hidden="true" className="size-8 text-muted" />
      {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed-in API image; next/image would proxy it */}
      {poster ? <img src={poster} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 size-full object-cover" /> : src ? <video aria-hidden="true" tabIndex={-1} src={`${src}#t=1`} preload="metadata" muted playsInline disablePictureInPicture className="pointer-events-none absolute inset-0 size-full object-cover" /> : null}
      {length ? <span className="absolute right-2 bottom-2 rounded-[6px] bg-background/90 px-1.5 py-0.5 font-mono text-meta text-foreground">{length}</span> : null}
    </div>
  );
}
