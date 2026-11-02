import type { ReactNode } from "react";

/** A switch or field label with a small leading icon. */
export function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="inline-flex text-secondary [&_svg]:size-4">
        {icon}
      </span>
      {children}
    </span>
  );
}
