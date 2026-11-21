import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { toAppError, type AppError } from './appError';

export type ResourceState<T> =
  { status: 'loading' } | { status: 'error'; error: AppError } | { status: 'success'; data: T };

export type Resource<T> = ResourceState<T> & {
  /** Re-run the loader; current data stays visible while refreshing. */
  reload: () => void;
  isRefreshing: boolean;
};

/** Minimum gap between automatic refreshes when the app regains focus. */
const FOCUS_REFRESH_INTERVAL_MS = 15_000;

interface Settled<T> {
  key: string;
  /** Which load produced this state; a newer `version` in flight means "refreshing". */
  version: number;
  state: ResourceState<T>;
}

/**
 * Loads server data for one view. `key` identifies the query (e.g. `expenses:2026-11`); changing
 * it starts a fresh load and aborts the previous request. Data is refetched when the app becomes
 * visible again so a partner's changes appear without polling.
 *
 * Deliberately small: views own their data, mutations call `reload()` afterwards. If cross-view
 * caching ever becomes a real problem, replace this with a server-state library in one place.
 */
export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const runLoad = useEffectEvent(load);

  useEffect(() => {
    const controller = new AbortController();
    runLoad(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setSettled({ key, version, state: { status: 'success', data } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setSettled((current) =>
          // A failed background refresh keeps showing the last good data.
          current?.key === key && current.state.status === 'success'
            ? { ...current, version }
            : { key, version, state: { status: 'error', error: toAppError(error) } },
        );
      },
    );
    return () => {
      controller.abort();
    };
  }, [key, version]);

  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let lastRefresh = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefresh < FOCUS_REFRESH_INTERVAL_MS) return;
      lastRefresh = Date.now();
      reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  // State for a different key is never shown, even for one render.
  if (settled?.key !== key) return { status: 'loading', reload, isRefreshing: false };
  const isRefreshing = settled.state.status === 'success' && settled.version !== version;
  return { ...settled.state, reload, isRefreshing };
}
