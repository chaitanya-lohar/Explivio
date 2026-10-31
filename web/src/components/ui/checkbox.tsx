import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { describedBy, FieldMessages } from "./field";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export function Checkbox({ id, label, description, error, className, disabled, ...props }: CheckboxProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={cn("inline-flex min-h-11 items-center gap-3 text-body text-foreground", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
        <span className="relative inline-flex size-5 shrink-0">
          <input
            id={id}
            type="checkbox"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy({ id, description, error })}
            className="peer size-5 cursor-[inherit] appearance-none rounded-[6px] border border-border bg-background transition-colors checked:border-primary checked:bg-primary hover:border-[#454c66] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            {...props}
          />
          <Check aria-hidden="true" strokeWidth={3} className="pointer-events-none absolute inset-0.5 size-4 text-primary-foreground opacity-0 peer-checked:opacity-100" />
        </span>
        {label}
      </label>
      <div className="pl-8">
        <FieldMessages id={id} description={description} error={error} />
      </div>
    </div>
  );
}
