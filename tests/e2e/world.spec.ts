import { expect, test, type Page } from '@playwright/test';
import { pairTwoPeople } from './support';

async function addManualPlace(
  page: Page,
  options: { name: string; coordinates: string; wishlist?: boolean; withPartner?: boolean },
) {
  await page.getByRole('button', { name: 'Add place' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a place' });
  await sheet.getByText('Enter manually').click();
  await sheet.getByLabel('Place name').fill(options.name);
  await sheet.getByLabel('Coordinates').fill(options.coordinates);
  if (options.wishlist) {
    await sheet.getByText('Want to go').click();
    await sheet.getByRole('button', { name: 'Add to wishlist' }).click();
  } else {
    if (options.withPartner) await sheet.getByLabel('Bilal').check();
    await sheet.getByRole('button', { name: 'Stamp it' }).click();
  }
  await expect(sheet).toBeHidden();
}

function filterTo(page: Page, label: string) {
  return page.getByRole('group', { name: 'Show places' }).getByText(label, { exact: true }).click();
}

test('stamp places, open details, and filter by who went', async ({ browser }) => {
  const { a, b } = await pairTwoPeople(browser);
  await a.goto('/world');
  await expect(a.getByText('No places yet')).toBeVisible();
  await addManualPlace(a, { name: 'Jaipur', coordinates: '26.9124, 75.7873', withPartner: true });
  await addManualPlace(a, { name: 'Pune', coordinates: '18.5204, 73.8567' });
  await addManualPlace(a, { name: 'Leh', coordinates: '34.1526, 77.5771', wishlist: true });

  const places = a.getByRole('list', { name: 'Places' });
  await expect(places.getByRole('button')).toHaveCount(3);
  await filterTo(a, 'Together');
  await expect(places.getByRole('button')).toHaveCount(1);
  await expect(places).toContainText('Jaipur');
  await filterTo(a, 'Wishlist');
  await expect(places).toContainText('Leh');
  await expect(
    a.getByRole('term').filter({ hasText: 'Places visited' }).locator('..'),
  ).toContainText('0');

  await filterTo(a, 'All');
  await places.getByRole('button', { name: /Jaipur/ }).click();
  const detail = a.getByRole('dialog', { name: /Jaipur/ });
  await expect(detail).toContainText('Visited together');
  await expect(detail).toContainText('26.912, 75.787');
  await expect(detail).toContainText('Asha & Bilal');

  await b.goto('/world');
  await filterTo(b, 'Mine');
  await expect(b.getByRole('list', { name: 'Places' })).toContainText('Jaipur');
  await expect(b.getByRole('list', { name: 'Places' })).not.toContainText('Pune');
});

test('map code loads only on the World page', async ({ browser }) => {
  const { a } = await pairTwoPeople(browser);
  const scripts: string[] = [];
  a.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  for (const path of ['/', '/food', '/money', '/lists']) {
    await a.goto(path);
    await expect(a.getByRole('main')).toBeVisible();
    await a.waitForLoadState('networkidle');
  }
  expect(scripts.filter((url) => /TravelMap|maplibre/i.test(url))).toEqual([]);

  await a.goto('/world');
  await expect(a.getByRole('heading', { name: 'World' })).toBeVisible();
  await expect
    .poll(() => scripts.filter((url) => /TravelMap/i.test(url)).length)
    .toBeGreaterThan(0);
});
