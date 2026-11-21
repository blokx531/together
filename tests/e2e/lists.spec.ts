import { expect, test, type Page } from '@playwright/test';
import { pairTwoPeople } from './support';

async function createList(
  page: Page,
  options: { type: string; name: string; privateList?: boolean },
) {
  await page.goto('/lists');
  await page.getByRole('button', { name: 'New list' }).click();
  const sheet = page.getByRole('dialog', { name: 'New list' });
  await sheet.locator('label').filter({ hasText: options.type }).click();
  await expect(sheet.getByRole('radio', { name: new RegExp(`^${options.type}`) })).toBeChecked();
  await sheet.getByLabel('Name').fill(options.name);
  if (options.privateList) await sheet.getByText('Just me').click();
  await sheet.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('heading', { name: options.name })).toBeVisible();
}

async function addItem(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'New item' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'New item' })).toHaveValue('');
}

test('both partners add and tick shared grocery items; state survives reloads', async ({
  browser,
}) => {
  const { a, b } = await pairTwoPeople(browser);
  await createList(a, { type: 'Groceries', name: 'Weekly groceries' });
  await addItem(a, 'Atta 5 kg');
  await addItem(a, 'Milk');
  await expect(a.getByRole('button', { name: /Atta.*5 kg/ })).toBeVisible();

  await b.goto('/lists');
  await b.getByRole('link', { name: /Weekly groceries/ }).click();
  await addItem(b, 'Eggs 12');
  // Ticking moves the item into the collapsed "Done" section.
  await b.getByRole('checkbox', { name: 'Mark done: Milk' }).click();
  await b.getByText('Done (1)').click();
  await expect(b.getByRole('checkbox', { name: 'Mark not done: Milk' })).toBeChecked();

  await a.reload();
  await expect(a.getByRole('button', { name: /Eggs.*12/ })).toBeVisible();
  await a.getByText('Done (1)').click();
  await expect(a.getByRole('checkbox', { name: 'Mark not done: Milk' })).toBeChecked();
  await a.getByRole('checkbox', { name: 'Mark done: Atta' }).click();
  await expect(a.getByText('Done (2)')).toBeVisible();

  await b.reload();
  await b.getByText('Done (2)').click();
  await expect(b.getByRole('checkbox', { name: 'Mark not done: Atta' })).toBeChecked();
  await expect(b.getByRole('checkbox', { name: 'Mark done: Eggs' })).not.toBeChecked();
});

test('a private list never shows up for the partner', async ({ browser }) => {
  const { a, b } = await pairTwoPeople(browser);
  await createList(a, { type: 'Ideas', name: 'Gift ideas', privateList: true });
  await addItem(a, 'Pottery class');
  await b.goto('/lists');
  await expect(b.getByText('No lists yet')).toBeVisible();
  await b.getByRole('searchbox', { name: 'Search all lists' }).fill('Pottery');
  await expect(b.getByText('No items match “Pottery”.')).toBeVisible();
});

test("a stale edit is refused instead of overwriting the partner's change", async ({ browser }) => {
  const { a, b } = await pairTwoPeople(browser);
  await createList(a, { type: 'To-do', name: 'House' });
  await addItem(a, 'Call plumber');
  const listUrl = a.url();

  await b.goto(listUrl);
  await b.getByRole('button', { name: 'Call plumber' }).click();
  const bSheet = b.getByRole('dialog', { name: 'Edit item' });
  await expect(bSheet.getByLabel('Item')).toHaveValue('Call plumber');

  await a.getByRole('button', { name: 'Call plumber' }).click();
  const aSheet = a.getByRole('dialog', { name: 'Edit item' });
  await aSheet.getByLabel('Item').fill('Call plumber before 5pm');
  await aSheet.getByRole('button', { name: 'Save' }).click();
  await expect(aSheet).toBeHidden();

  await bSheet.getByLabel('Item').fill('Call electrician');
  await bSheet.getByRole('button', { name: 'Save' }).click();
  await expect(bSheet.getByRole('alert')).toContainText('Someone changed this item');
  await expect(b.getByRole('button', { name: 'Call plumber before 5pm' })).toBeVisible();
});
