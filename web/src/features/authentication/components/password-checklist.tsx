import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/cn";
import { passwordRules } from "../validation";

/** Live requirements list. Each item pairs an icon with text (plus hidden "met" state), so status isn't colour-only. */
export function PasswordChecklist({ id, password, confirmPassword }: { id: string; password: string; confirmPassword: string }) {
  const items = [...passwordRules.map((rule) => ({ label: rule.label, met: rule.test(password) })), { label: "Passwords match", met: password.length > 0 && password === confirmPassword }];
  return (
    <div id={id} className="rounded-control border border-border bg-background p-4">
      <p className="mb-2 text-meta font-semibold tracking-wide text-muted uppercase">Password requirements</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.label} className={cn("flex items-center gap-2 text-meta", item.met ? "text-success" : "text-muted")}>
            {item.met ? <Check aria-hidden="true" className="size-4" /> : <Circle aria-hidden="true" className="size-4" />}
            <span>
              {item.label}
              <span className="sr-only">{item.met ? " (met)" : " (not met yet)"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
