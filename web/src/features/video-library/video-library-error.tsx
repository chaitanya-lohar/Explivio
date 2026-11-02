"use client";

import { catchError, type ErrorInfo } from "next/error";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Shown when the video list can't be read. Retry re-reads it; the page header and navigation stay usable. */
function LibraryError(_props: object, { retry }: ErrorInfo) {
  return (
    <Card padding="none" role="alert">
      <EmptyState
        icon={<TriangleAlert />}
        title="Your videos couldn't be loaded"
        description="Something went wrong while reading your video library. Your videos haven't been changed. Try again in a moment."
        action={
          <Button variant="secondary" onClick={() => retry()}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Retry
          </Button>
        }
      />
    </Card>
  );
}

export const VideoLibraryErrorBoundary = catchError(LibraryError);
