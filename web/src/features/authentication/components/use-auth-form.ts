"use client";

import { useState, useTransition } from "react";
import type { AuthResponse, FieldErrors } from "../types";

/**
 * Shared submit logic for auth forms: client validation first (with focus moved to the first invalid field),
 * then the server action, with a pending flag that also blocks repeat submissions.
 */
export function useAuthForm<T>(options: { idPrefix: string; fieldOrder: readonly (keyof T)[]; validate: (values: T) => FieldErrors<T>; submit: (values: T) => Promise<AuthResponse<T>>; onSuccess: (response: Extract<AuthResponse<T>, { ok: true }>) => void }) {
  const [errors, setErrors] = useState<FieldErrors<T>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const focusFirst = (fieldErrors: FieldErrors<T>) => {
    const first = options.fieldOrder.find((key) => fieldErrors[key]);
    if (first) document.getElementById(`${options.idPrefix}-${String(first)}`)?.focus();
  };

  function handleSubmit(values: T) {
    if (pending) return;
    setFormError(null);
    const clientErrors = options.validate(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return focusFirst(clientErrors);
    startTransition(async () => {
      try {
        const response = await options.submit(values);
        if (response.ok) return options.onSuccess(response);
        if (response.fieldErrors) {
          setErrors(response.fieldErrors);
          focusFirst(response.fieldErrors);
        }
        setFormError(response.message);
      } catch {
        setFormError("We couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  /** Clears a field's error as soon as the user edits it. */
  function clearError(field: keyof T) {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  return { errors, formError, pending, handleSubmit, clearError };
}
