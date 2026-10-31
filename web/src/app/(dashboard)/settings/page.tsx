import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { MilestonePlaceholder } from "@/components/shared/milestone-placeholder";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="Settings" description="Defaults for new videos." />
      <MilestonePlaceholder description="Settings will hold your default duration, voice, captions and music preferences, plus an explanation of what is stored." />
    </PageContainer>
  );
}
