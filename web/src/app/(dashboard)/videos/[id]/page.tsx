import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoDetail } from "@/features/video-library/video-detail";
import { progressHref } from "@/lib/routes";
import { getVideo, getVideoTitle, listVideoIds } from "@/services";

export async function generateStaticParams() {
  return (await listVideoIds()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/videos/[id]">): Promise<Metadata> {
  return { title: (await getVideoTitle((await params).id)) ?? "Video not found" };
}

async function VideoContent({ params }: { params: PageProps<"/videos/[id]">["params"] }) {
  // Status changes over time (a retry or regenerate), so resolve it per request.
  await connection();
  const video = await getVideo((await params).id);
  if (!video) notFound();
  if (video.status === "generating" || video.status === "failed") redirect(progressHref(video.id));
  return <VideoDetail video={video} />;
}

export default function VideoDetailPage({ params }: PageProps<"/videos/[id]">) {
  return (
    <PageContainer>
      <Suspense fallback={<Skeleton className="h-[32rem] rounded-card" />}>
        <VideoContent params={params} />
      </Suspense>
    </PageContainer>
  );
}
