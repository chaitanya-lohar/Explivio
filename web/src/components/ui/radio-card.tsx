import type { InputHTMLAttributes, ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/cn";

export interface RadioCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "title"> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Layout: "row" puts the icon left of the text; "stacked" centres the text. */
  layout?: "row" | "stacked";
}

/** A native radio input presented as a selectable card. Group several with the same `name` inside a `<fieldset>`. */
export function RadioCard({ title, description, icon, layout = "row", className, ...props }: RadioCardProps) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer gap-3 rounded-card border border-border bg-card p-4 transition-colors duration-150 hover:border-[#454c66] hover:bg-surface-raised",
        "has-checked:border-primary has-checked:bg-surface-raised has-checked:ring-1 has-checked:ring-primary",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
        "has-disabled:cursor-not-allowed has-disabled:opacity-50",
        layout === "stacked" ? "flex-col items-center text-center" : "items-center",
        className,
      )}
    >
      <input type="radio" className="peer sr-only" {...props} />
      {icon ? (
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-raised text-[#c7bfff] [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <span className={cn("flex min-w-0 flex-col gap-0.5", layout === "row" && "flex-1")}>
        <span className="text-title text-foreground">{title}</span>
        {description ? <span className="text-meta text-muted group-has-checked:text-[#c7bfff]">{description}</span> : null}
      </span>
      <CircleCheck aria-hidden="true" className={cn("size-5 shrink-0 text-primary opacity-0 transition-opacity peer-checked:opacity-100", layout === "stacked" && "absolute top-3 right-3")} />
    </label>
  );
}
