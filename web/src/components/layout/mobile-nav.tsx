"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import type { UserProfile } from "@/types/user";
import { Brand } from "./brand";
import { SidebarContent } from "./sidebar";

/** Top bar with a drawer for screens below the `md` breakpoint. */
export function MobileNav({ user }: { user: UserProfile }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
      <Brand />
      <IconButton label="Open menu" icon={<Menu />} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={close} title="Menu" placement="left">
        <div className="h-[calc(100dvh-6rem)]">
          <SidebarContent user={user} onNavigate={close} />
        </div>
      </Dialog>
    </header>
  );
}
