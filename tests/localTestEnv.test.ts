import { describe, expect, it } from 'vitest';
import { assertLocalTestUrl, e2eBackendEnv } from './localTestEnv';

const publishableKey = 'sb_publishable_synthetic_test';

describe('disposable browser-test backend', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321'])(
    'passes configured loopback endpoint %s to the build',
    (url) => {
      expect(
        e2eBackendEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey }),
      ).toEqual({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey });
    },
  );

  it.each([
    'https://example.supabase.co',
    'https://localhost.example.test',
    'http://localhost@remote.test',
  ])('rejects non-local endpoint %s', (url) => {
    expect(() =>
      e2eBackendEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey }),
    ).toThrow('VITE_SUPABASE_URL must point to the disposable local Supabase stack.');
  });

  it('rejects missing backend settings before starting a browser', () => {
    expect(() => e2eBackendEnv({})).toThrow('Configure the local Supabase stack');
  });

  it('uses the actual database host for the integration suite', () => {
    expect(() => {
      assertLocalTestUrl('postgresql://test:test@127.0.0.1:54322/postgres', 'DB_URL', [
        'postgresql:',
      ]);
    }).not.toThrow();
    expect(() => {
      assertLocalTestUrl('postgresql://localhost@remote.test/postgres', 'DB_URL', ['postgresql:']);
    }).toThrow('DB_URL');
  });
});
