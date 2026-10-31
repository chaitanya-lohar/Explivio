import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const widths = { default: "max-w-6xl", narrow: "max-w-3xl" } as const;

/** Consistent page width and gutters: 16px on mobile, 32px on tablet, 40px on desktop. */
export function PageContainer({ children, width = "default", className }: { children: ReactNode; width?: keyof typeof widths; className?: string }) {
  return <div className={cn("mx-auto flex w-full flex-col gap-8 px-4 py-8 sm:px-8 lg:px-10 lg:py-10", widths[width], className)}>{children}</div>;
}
