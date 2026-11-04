import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoDetail } from "@/features/video-library/video-detail";
import { requireUser } from "@/lib/auth/session";
import { progressHref } from "@/lib/routes";
import { getVideo } from "@/services";

// A generic title: the video's own title depends on who is signed in, so it is never baked into static HTML (F10).
export const metadata: Metadata = { title: "Video" };

async function VideoContent({ params }: { params: PageProps<"/videos/[id]">["params"] }) {
  // Status changes over time (a retry or regenerate), so resolve it per request.
  await connection();
  const user = await requireUser();
  // Another user's video is "not found", exactly like an unknown id.
  const video = await getVideo((await params).id, user.id);
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
