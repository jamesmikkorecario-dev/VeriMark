import AxeBuilder from '@axe-core/playwright';
import { settleFiniteMotion } from './motion-helpers';
import { expect, test } from '@playwright/test';

test('public and workspace responsive accessibility and screenshots', async ({ page }, testInfo) => {
  for (const route of ['/', '/workspace']) {
    await page.goto(route);
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

test('direct deferred routes, links and history', async ({ page }) => {
  await page.goto('/workspace/records');
  await expect(page).toHaveTitle(/Unavailable in M1/);
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('main')).toContainText(/unavailable|not available/i);
  await page.locator('main a[href="/workspace"]').first().click();
  await expect(page).toHaveURL('/workspace');
  await page.goBack();
  await expect(page).toHaveURL('/workspace/records');
  await page.goForward();
  await expect(page).toHaveURL('/workspace');
  await page.goto('/preview/verify');
  await expect(page).toHaveTitle(/Unavailable in M1/);
  await page.reload();
  await expect(page.getByRole('main')).toBeFocused();
  await page.goto('/unknown');
  await expect(page).toHaveTitle(/Page not found/);
});

test('keyboard traversal, skip contrast and menu Escape restoration', async ({ page }) => {
  for (const route of ['/', '/workspace']) {
    await page.goto(route);
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
      if (route === '/workspace') {
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

test('workspace filtering, empty state and reset', async ({ page }) => {
  await page.goto('/workspace');
  const search = page.getByRole('textbox', { name: /search/i });
  await search.fill('no-matching-fictional-record-987654');
  await expect(page.getByRole('main')).toContainText(/no .*found|no .*match|no results/i);
  const reset = page.getByRole('button', { name: 'Reset filters', exact: true });
  await reset.click();
  await expect(search).toHaveValue('');
  const filter = page.getByRole('combobox');
  await filter.selectOption('revoked');
  const rows = page.locator('.record-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByText('Revoked', { exact: true })).toBeVisible();
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
  const closing = page.getByRole('link', { name: 'Explore demo workspace', exact: true });
  await closing.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  const previousY = await page.evaluate(() => scrollY);
  await closing.click();
  await expect(page).toHaveURL('/workspace');
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expect(closing).toBeInViewport();
  await expect.poll(() => page.evaluate(target => Math.abs(scrollY - target), previousY)).toBeLessThan(3);
  await page.getByRole('link', { name: 'For verifiers', exact: true }).click();
  await expect(page).toHaveURL('/preview/verify');
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});


