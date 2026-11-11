import Link from "next/link";
import { Download } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { formatDate, formatVideoLength } from "@/lib/format";
import { videoHref } from "@/lib/routes";
import type { VideoProject } from "@/types/video";
import { isPlayable, openLabel, unavailableNote } from "./video-card";
import { DeleteVideoButton } from "./delete-video-button";
import { VideoPreviewButton } from "./video-preview-button";
import { VideoStatusBadge } from "./video-status-badge";
import { VideoThumbnail } from "./video-thumbnail";

/** Column layout shared by the list header and rows (from xl up; below that each row stacks). */
export const LIST_COLUMNS = "xl:grid xl:grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_7rem_10.5rem_14rem] xl:items-center xl:gap-4";

/** One row of the list view: thumbnail, title and prompt, length, created date, status, actions. */
export function VideoListItem({ video }: { video: VideoProject }) {
  const playable = isPlayable(video);
  const length = formatVideoLength(video);
  const note = unavailableNote(video);
  return (
    <div data-testid="video-row" className={`relative flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-raised ${LIST_COLUMNS}`}>
      <VideoThumbnail src={playable ? video.videoUrl : undefined} poster={playable ? video.thumbnailUrl : undefined} className="w-14 shrink-0 self-start xl:self-center [&_svg]:size-5" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 xl:contents">
        <div className="min-w-0">
          <h3 className="text-title text-foreground">
            <Link href={videoHref(video)} aria-label={`${openLabel(video)}: ${video.title}`} className="after:absolute after:inset-0">
              {video.title}
            </Link>
          </h3>
          {video.prompt && video.prompt !== video.title ? <p className="mt-0.5 line-clamp-1 text-meta text-muted">{video.prompt}</p> : null}
          {note ? <p className="mt-0.5 text-meta text-warning">{note}</p> : null}
        </div>
        {/* One wrapped line on phones; separate columns from xl up. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 xl:contents">
          <p className="text-meta text-muted xl:text-body">
            <span className="sr-only">Length </span>
            {length.long}
          </p>
          <p className="text-meta text-muted xl:text-body">
            <span className="sr-only">Created </span>
            <time dateTime={video.createdAt}>{formatDate(video.createdAt)}</time>
          </p>
          <div>
            <VideoStatusBadge status={video.status} />
          </div>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2 xl:flex-nowrap xl:justify-end">
          {playable && video.videoUrl ? (
            <>
              <VideoPreviewButton src={video.videoUrl} title={video.title} />
              <a href={`${video.videoUrl}?download=1`} download className={buttonStyles({ variant: "secondary" })} aria-label={`Download MP4: ${video.title}`}>
                <Download aria-hidden="true" className="size-4" />
                MP4
              </a>
            </>
          ) : null}
          {video.status !== "generating" ? <DeleteVideoButton videoId={video.id} title={video.title} compact /> : null}
        </div>
      </div>
    </div>
  );
}
