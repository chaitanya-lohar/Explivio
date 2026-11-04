import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string | number> {
  name: string;
  /** Accessible group label (visually rendered by the caller if needed). */
  legend: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Compact single-choice control built on native radio inputs (arrow keys move between options). */
export function SegmentedControl<T extends string | number>({ name, legend, options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <fieldset className={cn("inline-flex rounded-control border border-border bg-background p-1", className)}>
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "relative flex h-11 min-w-14 cursor-pointer sm:h-9 items-center justify-center rounded-[8px] px-3 text-body font-medium whitespace-nowrap text-muted transition-colors duration-150 hover:text-foreground",
            "has-checked:bg-primary/15 has-checked:text-[#c7bfff] has-checked:ring-1 has-checked:ring-primary",
            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
          )}
        >
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} className="sr-only" />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
