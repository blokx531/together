import { expect, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export const PASSWORD = 'correct-horse-battery';

export function uniqueEmail(name: string): string {
  return `${name.toLowerCase()}-${randomUUID()}@example.test`;
}

export async function signUp(page: Page, name: string, email = uniqueEmail(name)): Promise<string> {
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  return email;
}

export async function signUpFresh(page: Page, name: string): Promise<string> {
  await page.goto('/sign-up');
  return signUp(page, name);
}

export async function createSpace(page: Page, name = 'Our home'): Promise<void> {
  await page.getByLabel('Name of your shared space').fill(name);
  await page.getByRole('button', { name: 'Create our space' }).click();
}

/** Creates an invite link from the Home screen and returns it. */
export async function createInviteLink(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Create invite link' }).click();
  const link = page.locator('output').filter({ hasText: '/join#t=' });
  await expect(link).toBeVisible();
  return (await link.textContent())?.trim() ?? '';
}

export interface PairedPages {
  a: Page;
  b: Page;
}

/** Two independent browser contexts (two people), paired into one shared space. */
export async function pairTwoPeople(browser: Browser): Promise<PairedPages> {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await signUpFresh(a, 'Asha');
  await createSpace(a);
  const link = await createInviteLink(a);
  await b.goto(link);
  await signUp(b, 'Bilal');
  await b.getByRole('button', { name: 'Join Our home' }).click();
  await expect(b.getByRole('heading', { name: /Bilal/ })).toBeVisible();
  return { a, b };
}
