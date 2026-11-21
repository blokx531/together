import { expect, test } from '@playwright/test';

test('serves an installable manifest with icons', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    name: string;
    display: string;
    icons: { src: string; purpose: string }[];
  };
  expect(manifest).toMatchObject({ name: 'Together', display: 'standalone' });
  expect(manifest.icons.map((icon) => icon.purpose)).toContain('maskable');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test('starts offline after the first visit (app shell only, no personal data cached)', async ({
  page,
  context,
}) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload once so the page is controlled by the service worker.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(cachedUrls.length).toBeGreaterThan(0);
  expect(cachedUrls.every((url) => url.startsWith('http://127.0.0.1:4173/'))).toBe(true);
  await context.setOffline(false);
});
