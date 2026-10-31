"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./icon-button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** "center" for modals, "left" for navigation drawers. */
  placement?: "center" | "left";
  className?: string;
}

/** Native `<dialog>`: focus trapping, Escape-to-close and the backdrop come from the browser. */
export function Dialog({ open, onClose, title, children, placement = "center", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "border border-border bg-surface p-0 text-foreground backdrop:bg-black/60",
        placement === "left" ? "m-0 h-dvh max-h-dvh w-72 max-w-[85vw] rounded-none border-y-0 border-l-0" : "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2">
        <h2 className="text-card text-foreground">{title}</h2>
        <IconButton label="Close" icon={<X />} onClick={onClose} />
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
