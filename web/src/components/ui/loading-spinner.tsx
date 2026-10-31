import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const sizes = { sm: "size-4", md: "size-5", lg: "size-8" } as const;

export interface LoadingSpinnerProps {
  size?: keyof typeof sizes;
  /** Accessible label; pass an empty string when surrounding text already describes the state. */
  label?: string;
  className?: string;
}

export function LoadingSpinner({ size = "md", label = "Loading", className }: LoadingSpinnerProps) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex", className)}>
      <LoaderCircle aria-hidden="true" className={cn("animate-spin", sizes[size])} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
