import { expect, type Page, type Locator } from '@playwright/test';
export { DEMO_PUBLIC_IDS } from '../src/lib/api/demo/state';
export async function login(page: Page, role = 'issuer') {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(`${role}@demo.verimark.test`);
  await page.getByLabel('Password', { exact: true }).fill('demo-password-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\/.*)?$/);
}
/** The one-click demo entry: signs in as a seeded persona (owner by default) and waits for the workspace overview to render. */
export async function openDemo(page: Page, persona?: 'owner' | 'issuer' | 'viewer' | 'admin' | 'north') {
  await page.goto(persona ? `/demo?as=${persona}` : '/demo');
  await expect(page).toHaveURL(persona === 'admin' ? '/app/review' : '/app');
  if (persona !== 'admin') await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  if (persona === undefined || persona === 'owner') await expect(page.getByText('Record counts')).toBeVisible();
}
export async function logout(page: Page) {
  if (page.viewportSize()!.width <= 800) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
}
export async function reviewSingle(page: Page) {
  await page.goto('/app/issue');
  await expect(page.getByLabel('Template', { exact: true })).toHaveValue('tpl_demo_fieldwork');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Recipient name').fill('Casey Fictional');
  await page.getByLabel('Title', { exact: true }).fill('Browser Journey Workshop');
  await page.getByLabel('Achievement', { exact: true }).fill('Completed the fictional workshop.');
  await page.getByRole('button', { name: 'Review records', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review before issuing' })).toBeVisible();
}
export async function issue(page: Page, count = 1) {
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: `Approve and issue ${count} ${count === 1 ? 'record' : 'records'}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: `${count} ${count === 1 ? 'record' : 'records'} issued`, exact: true })).toBeVisible();
}
export async function keyboardTo(page: Page, target: Locator) {
  for (let i = 0; i < 70; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}
export async function focusVisible(target: Locator) {
  expect(await target.evaluate(el => { const s = getComputedStyle(el); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; })).toBe(true);
}
