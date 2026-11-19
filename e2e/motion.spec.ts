import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openDemo } from './app-helpers';

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
  return page.locator(selector).first().evaluate(element => {
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
for (const route of ['/', '/app']) {
  test(`${route} temporal entrance, refresh replay and live reduction`, async ({ page }, info) => {
    await instrument(page);
    if (route === '/app') await openDemo(page);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const selector = route === '/' ? '[data-motion=hero] > :first-child' : '.fsc-page';
    const stagedSelector = route === '/' ? '[data-motion=credential]' : '.fsc-page';
    const stagedStart = await sample(page, stagedSelector);
    const timeline = [await sample(page, selector)];
    await page.screenshot({ path: info.outputPath('entrance-start.png') });
    await page.waitForTimeout(100); // Deliberate temporal sample, not a settling workaround.
    await page.screenshot({ path: info.outputPath('entrance-middle.png') });
    timeline.push(await sample(page, selector));
    await settle(page);
    timeline.push(await sample(page, selector));
    await page.screenshot({ path: info.outputPath('entrance-settled.png') });
    const evidence = await page.evaluate(() => (window as unknown as { motionEvidence: { events: {event:string}[]; defaultReduced:boolean; shifts:number[] } }).motionEvidence);
    await writeFile(info.outputPath('timeline.json'), JSON.stringify({ route, timeline, stagedStart, evidence }, null, 2));
    await info.attach('timeline.json', { body: JSON.stringify({ route, timeline, stagedStart, evidence }, null, 2), contentType: 'application/json' });
    expect(evidence.defaultReduced).toBe(false);
    expect(evidence.events.filter(e => e.event === 'animationstart').length).toBeGreaterThan(0);
    expect(stagedStart.animations.some(a => a.state === 'running')).toBe(true);
    expect(timeline[0].animations.length).toBeGreaterThan(0);
    expect(timeline[0].transform).not.toBe(timeline[2].transform);
    expect(timeline[0].animations.map(a => a.time)).not.toEqual(timeline[1].animations.map(a => a.time));
    expect(timeline[2].opacity).toBe('1');
    expect(timeline[2].animations.every(a => a.state === 'finished')).toBe(true);
    expect(evidence.shifts.reduce((a, b) => a + b, 0)).toBeLessThan(0.01);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
      const panel = route === '/' ? '#public-navigation' : '#workspace-navigation';
      const menuStart = await sample(page, panel);
      expect(menuStart.animations.some(a => a.state === 'running')).toBe(true);
      await page.screenshot({ path: info.outputPath('menu-open.png') });
      await settle(page);
      const menuEnd = await sample(page, panel);
      await writeFile(info.outputPath('menu-timeline.json'), JSON.stringify({ menuStart, menuEnd }, null, 2));
      await page.keyboard.press('Escape');
      await expect(page.locator(panel)).toBeHidden();
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
  await page.screenshot({ path: info.outputPath('reveal-running.png') });
  await settle(page);
  const settled = await sample(page, '.method-card');
  await page.screenshot({ path: info.outputPath('reveal-settled.png') });
  await page.evaluate(() => scrollTo(0, 0));
  await card.scrollIntoViewIfNeeded();
  const repeated = await sample(page, '.method-card');
  await writeFile(info.outputPath('reveal-timeline.json'), JSON.stringify({ running, settled, repeated }, null, 2));
  await info.attach('reveal-timeline.json', { body: JSON.stringify({ running, settled, repeated }, null, 2), contentType: 'application/json' });
  expect(running.animations.some(a => a.state === 'running')).toBe(true);
  expect(running.transform).not.toBe(settled.transform);
  expect(settled.transform).toBe('none');
  expect(repeated.animations.every(a => a.state === 'finished')).toBe(true);
  await expect(card).toHaveAttribute('data-reveal-state', 'complete');
  await openDemo(page);
  if (page.viewportSize()!.width <= 800) await page.getByRole('button', { name: 'Open workspace navigation', exact: true }).click();
  await page.getByRole('link', { name: 'Public website', exact: true }).click();
  await expect(page).toHaveURL('/');
  expect((await sample(page, '[data-motion=hero]')).animations.length).toBeGreaterThan(0);
  await expect(card).toHaveAttribute('data-reveal-state', 'pending');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-reveal-state=pending]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('[data-reveal-state=pending]')).toHaveCount(0);
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
  expect(await button.locator('svg').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openDemo(page);
  await settle(page);
  const action = page.locator('.fsc-actions .button').first();
  const idleAction = await action.evaluate(el => getComputedStyle(el).transform);
  await action.hover();
  await expect.poll(() => action.evaluate(el => getComputedStyle(el).transform)).not.toBe(idleAction);
  await settle(page);
  const hoverAction = await action.evaluate(el => getComputedStyle(el).transform);
  await page.mouse.down();
  await expect.poll(() => action.evaluate(el => getComputedStyle(el).transform)).not.toBe(hoverAction);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await action.hover();
  expect(await action.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.mouse.down();
  expect(await action.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test('reduced initial mount and unavailable observer retain all promotional content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true }); });
  await openDemo(page);
  for (const route of ['/', '/app']) {
    await page.goto(route);
    expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
    for (const selector of route === '/' ? ['.hero-content', '.hero-right', '.method-card', '.feature-copy', '.audience-grid', '.closing-section'] : ['.fsc-page', '.fsc-metric', '.fsc-panel']) {
      for (const element of await page.locator(selector).all()) expect(await element.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
    }
  }
});









for (const route of ['/', '/app']) {
  test(`${route} coordinated entrance delays survive the stylesheet cascade`, async ({ page }, info) => {
    if (route === '/app') await openDemo(page);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    // The overview enters as one finite stage (.fsc-page); the landing page stages its credential after the hero.
    const selector = route === '/' ? '[data-motion=credential]' : '.fsc-page';
    await page.locator(selector).first().waitFor();
    // Read actual Chrome cascade and active Web Animations timing together, before settling.
    const stages = await page.locator(selector).evaluateAll(elements => elements.map(element => {
      const css = getComputedStyle(element);
      return {
        target: element.getAttribute('data-motion'),
        delayMs: parseFloat(css.animationDelay) * (css.animationDelay.endsWith('ms') ? 1 : 1000),
        animations: element.getAnimations().map(animation => ({
          delay: animation.effect?.getTiming().delay,
          duration: animation.effect?.getTiming().duration,
          currentTime: animation.currentTime,
          state: animation.playState,
        })),
      };
    }));
    await writeFile(info.outputPath('coordination.json'), JSON.stringify({ route, stages }, null, 2));
    await info.attach('coordination.json', { body: JSON.stringify({ route, stages }, null, 2), contentType: 'application/json' });
    const expectedDelays = route === '/' ? [100] : [0];
    expect(stages.map(stage => stage.delayMs)).toEqual(expectedDelays);
    expect(stages.map(stage => stage.animations[0]?.delay)).toEqual(expectedDelays);
    expect(stages.every(stage => stage.animations[0]?.duration === 480)).toBe(true);
    await settle(page);
    expect(await page.locator(selector).evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === '1'))).toBe(true);
  });
}
