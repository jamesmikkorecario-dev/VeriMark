import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const cases = [
  { route: '/', header: '.public-header', open: 'Open navigation', close: 'Close navigation', id: 'public-navigation' },
  { route: '/workspace', header: '.workspace-header', open: 'Open workspace navigation', close: 'Close workspace navigation', id: 'workspace-navigation' },
];
async function scroll(page: Page) {
  await page.evaluate(() => scrollTo(0, 650));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
}

for (const item of cases) {
  test(`${item.route} sticky header, controls, dismissal and screenshots`, async ({ page }, info) => {
    await page.goto(item.route);
    const trigger = page.getByRole('button', { name: item.open, exact: true });
    const mobile = page.viewportSize()!.width <= 800;
    await page.screenshot({ path: info.outputPath('closed.png'), fullPage: true });
    await scroll(page);
    if (!mobile) {
      await expect(trigger).toBeHidden();
      await page.screenshot({ path: info.outputPath('desktop-scrolled.png') });
      return;
    }
    await expect.poll(async () => (await page.locator(item.header).boundingBox())!.y).toBeCloseTo(0, 0);
    if (item.route === '/') expect((await page.locator('.demo-ribbon').boundingBox())!.y).toBeLessThan(0);
    await expect(trigger).toHaveAttribute('aria-controls', item.id);
    expect(await trigger.innerText()).toBe('');
    await trigger.click();
    const panel = page.locator('#' + item.id);
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    if (item.route === '/') {
      const header = (await page.locator(item.header).boundingBox())!;
      const box = (await panel.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(header.y);
      expect(box.y).toBeLessThanOrEqual(header.y + header.height + 2);
      await expect(page.getByRole('button', { name: item.close, exact: true })).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath('scrolled-open.png') });
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await info.attach('open-axe', { body: JSON.stringify(audit.violations, null, 2), contentType: 'application/json' });
    expect(audit.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await page.getByRole('button', { name: item.close, exact: true }).click();
    await expect(panel).toBeHidden();
    await trigger.click();
    await panel.getByRole('link', { name: item.route === '/' ? 'How it works' : 'Credentials', exact: true }).click();
    await expect(page).toHaveURL(item.route === '/' ? '/preview/how' : '/workspace/records');
    await expect(page.getByRole('main')).toBeFocused();
    await expect(page.locator('#' + item.id)).toBeHidden();
  });

  test(`${item.route} resize, backdrop and browser history clean up navigation`, async ({ page }) => {
    test.skip(page.viewportSize()!.width > 800, 'Mobile navigation only');
    await page.goto(item.route);
    const trigger = page.getByRole('button', { name: item.open, exact: true });
    const panel = page.locator('#' + item.id);
    await trigger.click();
    await page.mouse.click(page.viewportSize()!.width - 2, page.viewportSize()!.height - 2);
    await expect(panel).toBeHidden();
    await trigger.click();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(panel).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    await page.setViewportSize({ width: 440, height: 956 });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => { history.pushState({}, '', '?navigation-history=1'); dispatchEvent(new PopStateEvent('popstate')); });
    await trigger.click();
    await page.goBack();
    await expect(panel).toBeHidden();
    await page.goForward();
    await expect(panel).toBeHidden();
  });
}

test('workspace modal traps focus, isolates background, preserves scroll and inline styles', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 800, 'Mobile drawer only');
  await page.goto('/workspace');
  await scroll(page);
  await page.evaluate(() => { document.body.style.paddingRight = '3px'; document.body.style.overflowX = 'clip'; });
  const before = await page.evaluate(() => ({ y: scrollY, style: document.body.getAttribute('style'), x: document.querySelector('main')!.getBoundingClientRect().x, width: document.querySelector('main')!.getBoundingClientRect().width }));
  const trigger = page.getByRole('button', { name: 'Open workspace navigation', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Workspace navigation', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close workspace navigation' })).toBeFocused();
  await expect(dialog.getByText('Fieldwork Collective', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(dialog.getByRole('link', { name: 'Public website' })).toBeVisible();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press(i % 3 === 0 ? 'Shift+Tab' : 'Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.getByRole('main').evaluate(node => (node as HTMLElement).focus());
  expect(await page.getByRole('main').evaluate(node => node === document.activeElement)).toBe(false);
  await page.mouse.move(page.viewportSize()!.width - 2, page.viewportSize()!.height - 2);
  await page.mouse.wheel(0, 400);
  expect(await page.evaluate(() => scrollY)).toBe(before.y);
  expect(await page.getByRole('main').evaluate(node => node.getBoundingClientRect().x)).toBe(before.x);
  expect(await page.getByRole('main').evaluate(node => node.getBoundingClientRect().width)).toBe(before.width);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.getAttribute('style'))).toBe(before.style);
  expect(await page.evaluate(() => scrollY)).toBe(before.y);
});

test('short drawer scrolls independently with long organization and route labels under reduced motion', async ({ page }, info) => {
  test.skip(page.viewportSize()!.width > 800, 'Mobile drawer only');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 400 });
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Open workspace navigation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Workspace navigation', exact: true });
  await dialog.getByText('Fieldwork Collective', { exact: true }).evaluate(node => { node.textContent = 'International Community Education and Credential Recognition Organization'; });
  await dialog.locator('nav a').evaluateAll(nodes => nodes.forEach(node => node.append(' — Community educational credential administration')));
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  const last = dialog.getByRole('link', { name: 'Public website' });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await dialog.evaluate(node => [node, ...node.querySelectorAll('*')].some(element => element.scrollTop > 0))).toBe(true);
  const durations = await dialog.evaluate(node => [node, ...node.querySelectorAll('*')].flatMap(element => {
    const css = getComputedStyle(element);
    return [...css.transitionDuration.split(','), ...css.animationDuration.split(',')].map(value => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000));
  }));
  expect(Math.max(...durations)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('short-long-labels.png') });
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});
