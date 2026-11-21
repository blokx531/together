import { expect, test } from '@playwright/test';
import {
  createInviteLink,
  createSpace,
  pairTwoPeople,
  PASSWORD,
  signUp,
  signUpFresh,
  uniqueEmail,
} from './support';

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('wrong password shows a clear error', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(uniqueEmail('nobody'));
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('That email and password do not match.');
});

test('sign up, create a space, survive reload, sign out and back in', async ({ page }) => {
  const email = await signUpFresh(page, 'Chitra');
  await createSpace(page, 'Chitra home');
  await expect(page.getByRole('heading', { name: /Chitra/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Chitra/ })).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Chitra/ })).toBeVisible();
});

test('two people pair through an invite link and see each other', async ({ browser }) => {
  const { a, b } = await pairTwoPeople(browser);
  await expect(b.getByRole('button', { name: 'Create invite link' })).toHaveCount(0);

  await a.goto('/settings');
  const shared = a.getByRole('region', { name: 'Shared space' });
  await expect(shared.getByText('Bilal')).toBeVisible();
  await expect(shared.getByText('Asha')).toBeVisible();
});

test('a used invite link cannot be reused by a third person', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await signUpFresh(a, 'Devi');
  await createSpace(a);
  const link = await createInviteLink(a);

  const b = await (await browser.newContext()).newPage();
  await b.goto(link);
  await signUp(b, 'Esha');
  await b.getByRole('button', { name: 'Join Our home' }).click();
  await expect(b.getByRole('heading', { name: /Esha/ })).toBeVisible();

  const c = await (await browser.newContext()).newPage();
  await c.goto(link);
  await signUp(c, 'Farid');
  await expect(c.getByText('This invite link is no longer valid.', { exact: false })).toBeVisible();
  await expect(c.getByRole('button', { name: /Join/ })).toHaveCount(0);
});

test('exports personal data as JSON', async ({ browser }) => {
  const { a } = await pairTwoPeople(browser);
  await a.goto('/settings');
  const downloadPromise = a.waitForEvent('download');
  await a.getByRole('button', { name: 'Export my data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^together-export-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const exported = JSON.parse(readFileSync(path, 'utf8')) as {
    format: string;
    tables: Record<string, unknown[]>;
  };
  expect(exported.format).toBe('together-export');
  expect(exported.tables.profiles).toHaveLength(2);
  expect(exported.tables.household_members).toHaveLength(2);
  expect(exported.tables.foods).toEqual([]);
});

test('a lost or expired session sends you back to sign in', async ({ browser }) => {
  const { a } = await pairTwoPeople(browser);
  await a.goto('/money');
  await expect(a.getByRole('heading', { name: 'Money' })).toBeVisible();
  // Simulate the stored session disappearing (expired refresh token, cleared storage).
  await a.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.includes('auth-token')) localStorage.removeItem(key);
  });
  await a.reload();
  await expect(a).toHaveURL(/\/sign-in$/);
});
