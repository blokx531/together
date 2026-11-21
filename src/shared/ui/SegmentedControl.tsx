import { useId } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A compact single-choice control built on native radio inputs (keyboard support included). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className="sr-only">{label}</legend>
      <div className="flex rounded-control bg-surface-2 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-[0.6rem] px-2 text-sm font-medium text-ink-muted transition-colors has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
