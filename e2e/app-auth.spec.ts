import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { settleFiniteMotion } from './motion-helpers';

// Journeys against the local demo adapter (all accounts and data are fictional).
const PASSWORD = 'demo-password-1';

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(!['chromium-390', 'chromium-1440'].includes(info.project.name), 'Auth journeys run at one mobile and one desktop width');
});

const mobile = (page: Page) => page.viewportSize()!.width <= 800;

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** The workspace identity panel: sidebar on desktop, drawer on mobile. */
async function workspaceIdentity(page: Page) {
  if (mobile(page)) {
    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    return page.getByRole('dialog', { name: 'Workspace navigation' });
  }
  return page.locator('aside.sidebar');
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function seriousViolations(page: Page) {
  await settleFiniteMotion(page);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return audit.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
}

test('sign-in failure is generic and success opens the workspace', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sign in');
  await signIn(page, 'owner@demo.verimark.test', 'not-the-password');
  await expect(page.getByRole('alert')).toContainText('The email address or password is not correct.');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await signIn(page, 'nobody@demo.verimark.test');
  await expect(page.getByRole('alert')).toContainText('The email address or password is not correct.');
  await signIn(page, 'owner@demo.verimark.test');
  await expect(page).toHaveURL('/app');
  await expect(page.getByText('DEMONSTRATION — FICTIONAL DATA · NOTHING HERE IS REAL')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('guard redirects to sign-in and returns to the intended page; sign-out ends the session', async ({ page }) => {
  await page.goto('/app/organization');
  await expect(page).toHaveURL('/sign-in');
  await signIn(page, 'owner@demo.verimark.test');
  await expect(page).toHaveURL('/app/organization');
  await expect(page.getByRole('heading', { level: 1, name: 'Fieldwork Collective' })).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Fieldwork Collective' })).toBeVisible();
  const identity = await workspaceIdentity(page);
  await identity.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  await page.goto('/app');
  await expect(page).toHaveURL('/sign-in');
});

test('a user without an organization creates one through onboarding', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('Your name').fill('Morgan Fictional');
  await page.getByLabel('Email address').fill('morgan@example.test');
  await page.getByLabel('Password', { exact: true }).fill('long-password-1');
  await page.getByLabel('Confirm password').fill('long-password-1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/app/onboarding');
  await expect(page.getByRole('heading', { level: 1, name: 'Create your organization' })).toBeVisible();
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter the organization name.');
  await page.getByLabel('Organization name').fill('Harbour Learning Circle');
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page).toHaveURL('/app');
  await expect(page.getByText(/Harbour Learning Circle: review pending\./)).toBeVisible();
  await page.goto('/app/organization');
  await expect(page.getByRole('heading', { level: 1, name: 'Harbour Learning Circle' })).toBeVisible();
  await expect(page.getByText('Morgan Fictional (you)')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('a viewer sees no owner or issuer controls', async ({ page }) => {
  await page.goto('/sign-in');
  await signIn(page, 'viewer@demo.verimark.test');
  await page.goto('/app/organization');
  await expect(page.getByRole('heading', { level: 1, name: 'Fieldwork Collective' })).toBeVisible();
  await expect(page.getByText('Sam Okafor', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rename' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Invitations' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: /Role for/ })).toHaveCount(0);
  const identity = await workspaceIdentity(page);
  await expect(identity.getByRole('link', { name: 'Credentials' })).toBeVisible();
  await expect(identity.getByRole('link', { name: 'Issue credentials' })).toHaveCount(0);
  await expect(identity.getByRole('link', { name: 'Platform review' })).toHaveCount(0);
  await page.goto('/app/review');
  await expect(page.getByRole('heading', { name: 'Platform review is restricted' })).toBeVisible();
});

test('an owner invites a new person who accepts with the invited account', async ({ page }) => {
  await page.goto('/sign-in');
  await signIn(page, 'owner@demo.verimark.test');
  await page.goto('/app/organization');
  await page.getByLabel('Email address').fill('casey@example.test');
  await page.getByLabel('Role', { exact: true }).selectOption('issuer');
  await page.getByRole('button', { name: 'Create invitation' }).click();
  await expect(page.getByText('Copy this link now. It will not be shown again.')).toBeVisible();
  const link = await page.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toMatch(/\/invite#[A-Za-z0-9_-]{43}$/);
  await page.getByRole('button', { name: 'I have saved the link' }).click();
  await expect(page.getByRole('textbox', { name: 'Invitation link' })).toHaveCount(0);
  await expect(page.getByText('casey@example.test')).toBeVisible();
  const identity = await workspaceIdentity(page);
  await identity.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');

  await page.goto(link);
  await expect(page).toHaveURL('/invite');
  expect(await page.evaluate(() => location.hash)).toBe('');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill('Casey Fictional');
  await page.getByLabel('Email address').fill('casey@example.test');
  await page.getByLabel('Password', { exact: true }).fill('casey-password-1');
  await page.getByLabel('Confirm password').fill('casey-password-1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('heading', { name: 'You have joined Fieldwork Collective' })).toBeVisible();
  await page.getByRole('link', { name: 'Open the workspace' }).click();
  await page.goto('/app/organization');
  await expect(page.getByText('Casey Fictional (you)')).toBeVisible();
  const casey = await workspaceIdentity(page);
  await expect(casey.getByRole('link', { name: 'Issue credentials' })).toBeVisible();

  // The same link cannot be used twice.
  if (mobile(page)) await page.keyboard.press('Escape');
  await page.goto(link);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('heading', { name: 'This invitation is unavailable' })).toBeVisible();
});

test('sign-in and organization pages have no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await signIn(page, 'owner@demo.verimark.test');
  await expect(page).toHaveURL('/app');
  await page.goto('/app/organization');
  await expect(page.getByText('Sam Okafor', { exact: true })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await expectNoHorizontalOverflow(page);
});
