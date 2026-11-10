"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { deleteVideoAction } from "./actions";

/**
 * Delete with an in-app confirmation (never a browser confirm()). After deleting it refreshes the list, or goes to
 * My Videos when used on the video's own page (`afterDelete="library"`).
 */
export function DeleteVideoButton({ videoId, title, compact = false, afterDelete = "refresh", fullWidth = false }: { videoId: string; title: string; compact?: boolean; afterDelete?: "refresh" | "library"; fullWidth?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await deleteVideoAction(videoId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (afterDelete === "library") router.push("/videos");
      else router.refresh();
    });

  return (
    <>
      {compact ? (
        <IconButton label={`Delete ${title}`} icon={<Trash2 />} variant="ghost" onClick={() => setOpen(true)} className="text-muted hover:text-error" />
      ) : (
        <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)} fullWidth={fullWidth} className="text-error">
          Delete video
        </Button>
      )}
      <Dialog open={open} onClose={() => (pending ? undefined : setOpen(false))} title="Delete this video?">
        <p className="text-body text-muted">
          <span className="font-semibold text-foreground">{title}</span> will be removed from My Videos and its video file will be deleted. This can&apos;t be undone.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-meta text-error">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} loading={pending} loadingText="Deleting…" icon={<Trash2 className="size-4" />}>
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}
