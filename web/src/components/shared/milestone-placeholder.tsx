import Link from "next/link";
import { Hammer } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "./empty-state";

export interface MilestonePlaceholderProps {
  /** What this screen will do once it is built. */
  description: string;
  next?: { href: string; label: string };
}

/** Honest stand-in for screens that are scheduled for a later milestone. */
export function MilestonePlaceholder({ description, next }: MilestonePlaceholderProps) {
  return (
    <Card padding="none">
      <EmptyState
        icon={<Hammer />}
        title="This screen is coming in a later milestone"
        description={description}
        action={next ? <Link href={next.href} className={buttonStyles({ variant: "secondary" })}>{next.label}</Link> : undefined}
      />
    </Card>
  );
}
