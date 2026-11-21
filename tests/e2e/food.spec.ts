import { expect, test, type Page } from '@playwright/test';
import { pairTwoPeople } from './support';

async function logFood(
  page: Page,
  meal: string,
  search: string,
  foodButton: RegExp,
  servings = 1,
  share = false,
) {
  await page.getByRole('button', { name: `Add food to ${meal}` }).click();
  const sheet = page.getByRole('dialog', { name: 'Add food' });
  await sheet.getByRole('searchbox', { name: 'Search foods' }).fill(search);
  await sheet.getByRole('button', { name: foodButton }).first().click();
  for (let i = 1; i < servings; i += 1) await sheet.getByRole('button', { name: 'More' }).click();
  if (share) await sheet.getByText('Both', { exact: true }).click();
  await sheet.getByRole('button', { name: `Add to ${meal.toLowerCase()}` }).click();
  await expect(sheet.getByRole('searchbox', { name: 'Search foods' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
}

test('log 2 rotis + dal tadka + rice without AI; partner sees the meal and total', async ({
  browser,
}) => {
  const { a, b } = await pairTwoPeople(browser);
  await a.goto('/food');
  // "chapati" finds Roti through its alias.
  await logFood(a, 'Lunch', 'chapati', /^Roti · home-style/, 2, true);
  await logFood(a, 'Lunch', 'daal tadka', /^Dal tadka · home-style/);
  await logFood(a, 'Lunch', 'rice', /^Rice · home-style/);

  const lunch = a.getByRole('region', { name: 'Lunch' });
  await expect(lunch).toContainText('2 × 1 medium roti (40 g)');
  // 204 + 181.5 + 156 = 541.5 → shown rounded.
  await expect(lunch).toContainText('542 kcal');
  await expect(a.getByRole('region', { name: 'Energy today' })).toContainText('542 kcal');

  await b.goto('/food');
  await b.getByText('Asha', { exact: true }).click();
  await expect(b.getByRole('region', { name: 'Lunch' })).toContainText('Dal tadka');
  await expect(b.getByRole('region', { name: "Asha's day" })).toContainText('542 kcal');
});

test('editing a portion updates totals after reload; day can be marked complete', async ({
  browser,
}) => {
  const { a } = await pairTwoPeople(browser);
  await a.goto('/food');
  await logFood(a, 'Breakfast', 'poha', /^Poha · home-style/);
  const breakfast = a.getByRole('region', { name: 'Breakfast' });
  await breakfast.getByRole('button', { name: /Poha/ }).click();
  const sheet = a.getByRole('dialog', { name: 'Poha' });
  await sheet.getByRole('button', { name: 'More' }).click();
  await sheet.getByRole('button', { name: 'Save portion' }).click();
  await expect(sheet).toBeHidden();
  await a.reload();
  // 193 kcal/100 g × 140 g × 2 = 540.4
  await expect(a.getByRole('region', { name: 'Breakfast' })).toContainText('2 × 1 plate (140 g)');
  await expect(a.getByRole('region', { name: 'Breakfast' })).toContainText('540 kcal');
  await a.getByLabel('I logged everything I ate this day').check();
  await a.reload();
  await expect(a.getByLabel('I logged everything I ate this day')).toBeChecked();
});

test('private meals stay hidden from the partner', async ({ browser }) => {
  const { a, b } = await pairTwoPeople(browser);
  await a.goto('/food');
  await a.getByRole('button', { name: 'Add food to Snacks' }).click();
  const sheet = a.getByRole('dialog', { name: 'Add food' });
  await sheet.getByRole('searchbox', { name: 'Search foods' }).fill('samosa');
  await sheet.getByRole('button', { name: /^Samosa · home-style/ }).click();
  await expect(sheet.getByRole('radio', { name: 'Only me' })).toBeChecked();
  await sheet.getByRole('button', { name: 'Add to snacks' }).click();
  await sheet.getByRole('searchbox', { name: 'Search foods' }).fill('idli');
  await sheet
    .getByRole('button', { name: /^Idli · home-style/ })
    .first()
    .click();
  await expect(sheet.getByText('Visible to only you')).toBeVisible();
  await expect(sheet.getByRole('radio', { name: 'Both' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Add to snacks' }).click();
  await expect(sheet.getByRole('searchbox', { name: 'Search foods' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(a.getByRole('region', { name: 'Snacks' })).toContainText('Samosa');
  await expect(a.getByRole('region', { name: 'Snacks' })).toContainText('Idli');

  await b.goto('/food');
  await b.getByText('Asha', { exact: true }).click();
  await expect(b.getByRole('region', { name: "Asha's day" })).toContainText('0 kcal');
  await expect(b.getByText('Samosa')).toHaveCount(0);
  await expect(b.getByText('Idli')).toHaveCount(0);
});

test('weigh-ins and goals: private by default, chart updates, sharing is explicit', async ({
  browser,
}) => {
  const { a, b } = await pairTwoPeople(browser);
  await b.goto('/food/progress');
  await b.getByLabel('Starting weight (kg)').fill('75');
  await b.getByLabel('Target weight (kg)').fill('70');
  await b.getByRole('button', { name: 'Save goal' }).click();
  await expect(b.getByRole('region', { name: 'Goal' })).toContainText('from 75 kg to 70 kg');

  await b.getByLabel('Weight (kg)').fill('74.2');
  await b.getByRole('button', { name: 'Save weigh-in' }).click();
  await expect(b.getByRole('region', { name: 'Progress' })).toContainText('-0.8 kg');
  await expect(b.getByRole('img', { name: /Weight chart: 1 measured weigh-in/ })).toBeVisible();

  await a.goto('/food/progress');
  await expect(a.getByRole('region', { name: "Bilal's progress" })).toHaveCount(0);

  await b.getByText('Share with Asha').click();
  await b
    .getByRole('region', { name: 'Maintenance & targets' })
    .getByLabel('Maintenance (kcal/day)')
    .fill('2300');
  await b
    .getByRole('region', { name: 'Maintenance & targets' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect(b.getByText('Saved', { exact: true })).toBeVisible();

  await a.reload();
  await expect(a.getByRole('region', { name: "Bilal's progress" })).toContainText('-0.8 kg');
});
