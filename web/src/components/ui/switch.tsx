import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { describedBy, FieldMessages } from "./field";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "role"> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

/** Native checkbox exposed as `role="switch"`, so it works without client JavaScript. */
export function Switch({ id, label, description, error, className, disabled, ...props }: SwitchProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className={cn("text-body font-medium text-foreground", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
          {label}
        </label>
        <FieldMessages id={id} description={description} error={error} />
      </div>
      <span className="relative inline-flex h-11 shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy({ id, description, error })}
          className="peer h-6 w-11 cursor-pointer appearance-none rounded-full border border-border bg-surface-raised transition-colors duration-150 checked:border-primary checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          {...props}
        />
        <span aria-hidden="true" className="pointer-events-none absolute left-1 size-4 rounded-full bg-muted transition-transform duration-150 peer-checked:translate-x-5 peer-checked:bg-primary-foreground" />
      </span>
    </div>
  );
}
