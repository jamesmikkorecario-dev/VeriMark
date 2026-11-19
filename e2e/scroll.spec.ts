import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { settleFiniteMotion } from './motion-helpers';

test.use({ video: 'on', trace: 'on' });
async function sample(page: Page) {
  return page.evaluate(() => ({ t: performance.now(), y: scrollY, top: document.querySelector('#method')?.getBoundingClientRect().top, header: document.querySelector('.public-header')?.getBoundingClientRect().height, focus: document.activeElement?.id }));
}
async function aligned(page: Page) {
  await expect.poll(async () => { const s = await sample(page); return Math.abs(s.top! - s.header! - 16); }).toBeLessThan(2);
  await expect(page.locator('#method')).toBeFocused();
}
async function start(page: Page) {
  await page.goto('/');
  await settleFiniteMotion(page);
}
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`anchor temporal ${reducedMotion}, measured header, keyboard and repeated hash`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion });
    await start(page);
    const link = page.getByRole('link', { name: 'See how it works', exact: true });
    await link.focus();
    await page.keyboard.press('Enter');
    // Focus marks the React layout-effect commit; instant scroll completes in that same effect.
    await expect(page.locator('#method')).toBeFocused();
    const frames = [await sample(page)];
    await page.screenshot({ path: info.outputPath('anchor-start.png') });
    await page.waitForTimeout(90);
    frames.push(await sample(page));
    await page.screenshot({ path: info.outputPath('anchor-middle.png') });
    await aligned(page);
    frames.push(await sample(page));
    await page.screenshot({ path: info.outputPath('anchor-end.png') });
    await writeFile(info.outputPath('scroll-timeline.json'), JSON.stringify(frames, null, 2));
    if (reducedMotion === 'no-preference') {
      expect(frames[0].y).toBeLessThan(frames[2].y - 10);
      expect(frames[1].y).toBeGreaterThan(frames[0].y);
    } else expect(Math.abs(frames[0].y - frames[2].y)).toBeLessThan(2);
    expect(await page.locator('.demo-ribbon').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThan(0);
    // Footer link preserves the current hash and must still perform explicit navigation.
    await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'How it works' }).click();
    await aligned(page);
    expect(await page.locator('#method').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  });
}

test('direct and cross-route hash arrive instantly; POP restores saved positions', async ({ page }, info) => {
  await page.goto('/#method');
  const direct = [await sample(page)];
  expect(Math.abs(direct[0].top! - direct[0].header! - 16)).toBeLessThan(2);
  await aligned(page);
  await page.waitForTimeout(100);
  direct.push(await sample(page));
  expect(Math.abs(direct[0].y - direct[1].y)).toBeLessThan(2);
  await page.goto('/verify');
  await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'How it works' }).click();
  await aligned(page);
  direct.push(await sample(page));
  expect(Math.abs(direct[2].top! - direct[2].header! - 16)).toBeLessThan(2);
  await page.evaluate(() => scrollTo(0, 700));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(700);
  // Allow the browser scroll event to record this history entry before leaving.
  await page.waitForTimeout(80);
  await page.locator('.public-header').getByRole('link', { name: 'VeriMark', exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  expect(await page.evaluate(() => scrollY)).toBe(700);
  await page.goForward();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await writeFile(info.outputPath('instant-timeline.json'), JSON.stringify(direct, null, 2));
});

test('active anchor finishes on live reduction and resize; native wheel clears stale intent', async ({ page }, info) => {
  await start(page);
  const link = page.getByRole('link', { name: 'See how it works', exact: true });
  await link.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await aligned(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => scrollTo(0, 0));
  await link.click();
  await page.setViewportSize({ width: page.viewportSize()!.width === 390 ? 440 : 390, height: 956 });
  await aligned(page);
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(10, 700);
  await page.mouse.wheel(0, 260);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
  await page.waitForTimeout(200);
  const manual = await page.evaluate(() => scrollY);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 768, height: 956 });
  await page.waitForTimeout(150);
  expect(Math.abs(await page.evaluate(() => scrollY) - manual)).toBeLessThan(2);
  await writeFile(info.outputPath('native-scroll.json'), JSON.stringify({ before, manual, after: await sample(page) }, null, 2));
});

test('manual interruption during anchor clears intent before reduction or resize', async ({ page }, info) => {
  await start(page);
  await page.getByRole('link', { name: 'See how it works', exact: true }).click();
  await page.waitForTimeout(60);
  const active = await sample(page);
  expect(active.y).toBeLessThan(1000);
  await page.mouse.move(10, 700);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(900); // Native browser cancellation/settling, not application smooth completion.
  const manual = await sample(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const reduced = await sample(page);
  expect(Math.abs(reduced.y - manual.y)).toBeLessThan(2);
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 850 });
  await page.waitForTimeout(100);
  expect(Math.abs(await page.evaluate(() => scrollY) - manual.y)).toBeLessThan(2);
  await writeFile(info.outputPath('interrupted-timeline.json'), JSON.stringify({ active, manual, reduced }, null, 2));
});

test('implemented route entry replays finite visible entrance with immediate focus; placeholders stay basic', async ({ page }, info) => {
  await start(page);
  const samples = [];
  for (let i = 0; i < 2; i++) {
    await page.getByRole('link', { name: 'Explore the live demo', exact: true }).click();
    await expect(page).toHaveURL('/app');
    await expect(page.getByRole('main')).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    const entry = await page.locator('.fsc-page').evaluate(el => ({
      opacity: Number(getComputedStyle(el).opacity),
      animations: el.getAnimations().map(a => ({ state: a.playState, duration: a.effect?.getTiming().duration })),
    }));
    expect(entry.opacity).toBeGreaterThan(0);
    expect(entry.animations.some(a => a.state === 'running' && a.duration === 480)).toBe(true);
    samples.push(entry);
    await page.screenshot({ path: info.outputPath(`workspace-entry-${i}.png`) });
    await settleFiniteMotion(page);
    if (page.viewportSize()!.width <= 800) await page.getByRole('button', { name: 'Open workspace navigation', exact: true }).click();
    await page.getByRole('link', { name: 'Public website', exact: true }).click();
    await expect(page.getByRole('main')).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await page.locator('[data-motion=hero]').evaluate(el => el.getAnimations({ subtree: true }).some(a => a.playState === 'running'))).toBe(true);
    await settleFiniteMotion(page);
  }
  await page.getByRole('main').getByRole('link', { name: 'Verify a record', exact: true }).click();
  await expect(page.getByRole('main')).toBeFocused();
  expect(await page.locator('[data-motion]').count()).toBe(0);
  expect(await page.getByRole('main').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a instanceof CSSAnimation).length)).toBe(0);
  await page.goto('/missing-route');
  await expect(page.getByRole('main')).toBeFocused();
  expect(await page.getByRole('main').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a instanceof CSSAnimation).length)).toBe(0);
  await writeFile(info.outputPath('entry-replay.json'), JSON.stringify(samples, null, 2));
});
