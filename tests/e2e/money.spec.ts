import { expect, test, type Page } from '@playwright/test';
import { pairTwoPeople } from './support';

async function addExpense(
  page: Page,
  options: {
    amount: string;
    title: string;
    forWhom?: 'Both' | 'Just you';
    showToPartner?: boolean;
  },
) {
  await page.getByRole('button', { name: 'Add expense' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add expense' });
  await sheet.getByLabel('Amount (₹)').fill(options.amount);
  await sheet.getByLabel('What was it?').fill(options.title);
  if (options.forWhom) await sheet.getByText(options.forWhom, { exact: true }).click();
  if (options.showToPartner) await sheet.getByLabel(/Show this personal expense/).check();
  await sheet.getByRole('button', { name: 'Add expense' }).click();
  await expect(sheet).toBeHidden();
}

function balanceCard(page: Page) {
  return page.getByRole('region', { name: 'Between you two' });
}

function monthSummary(page: Page) {
  return page.getByRole('region', { name: 'Spending', exact: true });
}

test('shared ₹1,200 split equally, then settled — spending stays ₹1,200', async ({ browser }) => {
  const { a, b } = await pairTwoPeople(browser);

  await a.goto('/money');
  await expect(a.getByText('No expenses this month')).toBeVisible();
  await addExpense(a, { amount: '1200', title: 'Groceries' });
  await expect(a.getByRole('dialog')).toBeHidden();
  await expect(balanceCard(a)).toContainText('Bilal owes you');
  await expect(balanceCard(a)).toContainText('₹600');

  await b.goto('/money');
  await expect(balanceCard(b)).toContainText('You owe Asha');
  await expect(balanceCard(b)).toContainText('₹600');
  await expect(b.getByRole('button', { name: /Groceries.*You owe ₹600/ })).toBeVisible();

  await balanceCard(b).getByRole('button', { name: 'Settle up' }).click();
  const settle = b.getByRole('dialog', { name: 'Record a settlement' });
  await expect(settle.getByLabel('Amount (₹)')).toHaveValue('600');
  await settle.getByRole('button', { name: 'Record settlement' }).click();
  await expect(balanceCard(b)).toContainText('All settled up');
  await expect(monthSummary(b)).toContainText('₹1,200');

  await a.reload();
  await expect(balanceCard(a)).toContainText('All settled up');
  await expect(monthSummary(a).getByText('Total spent')).toBeVisible();
  await expect(monthSummary(a)).toContainText('₹1,200');
  await expect(a.getByRole('region', { name: 'Settlements this month' })).toContainText(
    'Bilal paid Asha',
  );
});

test('a double tap on save creates one expense', async ({ browser }) => {
  const { a } = await pairTwoPeople(browser);
  await a.goto('/money');
  await a.getByRole('button', { name: 'Add expense' }).click();
  const sheet = a.getByRole('dialog', { name: 'Add expense' });
  await sheet.getByLabel('Amount (₹)').fill('250');
  await sheet.getByLabel('What was it?').fill('Auto');
  await sheet.getByRole('button', { name: 'Add expense' }).dblclick();
  await expect(sheet).toBeHidden();
  await a.reload();
  await expect(a.getByRole('button', { name: /Auto/ })).toHaveCount(1);
  await expect(monthSummary(a)).toContainText('1 expense');
});

test('private personal expenses stay private and editing recomputes the balance', async ({
  browser,
}) => {
  const { a, b } = await pairTwoPeople(browser);
  await a.goto('/money');
  await addExpense(a, { amount: '450', title: 'Haircut', forWhom: 'Just you' });
  await addExpense(a, { amount: '1000', title: 'Dinner' });
  await expect(balanceCard(a)).toContainText('₹500');

  await b.goto('/money');
  await expect(b.getByRole('button', { name: /Dinner/ })).toBeVisible();
  await expect(b.getByRole('button', { name: /Haircut/ })).toHaveCount(0);

  await b.getByRole('button', { name: /Dinner/ }).click();
  const sheet = b.getByRole('dialog', { name: 'Edit expense' });
  await sheet.getByLabel('Amount (₹)').fill('1500');
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await expect(sheet).toBeHidden();
  await expect(balanceCard(b)).toContainText('You owe Asha');
  await expect(balanceCard(b)).toContainText('₹750');

  await a.reload();
  await expect(balanceCard(a)).toContainText('₹750');
});

test('invalid amounts are explained, not saved', async ({ browser }) => {
  const { a } = await pairTwoPeople(browser);
  await a.goto('/money');
  await a.getByRole('button', { name: 'Add expense' }).click();
  const sheet = a.getByRole('dialog', { name: 'Add expense' });
  await sheet.getByLabel('Amount (₹)').fill('12.345');
  await sheet.getByRole('button', { name: 'Add expense' }).click();
  await expect(sheet.getByText('Enter an amount like 250 or 99.50.')).toBeVisible();
  await expect(sheet).toBeVisible();
});
