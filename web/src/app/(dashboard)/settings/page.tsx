import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/features/settings/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="Settings" description="Defaults for new videos. Changes are saved automatically and used the next time you create a video." />
      <SettingsForm />
    </PageContainer>
  );
}
