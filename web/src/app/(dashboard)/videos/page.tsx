import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button";
import { VideoCard } from "@/features/video-library/video-card";
import { listVideos } from "@/services";

export const metadata: Metadata = { title: "My Videos" };

export default async function VideosPage() {
  const videos = await listVideos();
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
      <section aria-labelledby="sample-videos">
        <h2 id="sample-videos" className="text-section text-foreground">
          Sample projects
        </h2>
        <p className="mt-1 text-meta text-muted">Mock data until the library is built (search, filters and list view come in a later milestone).</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id}>
              <VideoCard video={video} />
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
