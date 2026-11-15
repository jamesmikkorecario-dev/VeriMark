import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { settleFiniteMotion } from './motion-helpers';

// Guards for the reported Chrome Device Mode symptoms (iPhone 16 Pro Max 440x956):
// sideways panning and header drift. This spec sets its own mobile matrix, including
// fractional device scale factors, so it runs once rather than per width project.
const matrix = [
  { width: 320, height: 568, deviceScaleFactor: 2 },
  { width: 375, height: 812, deviceScaleFactor: 2.625 },
  { width: 390, height: 844, deviceScaleFactor: 3 },
  { width: 440, height: 956, deviceScaleFactor: 3 },
];
const publicRoutes = ['/', '/preview/verify', '/preview/about', '/missing-page'];

type Overflow = { clientWidth: number; scrollWidth: number; bodyScrollWidth: number; scrollX: number; offenders: string[] };
function overflow(page: Page) {
  return page.evaluate((): Overflow => {
    const root = document.documentElement;
    const clientWidth = root.clientWidth;
    const offenders: string[] = [];
    for (const element of document.querySelectorAll('body *')) {
      const box = element.getBoundingClientRect();
      if ((box.width || box.height) && (box.left < -0.5 || box.right > clientWidth + 0.5)) {
        offenders.push(`${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''} ${box.left.toFixed(1)}..${box.right.toFixed(1)}`);
      }
    }
    return { clientWidth, scrollWidth: root.scrollWidth, bodyScrollWidth: document.body.scrollWidth, scrollX, offenders };
  });
}
async function expectNoHorizontalOverflow(page: Page, state: string) {
  const result = await overflow(page);
  const detail = `${state}: ${JSON.stringify(result)}`;
  expect(result.scrollWidth, detail).toBeLessThanOrEqual(result.clientWidth);
  expect(result.bodyScrollWidth, detail).toBeLessThanOrEqual(result.clientWidth);
  expect(result.scrollX, detail).toBe(0);
  expect(result.offenders, detail).toEqual([]);
  // A programmatic sideways scroll must have nowhere to go.
  await page.evaluate(() => scrollTo(400, scrollY));
  expect(await page.evaluate(() => scrollX), detail).toBe(0);
}
const headerTop = (page: Page) => page.evaluate(() => document.querySelector('.public-header')!.getBoundingClientRect().top);
const ribbonHeight = (page: Page) => page.evaluate(() => document.querySelector('.demo-ribbon')!.getBoundingClientRect().height);

for (const device of matrix) {
  test.describe(`mobile ${device.width}x${device.height} @${device.deviceScaleFactor}x`, () => {
    test.use({ viewport: { width: device.width, height: device.height }, deviceScaleFactor: device.deviceScaleFactor, isMobile: true, hasTouch: true });
    test.beforeEach(({ page }, info) => {
      void page;
      test.skip(info.project.name !== 'chromium-440', 'Self-contained mobile matrix; runs once in chromium-440');
    });

    for (const route of publicRoutes) {
      test(`${route} has no document horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        await settleFiniteMotion(page);
        await expectNoHorizontalOverflow(page, 'loaded');
        // Walk the page so pending scroll reveals (translateY) run, then re-check.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += Math.round(device.height * 0.6)) {
          await page.evaluate(top => scrollTo(0, top), y);
          await expectNoHorizontalOverflow(page, `scrolled to ${y}`);
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator('button[aria-controls="public-navigation"]').click();
        await expect(page.locator('#public-navigation')).toBeVisible();
        await page.locator('#public-navigation').evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
        await expectNoHorizontalOverflow(page, 'mobile navigation open');
      });
    }

    test('/ sticky header is stable after reaching its sticky position', async ({ page }, info) => {
      await page.goto('/');
      await settleFiniteMotion(page);
      const ribbon = await ribbonHeight(page);
      expect(await headerTop(page)).toBeCloseTo(ribbon, 1);
      const samples: { phase: string; y: number; top: number }[] = [];
      const record = async (phase: string) => samples.push({ phase, y: await page.evaluate(() => scrollY), top: await headerTop(page) });
      // Expected normal-flow-to-sticky transition: the header rides up with the non-sticky ribbon.
      for (let y = 0; y <= Math.ceil(ribbon) + 10; y += 2) { await page.evaluate(top => scrollTo(0, top), y); await record('transition'); }
      for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 120); await record('down'); }
      for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, -90); await record('up'); }
      // Per-frame sampling across browser smooth scrolling (down, then up) catches transient drift.
      const frames = await page.evaluate(async () => {
        const header = document.querySelector('.public-header')!;
        const out: { phase: string; y: number; top: number }[] = [];
        const run = (phase: string, top: number) => new Promise<void>(resolve => {
          scrollTo({ top, behavior: 'smooth' });
          const start = performance.now();
          const frame = () => {
            out.push({ phase, y: scrollY, top: header.getBoundingClientRect().top });
            if (Math.abs(scrollY - top) < 1 || performance.now() - start > 3000) resolve(); else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
        await run('smooth-down', scrollY + 1800);
        await run('smooth-up', 400);
        return out;
      });
      samples.push(...frames);
      await page.evaluate(() => scrollTo(0, 0));
      await record('return-top');
      await writeFile(info.outputPath(`header-trace-${device.width}.json`), JSON.stringify({ ribbon, samples }, null, 2));

      for (const sample of samples) {
        const expected = Math.max(0, ribbon - sample.y);
        expect(Math.abs(sample.top - expected), `${sample.phase} at scrollY ${sample.y}: top ${sample.top}`).toBeLessThanOrEqual(0.5);
      }
      expect(samples.filter(sample => sample.y >= ribbon).length).toBeGreaterThan(40);
      expect(samples.at(-1)!.top).toBeCloseTo(ribbon, 1);
      // The preview ribbon remains non-sticky.
      await page.evaluate(() => scrollTo(0, 600));
      expect(await page.evaluate(() => document.querySelector('.demo-ribbon')!.getBoundingClientRect().bottom)).toBeLessThan(0);
      expect(await headerTop(page)).toBeCloseTo(0, 1);
      await page.screenshot({ path: info.outputPath(`sticky-${device.width}.png`) });
    });
  });
}
