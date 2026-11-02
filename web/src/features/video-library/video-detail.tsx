import Link from "next/link";
import { Download, Film, Info, Plus, RotateCcw } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { appConfig } from "@/config/app";
import { regenerateVideo } from "@/features/video-generation/actions";
import { SavedSettings } from "@/features/video-generation/saved-settings";
import { VideoActionButton } from "@/features/video-generation/video-action-button";
import { cn } from "@/lib/cn";
import { formatDate, formatLength } from "@/lib/format";
import type { VideoProject } from "@/types/video";
import { VideoPlaceholder, VideoPlayer } from "./video-player";
import { VideoStatusBadge } from "./video-status-badge";

/** Video ready / expired details. Generating and failed videos are shown on the progress screen instead. */
export function VideoDetail({ video }: { video: VideoProject }) {
  const voice = appConfig.video.voices.find((v) => v.value === video.request.voice)?.label ?? video.request.voice;
  const expired = video.status === "expired";
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: "My Videos", href: "/videos" }, { label: video.title }]} />
        <PageHeader title={video.title} description={`Created ${formatDate(video.createdAt)}`} actions={<VideoStatusBadge status={video.status} />} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        {video.videoUrl && !expired ? (
          <VideoPlayer src={video.videoUrl} title={video.title} />
        ) : (
          <VideoPlaceholder message={expired ? "Video preview is no longer available." : "No video file is available for this project."} />
        )}

        <Card className="flex flex-col gap-6">
          {expired ? (
            <div className="rounded-card border border-border bg-background p-4">
              <h2 className="text-title text-foreground">This video file is no longer available</h2>
              <p className="mt-1 text-body text-muted">The MP4 for this project has been removed. Your prompt and settings are saved, so you can create it again.</p>
            </div>
          ) : null}
          {!expired && !video.videoUrl ? (
            <p className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning/10 p-4 text-meta text-warning">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              No video file is available for this project. Try Regenerate to create it again.
            </p>
          ) : null}

          {expired ? (
            <SavedSettings request={video.request} />
          ) : (
            <section aria-labelledby="details-heading">
              <h2 id="details-heading" className="text-meta font-semibold tracking-wide text-secondary uppercase">
                Video details
              </h2>
              <p className="mt-2 text-body text-muted">{video.prompt}</p>
              <dl className="mt-4 flex flex-col text-body">
                <DetailRow label="Length" value={video.actualDurationSeconds ? `${formatLength(video.actualDurationSeconds)} (target ${video.durationSeconds}s)` : `${video.durationSeconds}s target`} />
                <DetailRow label="Format" value={`${appConfig.video.aspectRatio} vertical MP4 (${appConfig.video.width} × ${appConfig.video.height})`} />
                <DetailRow label="Voice" value={voice} />
                <DetailRow label="Captions" value={video.request.captions ? "Burned in" : "Off"} />
                <DetailRow label="Music" value={video.request.music ? "On" : "Off"} last />
              </dl>
            </section>
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-5">
            {video.videoUrl && !expired ? (
              <>
                <a href={`${video.videoUrl}?download=1`} download className={buttonStyles({ size: "lg", fullWidth: true })}>
                  <Download aria-hidden="true" className="size-5" />
                  Download MP4
                </a>
                <p className="text-center text-meta text-muted">Download your video to keep a copy.</p>
              </>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <VideoActionButton action={regenerateVideo} videoId={video.id} variant={expired ? "primary" : "secondary"} loadingText="Starting…" icon={<RotateCcw className="size-4" />} fullWidth>
                {expired ? "Regenerate video" : "Regenerate"}
              </VideoActionButton>
              <Link href="/create" className={buttonStyles({ variant: "secondary", fullWidth: true })}>
                <Plus aria-hidden="true" className="size-4" />
                Create another
              </Link>
              <Link href="/videos" className={buttonStyles({ variant: "secondary", fullWidth: true })}>
                <Film aria-hidden="true" className="size-4" />
                My Videos
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4 py-2.5", !last && "border-b border-border")}>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
