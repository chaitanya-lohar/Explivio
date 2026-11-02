import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  /** Keeps the label for assistive tech but hides it visually (e.g. a search box with a placeholder). */
  hideLabel?: boolean;
  /** Decorative icon shown inside the field on the left. */
  leadingIcon?: ReactNode;
  /** Content placed at the right edge of the label row (e.g. a link or a status). */
  labelAside?: ReactNode;
  /** Interactive control placed inside the field on the right (e.g. a show/hide toggle). */
  trailingAction?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextInput({ id, label, description, error, hideLabel, leadingIcon, labelAside, trailingAction, className, required, type = "text", "aria-describedby": extraDescribedBy, ...props }: TextInputProps) {
  // Keep the field's own description/error ids and add any extra ones (e.g. a requirements list).
  const ariaDescribedBy = [describedBy({ id, description, error }), extraDescribedBy].filter(Boolean).join(" ") || undefined;
  return (
    <Field id={id} label={label} description={description} error={error} required={required} hideLabel={hideLabel} labelAside={labelAside}>
      <div className="relative">
        {leadingIcon ? (
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 inline-flex -translate-y-1/2 text-muted [&_svg]:size-4.5">
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={id}
          type={type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={ariaDescribedBy}
          className={cn(controlClasses, "h-12", Boolean(leadingIcon) && "pl-11", Boolean(trailingAction) && "pr-12", error ? "border-error" : "border-border", className)}
          {...props}
        />
        {trailingAction ? <span className="absolute top-1/2 right-0.5 -translate-y-1/2">{trailingAction}</span> : null}
      </div>
    </Field>
  );
}
