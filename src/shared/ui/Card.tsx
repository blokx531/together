import { useId, type ReactNode } from 'react';

interface CardProps {
  title?: string;
  /** Optional element shown at the right of the title row (e.g. a link). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, action, children, className = '' }: CardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`rounded-card border border-line bg-surface p-4 shadow-card sm:p-5 ${className}`}
    >
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? (
            <h2 id={titleId} className="text-[0.9375rem] font-semibold text-ink">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
