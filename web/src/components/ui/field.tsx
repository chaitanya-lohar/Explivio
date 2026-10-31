import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FieldMessageProps {
  /** Id of the control; label, description and error ids are derived from it. */
  id: string;
  description?: ReactNode;
  error?: ReactNode;
}

/** Ids to put on a control's `aria-describedby` for its description and error. */
export function describedBy({ id, description, error }: FieldMessageProps): string | undefined {
  const ids = [description ? `${id}-description` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export interface FieldProps extends FieldMessageProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
}

/** Label + control + description + validation message, wired together for assistive tech. */
export function Field({ id, label, description, error, required, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-meta font-medium text-foreground">
        {label}
        {required ? <span className="text-muted"> (required)</span> : null}
      </label>
      {children}
      <FieldMessages id={id} description={description} error={error} />
    </div>
  );
}

export function FieldMessages({ id, description, error }: FieldMessageProps) {
  return (
    <>
      {description ? (
        <p id={`${id}-description`} className="text-meta text-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-meta text-error">
          {error}
        </p>
      ) : null}
    </>
  );
}

export const controlClasses =
  "w-full rounded-control border bg-background px-3.5 text-body text-foreground placeholder:text-muted transition-colors duration-150 hover:border-[#454c66] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50";
