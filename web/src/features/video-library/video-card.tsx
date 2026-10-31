import Link from "next/link";
import { Download } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { videoHref } from "@/lib/routes";
import type { VideoProject } from "@/types/video";
import { VideoStatusBadge } from "./video-status-badge";
import { VideoThumbnail } from "./video-thumbnail";

/** Library/recent card. The title links to the details page; Download appears only when a file is actually available. */
export function VideoCard({ video }: { video: VideoProject }) {
  return (
    <Card interactive padding="none" className="relative flex h-full flex-col">
      <div className="p-3">
        <VideoThumbnail durationSeconds={video.durationSeconds} className="mx-auto max-w-44" />
      </div>
      <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
        <h3 className="text-title text-foreground">
          <Link href={videoHref(video)} className="after:absolute after:inset-0 after:rounded-card">
            {video.title}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VideoStatusBadge status={video.status} />
          <span className="text-meta text-muted">
            <time dateTime={video.createdAt}>{formatDate(video.createdAt)}</time>
          </span>
        </div>
        {video.status === "ready" && video.videoUrl ? (
          <a href={`${video.videoUrl}?download=1`} download className={buttonStyles({ variant: "secondary", fullWidth: true, className: "relative z-10 mt-auto" })}>
            <Download aria-hidden="true" className="size-4" />
            Download MP4
          </a>
        ) : null}
      </div>
    </Card>
  );
}
