import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@/shared/types/database';
import { exportMyData } from './exportData';

const baseUrl = 'http://127.0.0.1:54321';

function jsonPage(rows: unknown[], offset: number, count: number) {
  const range = rows.length ? `${offset}-${offset + rows.length - 1}` : '*';
  return Promise.resolve(
    new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Range': `${range}/${count}` },
    }),
  );
}

function requestUrl(input: RequestInfo | URL): URL {
  return new URL(input instanceof Request ? input.url : input);
}

function testClient(fetch: typeof globalThis.fetch) {
  return createClient<Database>(baseUrl, 'sb_publishable_synthetic_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
}

describe('JSON export', () => {
  it('keeps paging past the API row cap using stable keys and the number of returned rows', async () => {
    const records = Array.from({ length: 1101 }, (_, index) => ({
      id: String(index).padStart(4, '0'),
    }));
    const offsets: number[] = [];
    const fetchPage = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url.pathname.endsWith('/household_members')) {
        expect(url.searchParams.get('order')).toBe('household_id.asc,user_id.asc');
      }
      if (url.pathname.endsWith('/foods')) {
        expect(url.searchParams.get('owner_user_id')).toBe('not.is.null');
      }
      if (!url.pathname.endsWith('/meal_items')) return jsonPage([], 0, 0);

      expect(url.searchParams.get('order')).toBe('id.asc');
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      offsets.push(offset);
      return jsonPage(records.slice(offset, offset + Math.min(limit, 300)), offset, records.length);
    });

    const result = await exportMyData(testClient(fetchPage));
    expect(result.format).toBe('together-export');
    expect(result.version).toBe(1);
    expect(result.tables.meal_items).toEqual(records);
    expect(offsets).toEqual([0, 300, 600, 900]);
  });

  it('rejects a partial export if the count changes before the next page', async () => {
    const fetchPage = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (!url.pathname.endsWith('/meal_items')) return jsonPage([], 0, 0);
      const offset = Number(url.searchParams.get('offset'));
      return offset === 0 ? jsonPage([{ id: '1' }], 0, 2) : jsonPage([], 1, 1);
    });

    await expect(exportMyData(testClient(fetchPage))).rejects.toMatchObject({ kind: 'conflict' });
  });
});
