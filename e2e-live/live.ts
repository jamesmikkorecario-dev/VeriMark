import { test as base, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import type { TestPersona } from '../supabase/hosted/fixtures';

export interface LiveState {
  target: 'demo' | 'hosted'; password: string; mainOrg: string; otherOrg: string;
  emails: Record<TestPersona, string>; seed: { id: string; publicId: string };
  /** Name the invitee account is listed under on the members page. */
  inviteeName: string;
  storage: Record<TestPersona, { cookies: never[]; origins: { origin: string; localStorage: { name: string; value: string }[] }[] }> | null;
}
export const live: LiveState = JSON.parse(process.env.LIVE_STATE ?? 'null') as LiveState;
/** Makes every fictional name of this run unique, so repeated runs against a persistent database never collide. */
export const RUN = Date.now().toString(36).slice(-6);
export const fictional = (name: string) => `${name} ${RUN}`;
const mobile = (page: Page) => page.viewportSize()!.width <= 800;

export async function signInWithForm(page: Page, persona: TestPersona, password = live.password) {
  await page.getByLabel('Email address').fill(live.emails[persona]);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
export async function signOut(page: Page) {
  if (mobile(page)) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
}

/**
 * Hands out pages for personas. Hosted: each persona gets its own browser context that starts signed in (a real second
 * browser). Demonstration: its data lives in one tab, so the same page signs out and in again.
 */
export class Stage {
  private readonly contexts: BrowserContext[] = [];
  private current: { page: Page; persona: TestPersona | null } | null = null;
  constructor(private readonly browser: Browser, private readonly demoPage: Page, private readonly baseURL: string) {}
  async as(persona: TestPersona): Promise<Page> {
    if (live.target === 'hosted') {
      const context = await this.browser.newContext({ baseURL: this.baseURL, storageState: live.storage![persona], viewport: this.demoPage.viewportSize()!, acceptDownloads: true });
      this.contexts.push(context);
      const page = await context.newPage(); await page.goto('/app');
      await expect(page).toHaveURL(/\/app(?:\/.*)?$/);
      return page;
    }
    const page = this.demoPage;
    if (this.current?.persona) { await page.goto('/app'); await signOut(page); }
    await page.goto('/sign-in'); await signInWithForm(page, persona);
    await expect(page).toHaveURL(/\/app(?:\/.*)?$/);
    this.current = { page, persona };
    return page;
  }
  /** A visitor with no session. Hosted: a fresh browser context. Demonstration: the same tab, signed out. */
  async anonymous(): Promise<Page> {
    if (live.target === 'hosted') {
      const context = await this.browser.newContext({ baseURL: this.baseURL, viewport: this.demoPage.viewportSize()!, acceptDownloads: true });
      this.contexts.push(context);
      return context.newPage();
    }
    if (this.current?.persona) { await this.demoPage.goto('/app'); await signOut(this.demoPage); this.current = { page: this.demoPage, persona: null }; }
    return this.demoPage;
  }
  async close() { for (const context of this.contexts) await context.close(); }
}
export const test = base.extend<{ stage: Stage }>({
  stage: async ({ browser, page, baseURL }, provide) => { const stage = new Stage(browser, page, baseURL!); await provide(stage); await stage.close(); },
});
export { expect };

export async function ready(page: Page, route: string) {
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Loading|Checking record|Opening your record)/)).toHaveCount(0);
  // The issue page is ready when it offers the first step, or explains why this member cannot issue.
  if (route === '/app/issue') await expect(page.getByRole('button', { name: 'Continue', exact: true }).or(page.getByRole('heading', { name: 'Issuing is not available for your role' }))).toBeVisible();
}
export async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
  });
}
export async function reviewSingle(page: Page, recipient: string, title = 'Live Journey Workshop') {
  await ready(page, '/app/issue');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Recipient name').fill(recipient);
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Achievement', { exact: true }).fill('Completed the fictional workshop.');
  await page.getByRole('button', { name: 'Review records', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review before issuing' })).toBeVisible();
}
export async function approveAndIssue(page: Page, count = 1) {
  const noun = count === 1 ? 'record' : 'records';
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: `Approve and issue ${count} ${noun}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: `${count} ${noun} issued`, exact: true })).toBeVisible();
}
/** Issues one record through the interface and opens it. Returns where it lives. */
export async function issueAndOpen(page: Page, recipient: string, title?: string) {
  await reviewSingle(page, recipient, title); await approveAndIssue(page);
  await page.getByRole('link', { name: `Open record for ${recipient}` }).click();
  await expect(page.getByRole('heading', { name: recipient, exact: true })).toBeVisible();
  const verifyUrl = await page.getByLabel('Verification link', { exact: true }).inputValue();
  return { detailPath: new URL(page.url()).pathname, verifyPath: new URL(verifyUrl).pathname };
}
export async function keyboardTo(page: Page, target: Locator) {
  for (let i = 0; i < 80; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}
export async function expectFocusVisible(target: Locator) {
  expect(await target.evaluate(el => { const s = getComputedStyle(el); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; })).toBe(true);
}
export const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
/** In hosted mode nothing may be labelled a demonstration; in the rehearsal everything must be. */
export async function expectModeLabel(page: Page) {
  const labels = page.getByText(/demonstration/i);
  if (live.target === 'hosted') await expect(labels).toHaveCount(0); else await expect(labels.first()).toBeVisible();
}
