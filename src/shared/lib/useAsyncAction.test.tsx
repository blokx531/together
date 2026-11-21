import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsyncAction } from './useAsyncAction';

describe('useAsyncAction', () => {
  it('ignores a second call while the first is in flight', async () => {
    let calls = 0;
    let release: () => void = () => undefined;
    const { result } = renderHook(() =>
      useAsyncAction(
        () =>
          new Promise<string>((resolve) => {
            calls += 1;
            release = () => {
              resolve('done');
            };
          }),
      ),
    );

    let first: Promise<unknown> = Promise.resolve();
    let second: unknown;
    await act(async () => {
      first = result.current.run();
      second = await result.current.run();
    });
    expect(second).toBeNull();
    expect(calls).toBe(1);
    await act(async () => {
      release();
      await first;
    });
    expect(await first).toEqual({ ok: true, value: 'done' });
    expect(result.current.isPending).toBe(false);
  });

  it('exposes a normalised error', async () => {
    const { result } = renderHook(() =>
      useAsyncAction(() => Promise.reject(new Error('Failed to fetch'))),
    );
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error?.kind).toBe('network');
  });
});
