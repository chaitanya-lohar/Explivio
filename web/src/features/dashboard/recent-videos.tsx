import Link from "next/link";
import { ArrowRight, Clapperboard } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { VideoCard } from "@/features/video-library/video-card";
import { listVideos } from "@/services";

const RECENT_COUNT = 3;

export async function RecentVideos() {
  const videos = (await listVideos()).slice(0, RECENT_COUNT);
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="recent-heading" className="text-section text-foreground">
          Recent videos
        </h2>
        {videos.length ? (
          <Link href="/videos" className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-meta font-semibold text-[#c7bfff] hover:text-foreground">
            View all
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
      {videos.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id}>
              <VideoCard video={video} />
            </li>
          ))}
        </ul>
      ) : (
        <Card padding="none">
          <EmptyState icon={<Clapperboard />} title="No videos yet" description="Your first video starts with an idea. Describe it above to get started." />
        </Card>
      )}
    </section>
  );
}
