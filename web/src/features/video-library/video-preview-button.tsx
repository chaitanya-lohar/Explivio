"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { VideoPlayer } from "./video-player";

/** "Preview" opens the video in a dialog using the same player as the details page. The player exists only while open, so closing stops playback. */
export function VideoPreviewButton({ src, title, className }: { src: string; title: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonStyles({ variant: "secondary", size: "md", className })} aria-label={`Preview ${title}`}>
        <Play aria-hidden="true" className="size-4" />
        Preview
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} className="w-[min(26rem,calc(100vw-2rem))]">
        {open ? <VideoPlayer src={src} title={title} autoPlay className="max-h-[75dvh] w-auto max-w-full" /> : null}
      </Dialog>
    </>
  );
}
