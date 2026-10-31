import { Suspense } from "react";
import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigureForm } from "@/features/video-creation/configure-form";
import { StepHeader } from "@/features/video-creation/step-header";

export const metadata: Metadata = { title: "Video settings" };

export default function ConfigurePage() {
  return (
    <PageContainer>
      <StepHeader step={2} crumbs={[{ label: "Home", href: "/" }, { label: "Create video", href: "/create" }, { label: "Settings" }]} title="Video settings" description="Choose a few options, then generate your video." />
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <ConfigureForm />
      </Suspense>
    </PageContainer>
  );
}
