import { expect, test, type Page } from '@playwright/test';

// Reproduce: $env:PLAYWRIGHT_CHANNEL='chrome'; npx playwright test e2e/motion.spec.ts --project=chromium-1440 --project=chromium-390 --workers=1
// Video, trace, sampled frames and timeline.json are emitted in test-results.
test.use({ video: 'on', trace: 'on' });
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const evidence = { defaultReduced: matchMedia('(prefers-reduced-motion: reduce)').matches, events: [] as unknown[], shifts: [] as number[] };
    Object.assign(window, { motionEvidence: evidence });
    for (const name of ['animationstart', 'animationend', 'animationcancel', 'transitionrun', 'transitionend']) {
      document.addEventListener(name, event => {
        const target = event.target as HTMLElement;
        evidence.events.push({ event: name, time: performance.now(), target: target.className, animation: (event as AnimationEvent).animationName, property: (event as TransitionEvent).propertyName });
      }, true);
    }
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) evidence.shifts.push((entry as PerformanceEntry & { value: number }).value); }).observe({ type: 'layout-shift', buffered: true });
  });
}
async function sample(page: Page, selector: string) {
  return page.locator(selector).evaluate(element => {
    const css = getComputedStyle(element);
    return { time: performance.now(), opacity: css.opacity, transform: css.transform, animations: element.getAnimations({ subtree: true }).map(a => ({ state: a.playState, time: a.currentTime, timing: a.effect?.getComputedTiming() })) };
  });
}
async function settle(page: Page) {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map(a => a.finished.catch(() => {})));
  });
}
for (const route of ['/', '/workspace']) {
  test(`${route} temporal entrance, refresh replay and live reduction`, async ({ page }, info) => {
    await instrument(page);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const selector = route === '/' ? '.hero-content' : '.page-heading';
    const timeline = [await sample(page, selector)];
    await page.screenshot({ path: info.outputPath('entrance-start.png') });
    await page.waitForTimeout(100); // Deliberate temporal sample, not a settling workaround.
    timeline.push(await sample(page, selector));
    await settle(page);
    timeline.push(await sample(page, selector));
    await page.screenshot({ path: info.outputPath('entrance-settled.png') });
    const evidence = await page.evaluate(() => (window as unknown as { motionEvidence: { events: {event:string}[]; defaultReduced:boolean; shifts:number[] } }).motionEvidence);
    await info.attach('timeline.json', { body: JSON.stringify({ route, timeline, evidence }, null, 2), contentType: 'application/json' });
    expect(evidence.defaultReduced).toBe(false);
    expect(evidence.events.filter(e => e.event === 'animationstart').length).toBeGreaterThan(0);
    expect(timeline[0].animations.length).toBeGreaterThan(0);
    expect(timeline[0].animations.map(a => a.time)).not.toEqual(timeline[1].animations.map(a => a.time));
    expect(timeline[2].opacity).toBe('1');
    expect(timeline[2].animations.every(a => a.state === 'finished')).toBe(true);
    expect(evidence.shifts.reduce((a, b) => a + b, 0)).toBeLessThan(0.01);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (route === '/workspace') {
      await page.getByLabel('Search records').fill('Alex');
      expect((await sample(page, selector)).animations.every(a => a.state === 'finished')).toBe(true);
      await page.getByRole('button', { name: 'Reset filters' }).click();
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect((await sample(page, selector)).animations.length).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await sample(page, selector)).opacity).toBe('1');
    expect((await sample(page, selector)).animations.filter(a => a.state === 'running')).toEqual([]);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect((await sample(page, selector)).animations.length).toBeGreaterThan(0);
    await settle(page);
    if (page.viewportSize()!.width <= 800) {
      const trigger = page.getByRole('button', { name: route === '/' ? 'Open navigation' : 'Open workspace navigation', exact: true });
      await trigger.click();
      await page.screenshot({ path: info.outputPath('menu-open.png') });
      await settle(page);
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    }
  });
}

test('promotional reveal runs once, route reentry resets and no observer keeps content available', async ({ page }, info) => {
  await instrument(page);
  await page.goto('/');
  await settle(page);
  const card = page.locator('.method-card').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const running = await sample(page, '.method-card');
  await settle(page);
  const settled = await sample(page, '.method-card');
  await page.evaluate(() => scrollTo(0, 0));
  await card.scrollIntoViewIfNeeded();
  const repeated = await sample(page, '.method-card');
  await info.attach('reveal-timeline.json', { body: JSON.stringify({ running, settled, repeated }, null, 2), contentType: 'application/json' });
  expect(running.animations.some(a => a.state === 'running')).toBe(true);
  expect(repeated.animations.every(a => a.state === 'finished')).toBe(true);
  await page.goto('/workspace');
  await page.locator('a[href="/"]').first().click();
  await expect(page).toHaveURL('/');
  expect((await sample(page, '.hero-content')).animations.length).toBeGreaterThan(0);
  await page.addInitScript(() => { Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true }); });
  await page.reload();
  await settle(page);
  for (const selector of ['.hero-content', '.method-card', '.feature-copy', '.audience-grid', '.closing-section']) {
    expect(await page.locator(selector).first().evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  }
});

test('hover and press feedback changes over time and reduced mode removes it', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const button = page.locator('.hero-actions .button').first();
  const idle = await button.evaluate(el => getComputedStyle(el).transform);
  await button.hover();
  await expect.poll(() => button.evaluate(el => getComputedStyle(el).transform)).not.toBe(idle);
  await settle(page);
  const hover = await button.evaluate(el => getComputedStyle(el).transform);
  await page.mouse.down();
  await expect.poll(() => button.evaluate(el => getComputedStyle(el).transform)).not.toBe(hover);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button.hover();
  expect(await button.evaluate(el => getComputedStyle(el).transform)).toBe('none');
});

test('reduced initial mount and unavailable observer retain all promotional content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true }); });
  for (const route of ['/', '/workspace']) {
    await page.goto(route);
    expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
    for (const selector of route === '/' ? ['.hero-content', '.hero-right', '.method-card', '.feature-copy', '.audience-grid', '.closing-section'] : ['.page-heading', '.metric', '.dashboard-main']) {
      for (const element of await page.locator(selector).all()) expect(await element.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
    }
  }
});

