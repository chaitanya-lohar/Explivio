import { Suspense } from "react";
import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerationStatus } from "@/features/video-generation/generation-status";

export const metadata: Metadata = { title: "Creating your video" };

export default function GeneratingPage() {
  return (
    <PageContainer>
      {/* Reads ?video= on the client, which needs a Suspense boundary under Cache Components. */}
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <GenerationStatus />
      </Suspense>
    </PageContainer>
  );
}
