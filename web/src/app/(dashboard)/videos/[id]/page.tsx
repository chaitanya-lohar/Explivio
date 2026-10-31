import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Film } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { VideoStatusBadge } from "@/features/video-library/video-status-badge";
import { getVideo, listVideos } from "@/services";

export async function generateStaticParams() {
  const videos = await listVideos();
  return videos.map((video) => ({ id: video.id }));
}

export async function generateMetadata({ params }: PageProps<"/videos/[id]">): Promise<Metadata> {
  const video = await getVideo((await params).id);
  return { title: video?.title ?? "Video not found" };
}

export default async function VideoDetailPage({ params }: PageProps<"/videos/[id]">) {
  const video = await getVideo((await params).id);
  if (!video) notFound();

  return (
    <PageContainer>
      <Link href="/videos" className={buttonStyles({ variant: "ghost", size: "sm", className: "self-start" })}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        My Videos
      </Link>
      <PageHeader title={video.title} description={video.prompt} actions={<VideoStatusBadge status={video.status} />} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {/* 9:16 frame reserved for the video player. */}
        <div className="flex aspect-[9/16] w-full max-w-sm items-center justify-center self-start rounded-card border border-border bg-card text-muted">
          <div className="flex flex-col items-center gap-2 text-center">
            <Film aria-hidden="true" className="size-8" />
            <p className="text-meta">Video preview coming in a later milestone</p>
          </div>
        </div>
        <Card>
          <CardTitle>Video details</CardTitle>
          <dl className="mt-4 grid gap-3 text-body">
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted">Duration</dt>
              <dd>{video.durationSeconds}s</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Format</dt>
              <dd className="text-right">9:16 vertical MP4</dd>
            </div>
          </dl>
        </Card>
      </div>
    </PageContainer>
  );
}
