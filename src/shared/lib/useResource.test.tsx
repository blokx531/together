import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useResource } from './useResource';

describe('useResource', () => {
  it('loads, then keeps data visible while reloading', async () => {
    let calls = 0;
    const { result } = renderHook(() => useResource('k', () => Promise.resolve(++calls)));
    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'success', data: 1 });
    });
    act(() => {
      result.current.reload();
    });
    expect(result.current).toMatchObject({ status: 'success', data: 1, isRefreshing: true });
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'success', data: 2, isRefreshing: false });
    });
  });

  it('never shows data from a previous key', async () => {
    const { result, rerender } = renderHook(({ k }) => useResource(k, () => Promise.resolve(k)), {
      initialProps: { k: 'a' },
    });
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'success', data: 'a' });
    });
    rerender({ k: 'b' });
    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'success', data: 'b' });
    });
  });

  it('reports errors and recovers on retry', async () => {
    let shouldFail = true;
    const { result } = renderHook(() =>
      useResource('e', () =>
        shouldFail ? Promise.reject(new Error('Failed to fetch')) : Promise.resolve('ok'),
      ),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    shouldFail = false;
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'success', data: 'ok' });
    });
  });
});
