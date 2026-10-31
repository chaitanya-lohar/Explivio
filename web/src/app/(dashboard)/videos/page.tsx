import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/features/video-library/video-card";
import { listVideos } from "@/services";

export const metadata: Metadata = { title: "My Videos" };

async function VideoList() {
  await connection();
  const videos = await listVideos();
  return (
    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <li key={video.id}>
          <VideoCard video={video} />
        </li>
      ))}
    </ul>
  );
}

export default function VideosPage() {
  return (
    <PageContainer>
      <PageHeader
        title="My Videos"
        description="Preview and download the videos you've created."
        actions={
          <Link href="/create" className={buttonStyles()}>
            <Plus aria-hidden="true" className="size-5" />
            Create video
          </Link>
        }
      />
      <section aria-labelledby="all-videos">
        <h2 id="all-videos" className="text-section text-foreground">
          Your projects
        </h2>
        <p className="mt-1 text-meta text-muted">Search, filters and a list view come in a later milestone.</p>
        <Suspense fallback={<Skeleton className="mt-4 h-80 rounded-card" />}>
          <VideoList />
        </Suspense>
      </section>
    </PageContainer>
  );
}
