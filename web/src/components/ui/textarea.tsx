import type { ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export function Textarea({ id, label, description, error, className, required, rows = 5, ...props }: TextareaProps) {
  return (
    <Field id={id} label={label} description={description} error={error} required={required}>
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, description, error })}
        className={cn(controlClasses, "min-h-28 resize-y py-3", error ? "border-error" : "border-border", className)}
        {...props}
      />
    </Field>
  );
}
