import type { Page } from '@playwright/test';

/** Await only existing finite motion; never mask focus, routing or dismissal delays. */
export async function settleFiniteMotion(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations()
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})));
  });
}
