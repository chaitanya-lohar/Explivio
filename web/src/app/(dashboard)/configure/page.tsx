import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { MilestonePlaceholder } from "@/components/shared/milestone-placeholder";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { appConfig } from "@/config/app";

export const metadata: Metadata = { title: "Video settings" };

export default function ConfigurePage() {
  const { video } = appConfig;
  const defaults = [
    { label: "Duration", value: `${video.durations.map((d) => `${d}s`).join(" / ")} (default ${video.defaultDuration}s)` },
    { label: "Format", value: `${video.aspectRatio} vertical, ${video.width} × ${video.height} MP4` },
    { label: "Captions", value: video.captionsEnabled ? "On by default" : "Off by default" },
    { label: "Background music", value: video.musicEnabled ? "On by default" : "Off by default" },
  ];
  return (
    <PageContainer width="narrow">
      <PageHeader eyebrow="Step 2 of 2" title="Video settings" description="Choose a few options, then generate your video." />
      <Card>
        <CardTitle>Supported options</CardTitle>
        <CardDescription>These come from the app configuration and will drive the settings form.</CardDescription>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {defaults.map((item) => (
            <div key={item.label} className="rounded-control border border-border bg-background p-3">
              <dt className="text-meta text-muted">{item.label}</dt>
              <dd className="mt-1 text-body text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <MilestonePlaceholder description="This step will let you pick duration, voice, captions and music before generating." />
    </PageContainer>
  );
}
