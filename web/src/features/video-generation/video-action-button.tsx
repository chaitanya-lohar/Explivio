"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { progressHref } from "@/lib/routes";
import type { VideoActionResult } from "./actions";

export interface VideoActionButtonProps {
  action: (videoId: string) => Promise<VideoActionResult>;
  videoId: string;
  children: ReactNode;
  loadingText: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

/** Runs a retry/regenerate server action, then opens the progress screen for the resulting video. */
export function VideoActionButton({ action, videoId, children, loadingText, icon, variant = "primary", fullWidth }: VideoActionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={fullWidth ? "flex w-full flex-col gap-2" : "flex flex-col gap-2"}>
      <Button
        variant={variant}
        icon={icon}
        fullWidth={fullWidth}
        loading={pending}
        loadingText={loadingText}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await action(videoId);
            if (result.ok) router.push(progressHref(result.videoId));
            else setError(result.error);
          });
        }}
      >
        {children}
      </Button>
      {error ? (
        <p role="alert" className="text-meta text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
