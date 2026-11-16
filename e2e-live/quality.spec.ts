import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, expectFocusVisible, fictional, keyboardTo, live, noOverflow, ready, reviewSingle, settle, test } from './live';

// Layout, navigation and accessibility on real data. Nothing here creates a record except where stated.
const publicRoutes = ['/', '/verify', `/verify/${live.seed.publicId}`, '/verify/' + 'z'.repeat(22), '/receive', '/sign-in', '/sign-up', '/reset-password'];
const appRoutes = ['/app', '/app/credentials', `/app/credentials/${live.seed.id}`, '/app/issue', '/app/templates', '/app/activity', '/app/organization'];
async function audit(page: Page) {
  await settle(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }));
}

test('public pages: no serious accessibility violations and no sideways overflow', async ({ stage }) => {
  const page = await stage.anonymous();
  for (const route of publicRoutes) {
    await ready(page, route);
    expect(await audit(page), route).toEqual([]);
    expect(await noOverflow(page), route).toBe(true);
  }
});

test('workspace pages as owner: no serious accessibility violations and no sideways overflow', async ({ stage }) => {
  const page = await stage.as('owner');
  for (const route of appRoutes) {
    await ready(page, route);
    expect(await audit(page), route).toEqual([]);
    expect(await noOverflow(page), route).toBe(true);
  }
});

test('workspace pages as viewer and as platform reviewer: accessible and contained', async ({ stage }) => {
  const viewer = await stage.as('viewer');
  for (const route of ['/app', '/app/issue', `/app/credentials/${live.seed.id}`, '/app/organization']) {
    await ready(viewer, route);
    expect(await audit(viewer), `viewer ${route}`).toEqual([]);
    expect(await noOverflow(viewer), `viewer ${route}`).toBe(true);
  }
  const admin = await stage.as('admin');
  await ready(admin, '/app/review');
  expect(await audit(admin), 'review').toEqual([]);
  expect(await noOverflow(admin), 'review').toBe(true);
});

test('the verification page shows the public fields and nothing private', async ({ stage }) => {
  const page = await stage.anonymous();
  await ready(page, `/verify/${live.seed.publicId}`);
  await expect(page.locator('.public-record-result')).toHaveAttribute('data-status', 'valid');
  const text = await page.getByRole('main').innerText();
  expect(text).toContain(live.seed.publicId);
  expect(text).not.toContain(live.seed.id);
  expect(text).not.toMatch(/@example\.test|seed\.recipient/);
  await ready(page, '/verify/' + 'z'.repeat(22));
  await expect(page.getByRole('heading', { name: 'Record not found', exact: true })).toBeVisible();
  await page.goto('/verify');
  await page.getByLabel('Record ID or verification URL').fill('bad');
  await page.getByRole('button', { name: 'Check record' }).click();
  await expect(page.getByLabel('Record ID or verification URL')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Record ID or verification URL').fill(new URL(`/verify/${live.seed.publicId}`, page.url()).href);
  await page.getByRole('button', { name: 'Check record' }).click();
  await expect(page.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
});

test('reduced motion: main content does not animate', async ({ stage }) => {
  const member = await stage.as('issuer');
  await member.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of [`/verify/${live.seed.publicId}`, '/app']) {
    await ready(member, route);
    expect(await member.getByRole('main').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && Number(a.effect?.getComputedTiming().duration) > 10).length), route).toBe(0);
  }
});

test.describe('narrow screens', () => {
  test.beforeEach(({ page }, info) => { void page; test.skip(info.project.name !== 'live-390', 'Runs in the mobile project'); });

  test('workspace navigation opens from the keyboard, navigates, and closes with Escape', async ({ stage }) => {
    const page = await stage.as('issuer');
    const open = page.getByRole('button', { name: 'Open workspace navigation' });
    await keyboardTo(page, open); await expectFocusVisible(open); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Workspace navigation' }); await expect(dialog).toBeVisible();
    await keyboardTo(page, dialog.getByRole('link', { name: 'Credentials', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/app/credentials'); await expect(page.getByRole('heading', { name: 'Records', exact: true })).toBeVisible();
    await keyboardTo(page, open); await page.keyboard.press('Space'); await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(open).toBeFocused();
  });

  test.describe('at 320 pixels', () => {
    test.use({ viewport: { width: 320, height: 640 } });
    test('no page overflows sideways, including the review step (creates one unissued draft)', async ({ stage }) => {
      const visitor = await stage.anonymous();
      for (const route of publicRoutes) { await ready(visitor, route); expect(await noOverflow(visitor), route).toBe(true); }
      const page = await stage.as('issuer');
      for (const route of appRoutes) { await ready(page, route); expect(await noOverflow(page), route).toBe(true); }
      await reviewSingle(page, fictional('Narrow Fictional'));
      expect(await noOverflow(page), 'review step').toBe(true);
      expect(await audit(page), 'review step').toEqual([]);
    });
  });
});

test('keyboard alone: sign in and issue one record', async ({ page }, info) => {
  test.skip(info.project.name !== 'live-1440', 'Creates a record; runs once');
  await page.goto('/sign-in');
  await keyboardTo(page, page.getByLabel('Email address')); await page.keyboard.type(live.emails.issuer);
  await keyboardTo(page, page.getByLabel('Password', { exact: true })); await page.keyboard.type(live.password);
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true }); await keyboardTo(page, signIn); await expectFocusVisible(signIn); await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/app');
  await keyboardTo(page, page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Issue credentials', exact: true })); await page.keyboard.press('Enter');
  const next = page.getByRole('button', { name: 'Continue', exact: true }); await expect(next).toBeEnabled(); await keyboardTo(page, next); await expectFocusVisible(next); await page.keyboard.press('Enter');
  for (const [label, value] of [['Recipient name', fictional('Keyboard Fictional')], ['Title', 'Keyboard Workshop'], ['Achievement', 'Completed by keyboard']]) { await keyboardTo(page, page.getByLabel(label, { exact: true })); await page.keyboard.type(value); }
  await keyboardTo(page, page.getByRole('button', { name: 'Review records', exact: true })); await page.keyboard.press('Enter');
  const check = page.getByRole('checkbox'); await expect(check).toBeVisible(); await keyboardTo(page, check); await page.keyboard.press('Space');
  const approve = page.getByRole('button', { name: 'Approve and issue 1 record', exact: true }); await keyboardTo(page, approve); await expectFocusVisible(approve); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '1 record issued', exact: true })).toBeVisible();
});
