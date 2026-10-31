"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { TextInput, type TextInputProps } from "./input";

export type PasswordInputProps = Omit<TextInputProps, "type" | "leadingIcon" | "trailingAction">;

/** Password field with a lock icon and a show/hide toggle. The toggle never submits the form. */
export function PasswordInput({ id, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";
  return (
    <TextInput
      id={id}
      type={visible ? "text" : "password"}
      leadingIcon={<LockKeyhole />}
      spellCheck={false}
      autoCapitalize="none"
      trailingAction={
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={label} aria-pressed={visible} aria-controls={id} title={label} className="flex size-11 items-center justify-center rounded-control text-muted hover:text-foreground">
          {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      }
      {...props}
    />
  );
}
