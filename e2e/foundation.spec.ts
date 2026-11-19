import AxeBuilder from '@axe-core/playwright';
import { DEMO_PUBLIC_IDS, openDemo } from './app-helpers';
import { settleFiniteMotion } from './motion-helpers';
import { expect, test, type Page } from '@playwright/test';

/** `/` is the public site; `/app` is the issuer application, entered through the one-click demo. */
async function visit(page: Page, route: '/' | '/app') {
  if (route === '/') await page.goto('/');
  else await openDemo(page);
}

test('public and workspace responsive accessibility and screenshots', async ({ page }, testInfo) => {
  for (const route of ['/', '/app'] as const) {
    await visit(page, route);
    await expect(page.getByRole('main')).toBeFocused();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await settleFiniteMotion(page);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await testInfo.attach(route === '/' ? 'landing-axe' : 'workspace-axe', { body: JSON.stringify(audit.violations, null, 2), contentType: 'application/json' });
    expect.soft(audit.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(route === '/' ? 'landing.png' : 'workspace.png'), fullPage: true });
  }
});

test('retired prototype routes redirect to the working product, replacing history', async ({ page }) => {
  // Demo mode: the old workspace is the one-click demo.
  await page.goto('/workspace');
  await expect(page).toHaveURL('/app');
  await expect(page).toHaveTitle('Overview | VeriMark workspace');
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  for (const [section, target] of [
    ['records', '/app/credentials'], ['credentials', '/app/credentials'], ['issue', '/app/issue'], ['templates', '/app/templates'],
    ['activity', '/app/activity'], ['settings', '/app/organization'], ['organization', '/app/organization'], ['record', '/app'], ['whatever', '/app'],
  ]) {
    await page.goto(`/workspace/${section}`);
    await expect(page).toHaveURL(target);
    await expect(page.getByRole('main')).toBeFocused();
  }
  await page.goto('/preview/record');
  await expect(page).toHaveURL(`/verify/${DEMO_PUBLIC_IDS.valid}`);
  await expect(page.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
  await page.goto('/preview/verify');
  await expect(page).toHaveURL('/verify');
  await expect(page).toHaveTitle(/Verify a record/);
  await page.goto('/preview/about');
  await expect(page).toHaveURL('/#method');
  await expect(page.locator('#method')).toBeFocused();
  for (const stale of ['/preview/how', '/preview/anything', '/preview']) {
    await page.goto(stale);
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle(/Achievement, on the record/);
  }
  // A redirect replaces the retired entry, so Back never returns to it.
  await page.goto('/');
  await page.goto('/workspace/issue');
  await expect(page).toHaveURL('/app/issue');
  await page.goBack();
  await expect(page).toHaveURL('/');
  await page.reload();
  await expect(page.getByRole('main')).toBeFocused();
  await page.goto('/unknown');
  await expect(page).toHaveTitle(/Page not found/);
});

test('keyboard traversal, skip contrast and menu Escape restoration', async ({ page }) => {
  for (const route of ['/', '/app'] as const) {
    await visit(page, route);
    await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    const audit = await new AxeBuilder({ page }).include('.skip-link').analyze();
    expect.soft(audit.violations).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await page.evaluate(() => document.body.focus());
    const menu = page.getByRole('button', { name: /menu|navigation/i }).first();
    if (await menu.isVisible()) {
      for (let step = 0; step < 15; step++) {
        await page.keyboard.press('Tab');
        if (await menu.evaluate(element => element === document.activeElement)) break;
      }
      await expect(menu).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      const controlled = await menu.getAttribute('aria-controls');
      expect(controlled).toBeTruthy();
      const navigation = page.locator('[id="' + controlled + '"]');
      if (route === '/app') {
        await expect(page.getByRole('dialog', { name: 'Workspace navigation', exact: true })).toBeVisible();
        await expect(navigation.getByRole('button', { name: 'Close workspace navigation' })).toBeFocused();
      } else {
        await expect(navigation.getByRole('link').first()).toBeFocused();
      }
      await page.keyboard.press('Escape');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).toBeFocused();
    } else {
      expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
    }
  }
});

test('reduced motion leaves content accessible without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const moving = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations === Infinity).length);
  expect(moving).toBe(0);
  const durations = await page.getByRole('main').evaluate(main => [main, ...main.querySelectorAll('*')].map(element => {
    const style = getComputedStyle(element);
    return [...style.animationDuration.split(','), ...style.transitionDuration.split(',')].map(value => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000));
  }).flat());
  expect(Math.max(...durations)).toBeLessThanOrEqual(1);
});

test('deep landing CTA resets scroll and back restores entry position', async ({ page }) => {
  await page.goto('/');
  const closing = page.getByRole('link', { name: 'Explore the live demo', exact: true });
  await closing.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  const previousY = await page.evaluate(() => scrollY);
  await closing.click();
  // /demo signs in and replaces itself with the workspace.
  await expect(page).toHaveURL('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(closing).toBeInViewport();
  await expect.poll(() => page.evaluate(target => Math.abs(scrollY - target), previousY)).toBeLessThan(3);
  await page.getByRole('link', { name: 'For verifiers', exact: true }).click();
  await expect(page).toHaveURL('/verify');
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});
