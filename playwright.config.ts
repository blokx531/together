import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { e2eBackendEnv } from './tests/localTestEnv';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PROJECT_DIR = fileURLToPath(new URL('.', import.meta.url));
const E2E_DIST = 'node_modules/.cache/together-e2e';
const backendEnv = e2eBackendEnv(loadEnv('production', PROJECT_DIR, 'VITE_'));

/**
 * End-to-end tests run the production build (`vite preview`) against the disposable local
 * Supabase stack configured in `.env.local` (see README). They never touch a hosted project.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'off',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npm run build -- --outDir ${E2E_DIST} && npm run preview -- --outDir ${E2E_DIST}`,
    cwd: PROJECT_DIR,
    env: backendEnv,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
