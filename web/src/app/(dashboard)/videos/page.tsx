import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button";
import { VideoLibrary } from "@/features/video-library/video-library";
import { VideoLibraryErrorBoundary } from "@/features/video-library/video-library-error";
import { VideoLibrarySkeleton } from "@/features/video-library/video-library-skeleton";
import { listVideos } from "@/services";

export const metadata: Metadata = { title: "My Videos" };

async function LibraryContent() {
  // Statuses change while videos generate, so read the library per request.
  await connection();
  return <VideoLibrary videos={await listVideos()} />;
}

export default function VideosPage() {
  return (
    <PageContainer>
      <PageHeader
        title="My Videos"
        description="Manage and access your generated educational videos."
        actions={
          <Link href="/create" className={buttonStyles()}>
            <Plus aria-hidden="true" className="size-5" />
            Create video
          </Link>
        }
      />
      <VideoLibraryErrorBoundary>
        <Suspense fallback={<VideoLibrarySkeleton />}>
          <LibraryContent />
        </Suspense>
      </VideoLibraryErrorBoundary>
    </PageContainer>
  );
}
