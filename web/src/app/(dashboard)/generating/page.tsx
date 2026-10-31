import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { MilestonePlaceholder } from "@/components/shared/milestone-placeholder";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Creating your video" };

export default function GeneratingPage() {
  return (
    <PageContainer>
      <PageHeader title="Creating your video" description="Progress will follow the real pipeline stages: preparing the video plan, creating narration and rendering." />
      <MilestonePlaceholder description="This screen will show truthful, stage-based progress and let you retry if something fails." next={{ href: "/videos", label: "Go to My Videos" }} />
    </PageContainer>
  );
}
