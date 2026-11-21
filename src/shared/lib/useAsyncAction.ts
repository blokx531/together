import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toAppError, type AppError } from './appError';

export type ActionResult<R> = { ok: true; value: R } | { ok: false; error: AppError };

/**
 * Wraps a mutation: tracks pending/error state and ignores re-entrant calls (double taps) while
 * one is in flight. Backend writes must still be idempotent; this only protects the UI.
 */
export function useAsyncAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const inFlight = useRef(false);
  const actionRef = useRef(action);
  useLayoutEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(async (...args: A): Promise<ActionResult<R> | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setIsPending(true);
    setError(null);
    try {
      const value = await actionRef.current(...args);
      return { ok: true, value };
    } catch (caught) {
      const appError = toAppError(caught);
      setError(appError);
      return { ok: false, error: appError };
    } finally {
      inFlight.current = false;
      setIsPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { run, isPending, error, reset };
}
