import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export function TextInput({ id, label, description, error, className, required, type = "text", ...props }: TextInputProps) {
  return (
    <Field id={id} label={label} description={description} error={error} required={required}>
      <input
        id={id}
        type={type}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, description, error })}
        className={cn(controlClasses, "h-11", error ? "border-error" : "border-border", className)}
        {...props}
      />
    </Field>
  );
}
