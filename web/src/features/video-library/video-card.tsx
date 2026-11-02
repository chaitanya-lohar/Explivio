import Link from "next/link";
import { Download } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatVideoLength } from "@/lib/format";
import { videoHref } from "@/lib/routes";
import type { VideoProject } from "@/types/video";
import { VideoPreviewButton } from "./video-preview-button";
import { VideoStatusBadge } from "./video-status-badge";
import { VideoThumbnail } from "./video-thumbnail";

/** A playable file exists: only then are Preview and Download offered. */
export const isPlayable = (video: VideoProject) => video.status === "ready" && Boolean(video.videoUrl);

/** Why there is nothing to play, for videos that should have a file but don't. */
export function unavailableNote(video: VideoProject): string | null {
  if (video.status === "expired") return "Video file no longer available";
  if (video.status === "ready" && !video.videoUrl) return "Video file unavailable";
  return null;
}

/** Label for the main link: generating and failed videos open their progress screen. */
export function openLabel(video: VideoProject): string {
  return video.status === "generating" ? "View progress" : video.status === "failed" ? "View error" : "Open video";
}

/** Library/recent card. The title links to the video; Preview and Download appear only when a file is actually available. */
export function VideoCard({ video }: { video: VideoProject }) {
  const playable = isPlayable(video);
  const length = formatVideoLength(video);
  const note = unavailableNote(video);
  return (
    <Card interactive padding="none" className="relative flex h-full flex-col" data-testid="video-card">
      <div className="p-3">
        <VideoThumbnail src={playable ? video.videoUrl : undefined} length={length.short} className="mx-auto w-full max-w-44" />
      </div>
      <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
        <div className="min-w-0">
          <h3 className="text-title text-foreground">
            <Link href={videoHref(video)} aria-label={`${openLabel(video)}: ${video.title}`} className="after:absolute after:inset-0 after:rounded-card">
              {video.title}
            </Link>
          </h3>
          {video.prompt && video.prompt !== video.title ? <p className="mt-1 line-clamp-2 text-meta text-muted">{video.prompt}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VideoStatusBadge status={video.status} />
          <span className="text-meta text-muted">
            <span className="sr-only">Length </span>
            {length.long} · <time dateTime={video.createdAt}>{formatDate(video.createdAt)}</time>
          </span>
        </div>
        {note ? <p className="text-meta text-warning">{note}</p> : null}
        {playable && video.videoUrl ? (
          <div className="relative z-10 mt-auto grid grid-cols-2 gap-2">
            <VideoPreviewButton src={video.videoUrl} title={video.title} />
            <a href={`${video.videoUrl}?download=1`} download className={buttonStyles({ variant: "secondary" })} aria-label={`Download MP4: ${video.title}`}>
              <Download aria-hidden="true" className="size-4" />
              MP4
            </a>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
