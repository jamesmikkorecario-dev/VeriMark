import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEMO_PUBLIC_IDS as ids, login, reviewSingle, issue, openDemo, keyboardTo, focusVisible } from './app-helpers';
import { settleFiniteMotion } from './motion-helpers';
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(!['chromium-390', 'chromium-1440'].includes(info.project.name), 'Public journeys run at one mobile and one desktop width');
});
const routes = ['/verify', `/verify/${ids.valid}`, '/receive', '/app', '/app/credentials', '/app/credentials/cred_demo_valid', '/app/issue', '/app/templates', '/app/activity', '/app/organization'];
async function ready(page: Page, route: string, settle = true) {
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Loading|Checking record|Opening your record)/)).toHaveCount(0);
  if (route === '/app/issue') await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  if (settle) await settleFiniteMotion(page);
}
test('verification form validates input and accepts a full URL', async ({ page }) => {
  await page.goto('/verify'); await page.getByLabel('Record ID or verification URL').fill('bad');
  await page.getByRole('button', { name: 'Check record' }).click();
  await expect(page.getByLabel('Record ID or verification URL')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL('/verify');
  await page.getByLabel('Record ID or verification URL').fill(new URL(`/verify/${ids.valid}`, page.url()).href);
  await page.getByRole('button', { name: 'Check record' }).click();
  await expect(page.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
});
for (const [id, heading, status] of [[ids.valid, 'Valid record', 'valid'], [ids.expired, 'Record expired', 'expired'], [ids.revoked, 'Record revoked', 'revoked'], [ids.replaced, 'Record replaced', 'replaced'], ['z'.repeat(22), 'Record not found', null], ['bad', 'Record not found', null]] as const) {
  test(`verification ${heading}: ${id}`, async ({ page }) => {
    await page.goto(`/verify/${id}`); await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    if (status) await expect(page.locator('.public-record-result')).toHaveAttribute('data-status', status);
  });
}
for (const route of [...routes, 'review step']) {
  test(`accessibility ${route}`, async ({ page }) => {
    await login(page);
    if (route === 'review step') await reviewSingle(page); else await ready(page, route);
    await settleFiniteMotion(page);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  });
}
for (const width of [390, 320]) {
  test.describe(`reflow ${width}`, () => {
    test.use({ viewport: { width, height: 640 } });
    test.beforeEach(({ page }, info) => { void page; test.skip(info.project.name !== 'chromium-390', 'Mobile matrix runs once'); });
    for (const route of [...routes, 'review step']) test(`no overflow ${route}`, async ({ page }) => {
      await login(page);
      if (route === 'review step') await reviewSingle(page); else await ready(page, route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
    test('mobile navigation keyboard and Escape', async ({ page }) => {
      await login(page); const open = page.getByRole('button', { name: 'Open workspace navigation' });
      await keyboardTo(page, open); await focusVisible(open); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Workspace navigation' }); await expect(dialog).toBeVisible();
      await keyboardTo(page, dialog.getByRole('link', { name: 'Credentials', exact: true }));
      await page.keyboard.press('Enter'); await expect(page).toHaveURL('/app/credentials'); await expect(page.getByRole('heading', { name: 'Records', exact: true })).toBeVisible(); await expect(page.getByRole('main')).toBeFocused();
      await keyboardTo(page, open); await page.keyboard.press('Space'); await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(open).toBeFocused();
    });
  });
}
test('keyboard alone signs in and issues a single record', async ({ page }) => {
  await page.goto('/sign-in'); await keyboardTo(page, page.getByLabel('Email address')); await page.keyboard.type('issuer@demo.verimark.test');
  await keyboardTo(page, page.getByLabel('Password', { exact: true })); await page.keyboard.type('demo-password-1');
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true }); await keyboardTo(page, signIn); await focusVisible(signIn); await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/app');
  if (page.viewportSize()!.width <= 800) { await keyboardTo(page, page.getByRole('button', { name: 'Open workspace navigation' })); await page.keyboard.press('Enter'); }
  await keyboardTo(page, page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Issue credentials', exact: true })); await page.keyboard.press('Enter');
  const next = page.getByRole('button', { name: 'Continue', exact: true }); await expect(next).toBeEnabled(); await keyboardTo(page, next); await focusVisible(next); await page.keyboard.press('Enter');
  for (const [label, value] of [['Recipient name', 'Keyboard Fictional'], ['Title', 'Keyboard Workshop'], ['Achievement', 'Completed by keyboard']]) { await keyboardTo(page, page.getByLabel(label, { exact: true })); await page.keyboard.type(value); }
  await keyboardTo(page, page.getByRole('button', { name: 'Review records', exact: true })); await page.keyboard.press('Enter');
  const check = page.getByRole('checkbox'); await expect(check).toBeVisible(); await keyboardTo(page, check); await page.keyboard.press('Space');
  const approve = page.getByRole('button', { name: 'Approve and issue 1 record', exact: true }); await keyboardTo(page, approve); await focusVisible(approve); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '1 record issued', exact: true })).toBeVisible();
});
for (const route of [`/verify/${ids.valid}`, '/app']) test(`reduced motion ${route}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page); await ready(page, route, false);
  expect(await page.getByRole('main').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && Number(a.effect?.getComputedTiming().duration) > 10).length)).toBe(0);
});

test('the one-click demo entry opens the owner workspace and its guide walks the product', async ({ page }) => {
  await page.goto('/demo');
  await expect(page).toHaveURL('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Fieldwork Collective · owner')).toBeVisible();
  const guide = page.getByRole('region', { name: 'Explore the demo' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('link', { name: 'Open a record', exact: true })).toHaveAttribute('href', /^\/app\/credentials\/cred_demo_/);
  await guide.getByRole('link', { name: 'Open the issue form' }).click();
  await expect(page).toHaveURL('/app/issue');
  await page.goBack();
  await guide.getByRole('link', { name: 'View its public page' }).click();
  await expect(page).toHaveURL(new RegExp(`^.*/verify/${ids.valid}$`));
  await expect(page.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
  await page.goBack();
  await guide.getByRole('link', { name: 'Choose a record to revoke' }).click();
  await expect(page.getByRole('button', { name: 'Revoke', exact: true })).toBeVisible();
});

test('switching role from the guide changes what the workspace allows, and the way back restores it', async ({ page }) => {
  await openDemo(page);
  const guide = page.getByRole('region', { name: 'Explore the demo' });
  await guide.getByRole('link', { name: 'As a viewer (read only)' }).click();
  await expect(page).toHaveURL('/app');
  await expect(page.getByText('Fieldwork Collective · viewer')).toBeVisible();
  await expect(page.getByText('Needs an owner or issuer')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'Open the issue form' })).toHaveCount(0);
  await page.getByRole('region', { name: 'Explore the demo' }).getByRole('link', { name: 'Back to the owner' }).click();
  await expect(page.getByText('Fieldwork Collective · owner')).toBeVisible();
  await page.getByRole('region', { name: 'Explore the demo' }).getByRole('link', { name: 'As the platform reviewer' }).click();
  await expect(page).toHaveURL('/app/review');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('reset demo data asks first, then restores the seeded records and the owner session', async ({ page }) => {
  await login(page); await reviewSingle(page); await issue(page);
  await page.goto('/app/credentials');
  await expect(page.getByRole('main')).toContainText('Casey Fictional');
  const banner = page.locator('.app-demo-ribbon');
  const reset = banner.getByRole('button', { name: 'Reset demo data' });
  await reset.click();
  const dialog = page.getByRole('dialog', { name: 'Reset the demo data?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep my changes' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(reset).toBeFocused();
  await expect(page.getByRole('main')).toContainText('Casey Fictional');
  await reset.click();
  await page.getByRole('button', { name: 'Yes, reset everything' }).click();
  await expect(page).toHaveURL('/app');
  await expect(page.getByText('Fieldwork Collective · owner')).toBeVisible();
  await page.goto('/app/credentials');
  await expect(page.getByRole('heading', { name: 'Records', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Alex Santos');
  await expect(page.getByRole('main')).not.toContainText('Casey Fictional');
});

test('the sign-in page offers the same demo entry and reset', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: 'Open the live demo' })).toHaveAttribute('href', '/demo');
  await expect(page.getByRole('button', { name: 'Reset demo data' })).toBeVisible();
  await page.getByRole('link', { name: 'Open the live demo' }).click();
  await expect(page).toHaveURL('/app');
});
