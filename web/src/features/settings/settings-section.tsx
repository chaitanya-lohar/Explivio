import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** One titled group on the Settings page. */
export function SettingsSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <section aria-labelledby={id} className="flex flex-col gap-5">
        <div>
          <h2 id={id} className="text-section text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-body text-muted">{description}</p>
        </div>
        {children}
      </section>
    </Card>
  );
}
