import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonStyles, type ButtonVariant } from "./button";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  /** Required accessible name; also shown as a tooltip. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
}

export function IconButton({ label, icon, variant = "ghost", className, type = "button", ...props }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={buttonStyles({ variant, size: "icon", className })} {...props}>
      <span aria-hidden="true" className="inline-flex [&_svg]:size-5">
        {icon}
      </span>
    </button>
  );
}
