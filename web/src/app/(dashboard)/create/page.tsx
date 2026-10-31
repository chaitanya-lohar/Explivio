import { Suspense } from "react";
import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatePromptForm } from "@/features/video-creation/create-prompt-form";
import { StepHeader } from "@/features/video-creation/step-header";

export const metadata: Metadata = { title: "Create Video" };

export default function CreatePage() {
  return (
    <PageContainer>
      <StepHeader step={1} crumbs={[{ label: "Home", href: "/" }, { label: "Create video" }]} title="Create a video" description="Describe your topic. Explivio turns it into a narrated, animated vertical video." />
      {/* The form reads ?prompt= to prefill, which needs a Suspense boundary under Cache Components. */}
      <Suspense fallback={<Skeleton className="h-64 rounded-card" />}>
        <CreatePromptForm />
      </Suspense>
    </PageContainer>
  );
}
