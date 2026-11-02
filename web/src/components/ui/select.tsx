import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> {
  id: string;
  label: ReactNode;
  options: readonly SelectOption[];
  description?: ReactNode;
  error?: ReactNode;
  /** Keeps the label for assistive tech but hides it visually. */
  hideLabel?: boolean;
}

export function Select({ id, label, options, description, error, hideLabel, className, required, ...props }: SelectProps) {
  return (
    <Field id={id} label={label} description={description} error={error} required={required} hideLabel={hideLabel}>
      <div className="relative">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy({ id, description, error })}
          className={cn(controlClasses, "h-11 appearance-none pr-10", error ? "border-error" : "border-border", className)}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
      </div>
    </Field>
  );
}
