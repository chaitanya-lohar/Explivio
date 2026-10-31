"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleAlert, Clapperboard, Info, RotateCcw, SearchX, SlidersHorizontal, WifiOff } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/config/app";
import { generationStages, STATUS_POLL_MS } from "@/config/generation";
import { VideoStatusBadge } from "@/features/video-library/video-status-badge";
import { creationHref } from "@/lib/video-request";
import type { VideoProject } from "@/types/video";
import { retryGeneration } from "./actions";
import { SavedSettings } from "./saved-settings";
import { StageList } from "./stage-list";
import { VideoActionButton } from "./video-action-button";

type LoadState = { kind: "loading" } | { kind: "not-found" } | { kind: "loaded"; video: VideoProject };

/** Reads `?video=` and follows that video's real status from the server until it is ready. */
export function GenerationStatus() {
  const id = useSearchParams().get("video") ?? "";
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 404) return setLoad({ kind: "not-found" });
        if (!response.ok) throw new Error(String(response.status));
        const video = (await response.json()) as VideoProject;
        setOffline(false);
        setNow(Date.now());
        setLoad({ kind: "loaded", video });
        if (video.status === "ready") return router.replace(`/videos/${encodeURIComponent(id)}`);
      } catch {
        if (!cancelled) setOffline(true);
      }
      // Keep polling while failed too, so a retry from this screen is picked up.
      if (!cancelled) timer = setTimeout(poll, STATUS_POLL_MS);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, router]);

  if (!id || load.kind === "not-found") {
    return (
      <Card padding="none">
        <EmptyState icon={<SearchX />} title="We couldn't find that video" description="It may have been removed, or the link is incomplete." action={<Link href="/videos" className={buttonStyles()}>Go to My Videos</Link>} />
      </Card>
    );
  }
  if (load.kind === "loading") {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }

  const { video } = load;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: "My Videos", href: "/videos" }, { label: video.title }]} />
        <PageHeader title={video.title} description={`${video.durationSeconds}s video, ${appConfig.video.aspectRatio} vertical`} actions={<VideoStatusBadge status={video.status} />} />
      </div>
      {offline ? (
        <p role="status" className="flex items-center gap-2 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-meta text-warning">
          <WifiOff aria-hidden="true" className="size-4" />
          Connection lost. Trying again…
        </p>
      ) : null}
      {video.status === "generating" ? <GeneratingView video={video} now={now} /> : null}
      {video.status === "failed" ? <FailedView video={video} /> : null}
      {video.status === "ready" ? (
        <Card>
          <p role="status" className="text-body text-foreground">
            Your video is ready. Opening it now…
          </p>
        </Card>
      ) : null}
      {video.status === "expired" || video.status === "draft" ? (
        <Card padding="none">
          <EmptyState icon={<Clapperboard />} title="This video isn't being created" action={<Link href={`/videos/${video.id}`} className={buttonStyles({ variant: "secondary" })}>View video details</Link>} />
        </Card>
      ) : null}
    </div>
  );
}

function startedLabel(startedAt: string | undefined, now: number): string {
  if (!startedAt) return "";
  const minutes = Math.floor((now - new Date(startedAt).getTime()) / 60000);
  if (minutes < 1) return "Started less than a minute ago";
  return `Started ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

function GeneratingView({ video, now }: { video: VideoProject; now: number }) {
  const stage = video.stage ?? "plan";
  const stageInfo = generationStages.find((s) => s.id === stage);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,18rem)_1fr]">
      <div className="relative mx-auto flex aspect-[9/16] w-full max-w-72 flex-col items-center justify-center gap-3 overflow-hidden rounded-card border border-border bg-gradient-to-b from-card to-background p-6 text-center">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent motion-safe:animate-pulse" />
        <span aria-hidden="true" className="relative flex size-12 items-center justify-center rounded-card border border-border bg-surface-raised text-[#c7bfff]">
          <Clapperboard className="size-6" />
        </span>
        <p className="relative text-body text-foreground">Your video will appear here when it&apos;s ready.</p>
      </div>
      <Card className="flex flex-col gap-5">
        <div>
          <h2 className="text-section text-foreground">Creating your video</h2>
          <p className="mt-1 text-meta text-muted">{startedLabel(video.startedAt, now)}</p>
        </div>
        {/* Indeterminate: the pipeline reports stages, not percentages. */}
        <div role="progressbar" aria-label="Video generation in progress" aria-valuetext={stageInfo?.label} className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-secondary motion-safe:animate-[indeterminate_1.6s_ease-in-out_infinite]" />
        </div>
        <StageList current={stage} />
        <p className="sr-only" aria-live="polite">
          {stageInfo?.label}
        </p>
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-meta text-muted">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
            Please keep this page open until your video is ready.
          </p>
          <Link href="/videos" className={buttonStyles({ variant: "outline" })}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to My Videos
          </Link>
        </div>
      </Card>
    </div>
  );
}

function FailedView({ video }: { video: VideoProject }) {
  const stageLabel = generationStages.find((s) => s.id === video.failedStage)?.label.toLowerCase();
  return (
    <Card className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Badge variant="error" icon={<CircleAlert />} className="self-start">
          Failed
        </Badge>
        <h2 className="text-section text-foreground">We couldn&apos;t finish your video</h2>
        <p className="text-body text-muted">
          Something went wrong{stageLabel ? ` while ${stageLabel}` : ""}. Your prompt and settings are saved, so you can try again.
        </p>
      </div>
      <SavedSettings request={video.request} />
      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <VideoActionButton action={retryGeneration} videoId={video.id} loadingText="Restarting…" icon={<RotateCcw className="size-4" />}>
            Try again
          </VideoActionButton>
          <Link href={creationHref("/configure", { prompt: video.request.prompt, durationSeconds: video.request.durationSeconds })} className={buttonStyles({ variant: "outline" })}>
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Edit settings
          </Link>
        </div>
        <Link href="/videos" className={buttonStyles({ variant: "ghost" })}>
          Back to My Videos
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
