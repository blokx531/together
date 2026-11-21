import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Integration tests talk to a disposable local Supabase stack (`npm run db:start`), never production.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/globalSetup.ts'],
    // Tests share one database; run files sequentially to keep fixtures independent and readable.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
