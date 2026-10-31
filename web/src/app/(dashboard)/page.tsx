import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { RecentVideos } from "@/features/dashboard/recent-videos";
import { HomeComposer } from "@/features/video-creation/home-composer";

export default function HomePage() {
  return (
    <PageContainer>
      <PageHeader title="What will you create today?" description="Describe any concept and get a clear, narrated vertical video ready to share." />
      <HomeComposer />
      <RecentVideos />
    </PageContainer>
  );
}
