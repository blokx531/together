import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const CONTROL_CLASSES =
  'w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-subtle transition-colors focus:border-accent focus:outline-none focus-visible:outline-2 aria-[invalid=true]:border-negative disabled:opacity-60';

interface FieldFrameProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  hideLabel?: boolean | undefined;
  children: ReactNode;
}

function FieldFrame({ id, label, hint, error, hideLabel, children }: FieldFrameProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-ink'}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface CommonProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  hideLabel?: boolean;
}

export type TextFieldProps = CommonProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  className = '',
  ...rest
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL_CLASSES} ${className}`}
        {...rest}
      />
    </FieldFrame>
  );
}

export type SelectFieldProps = CommonProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & { children: ReactNode };

export function SelectField({
  label,
  hint,
  error,
  hideLabel,
  className = '',
  children,
  ...rest
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL_CLASSES} appearance-none ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

export type TextAreaFieldProps = CommonProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export function TextAreaField({
  label,
  hint,
  error,
  hideLabel,
  className = '',
  ...rest
}: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL_CLASSES} min-h-20 ${className}`}
        {...rest}
      />
    </FieldFrame>
  );
}

/** Form-level error summary, announced to assistive tech when it appears. */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-control bg-negative-soft px-3.5 py-2.5 text-sm text-negative"
    >
      {message}
    </p>
  );
}
