import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { VideoStatus } from "@/types/video";

const statusDisplay: Record<VideoStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  generating: { label: "Generating", variant: "processing" },
  ready: { label: "Ready to download", variant: "success" },
  failed: { label: "Failed", variant: "error" },
  expired: { label: "Expired", variant: "warning" },
};

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  const { label, variant } = statusDisplay[status];
  return <Badge variant={variant}>{label}</Badge>;
}
