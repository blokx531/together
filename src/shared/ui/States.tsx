import { AlertCircle, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppError } from '../lib/appError';
import { Button } from './Button';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-control bg-surface-3 ${className}`} />;
}

/** A few skeleton rows with a screen-reader status. */
export function LoadingRows({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14" />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong px-6 py-8 text-center">
      {icon ? <div className="mb-1 text-ink-subtle">{icon}</div> : null}
      <p className="font-medium text-ink">{title}</p>
      {description ? <p className="max-w-xs text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  error: AppError;
  onRetry?: () => void;
  /** Feature-specific copy for this error, when the generic message is not helpful enough. */
  message?: string;
}

export function ErrorState({ error, onRetry, message }: ErrorStateProps) {
  const isOffline = error.kind === 'network';
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-card bg-negative-soft px-6 py-6 text-center"
    >
      {isOffline ? (
        <WifiOff className="size-6 text-negative" aria-hidden />
      ) : (
        <AlertCircle className="size-6 text-negative" aria-hidden />
      )}
      <p className="text-sm text-ink">{message ?? error.message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
