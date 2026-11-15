import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('public and workspace responsive accessibility and screenshots', async ({ page }, testInfo) => {
  for (const route of ['/', '/workspace']) {
    await page.goto(route);
    await expect(page.getByRole('main')).toBeFocused();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
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

test('keyboard navigation and responsive menu disclosure', async ({ page }) => {
  for (const route of ['/', '/workspace']) {
    await page.goto(route);
    await page.keyboard.press('Tab');
    const active = page.locator(':focus');
    await expect(active).toBeVisible();
    const menu = page.getByRole('button', { name: /menu|navigation/i }).first();
    if (await menu.isVisible()) {
      await menu.focus();
      await page.keyboard.press('Enter');
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      const controlled = await menu.getAttribute('aria-controls');
      expect(controlled).toBeTruthy();
      const navigation = page.locator('[id="' + controlled + '"]');
      await expect(navigation).toBeVisible();
      await navigation.getByRole('link').first().focus();
      await expect(navigation.getByRole('link').first()).toBeFocused();
      await menu.focus();
      await page.keyboard.press('Enter');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
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
  const reset = page.getByRole('button', { name: /reset|clear/i });
  await reset.click();
  await expect(search).toHaveValue('');
  const filter = page.getByRole('combobox');
  await filter.selectOption('revoked');
  await expect(page.getByRole('main')).toContainText(/revoked/i);
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
