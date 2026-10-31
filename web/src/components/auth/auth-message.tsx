import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/cn";

export type AuthMessageVariant = "success" | "info" | "error";

const styles: Record<AuthMessageVariant, string> = {
  success: "border-success/40 bg-success/10 text-success",
  info: "border-secondary/40 bg-secondary/10 text-secondary",
  error: "border-error/40 bg-error/10 text-error",
};
const icons: Record<AuthMessageVariant, ReactNode> = { success: <CircleCheck />, info: <Info />, error: <CircleAlert /> };

/** Form-level feedback (also used as FormError). Errors are announced immediately; other messages politely. */
export function AuthMessage({ variant, title, children, className }: { variant: AuthMessageVariant; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-control border p-3.5 text-meta", styles[variant], className)}>
      <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0 [&_svg]:size-4">
        {icons[variant]}
      </span>
      <div className="flex flex-col gap-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-foreground/90">{children}</div> : null}
      </div>
    </div>
  );
}
