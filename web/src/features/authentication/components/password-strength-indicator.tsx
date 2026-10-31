import { cn } from "@/lib/cn";
import { passwordStrength } from "../validation";

const segmentColor = ["bg-error", "bg-error", "bg-warning", "bg-success", "bg-success"] as const;
const labelColor = ["text-error", "text-error", "text-warning", "text-success", "text-success"] as const;

/** Text label for the field's label row, e.g. "Strong". Announced politely as it changes. */
export function PasswordStrengthLabel({ password }: { password: string }) {
  const strength = passwordStrength(password);
  return (
    <span aria-live="polite" className={cn("text-meta font-medium", password ? labelColor[strength.score] : "text-muted")}>
      {password ? strength.label : ""}
      <span className="sr-only">{password ? " password strength" : ""}</span>
    </span>
  );
}

/** Four-segment meter under the password field. Decorative; the label above carries the meaning. */
export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score } = passwordStrength(password);
  return (
    <div aria-hidden="true" className="-mt-2 grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((segment) => (
        <span key={segment} className={cn("h-1.5 rounded-full", password && score >= segment ? segmentColor[score] : "bg-surface-raised")} />
      ))}
    </div>
  );
}
