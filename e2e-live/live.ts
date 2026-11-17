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
  constructor(private readonly browser: Browser, private readonly demoPage: Page, private readonly baseURL: string, private readonly watch: Watch) {}
  async as(persona: TestPersona): Promise<Page> {
    if (live.target === 'hosted') {
      const context = await this.browser.newContext({ baseURL: this.baseURL, storageState: live.storage![persona], viewport: this.demoPage.viewportSize()!, acceptDownloads: true });
      this.contexts.push(context);
      const page = await context.newPage(); this.watch(page, persona); await page.goto('/app');
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
      const page = await context.newPage(); this.watch(page, 'anonymous');
      return page;
    }
    if (this.current?.persona) { await this.demoPage.goto('/app'); await signOut(this.demoPage); this.current = { page: this.demoPage, persona: null }; }
    return this.demoPage;
  }
  async close() { for (const context of this.contexts) await context.close(); }
}
/** Starts recording a page's diagnostics under a label (persona, `anonymous` or `page`). */
type Watch = (page: Page, label: string) => void;
/**
 * Failure-only diagnostics for every page a test opens (its own page and each Stage page): navigations, Auth/REST
 * responses (method, path, status — never query strings, fragments, headers or bodies), failed requests, console
 * errors and page errors. Stored as a `diagnostics` annotation only when the test fails; the hosted reporter redacts
 * it like any error text.
 */
function recordDiagnostics(page: Page, label: string, events: string[], t0: number) {
  const at = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s [${label}]`;
  const where = (url: string) => { const u = new URL(url); return u.hostname === '127.0.0.1' || u.hostname === 'localhost' ? u.pathname : `[backend]${u.pathname}`; };
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) events.push(`${at()} navigated ${where(frame.url())}`); });
  page.on('response', response => { if (/\/(auth|rest|functions)\/v1\//.test(new URL(response.url()).pathname)) events.push(`${at()} ${response.request().method()} ${where(response.url())} → ${response.status()}`); });
  page.on('requestfailed', request => { events.push(`${at()} request failed ${request.method()} ${where(request.url())}: ${request.failure()?.errorText ?? 'unknown'}`); });
  // Kept whole: the reporter truncates only after redacting, so a secret is never cut in half and missed.
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') events.push(`${at()} console.${message.type()}: ${message.text()}`); });
  page.on('pageerror', error => { events.push(`${at()} page error: ${error.message}`); });
}
export const test = base.extend<{ stage: Stage; diagnostics: Watch }>({
  diagnostics: [async ({ page }, provide, info) => {
    const events: string[] = [];
    const t0 = Date.now();
    const watch: Watch = (target, label) => recordDiagnostics(target, label, events, t0);
    watch(page, 'page');
    await provide(watch);
    if (info.status !== info.expectedStatus) info.annotations.push({ type: 'diagnostics', description: events.slice(-80).join('\n') || '(no page events recorded)' });
  }, { auto: true }],
  stage: async ({ browser, page, baseURL, diagnostics }, provide) => { const stage = new Stage(browser, page, baseURL!, diagnostics); await provide(stage); await stage.close(); },
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
