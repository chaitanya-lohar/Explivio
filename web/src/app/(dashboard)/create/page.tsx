import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { MilestonePlaceholder } from "@/components/shared/milestone-placeholder";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Create Video" };

export default function CreatePage() {
  return (
    <PageContainer width="narrow">
      <PageHeader eyebrow="Step 1 of 2" title="Create a video" description="Describe your topic. Explivio turns it into a narrated, animated vertical video." />
      <MilestonePlaceholder description="This step will collect your video prompt and offer ready-made ideas to start from." next={{ href: "/configure", label: "Preview the settings step" }} />
    </PageContainer>
  );
}
