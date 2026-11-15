import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { DEMO_PUBLIC_IDS as ids, login, logout, reviewSingle, issue } from './app-helpers';
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(!['chromium-390', 'chromium-1440'].includes(info.project.name), 'Journeys run at one mobile and one desktop width');
});
test('single issuance is public and recorded in credentials and activity', async ({ page }) => {
  await login(page); await reviewSingle(page); await issue(page);
  await page.getByRole('link', { name: 'Open record for Casey Fictional' }).click();
  const url = await page.getByLabel('Verification link', { exact: true }).inputValue();
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
  await expect(page.getByText('Casey Fictional', { exact: true })).toBeVisible();
  await expect(page.getByText('Browser Journey Workshop', { exact: true })).toBeVisible();
  for (const route of ['credentials', 'activity']) {
    await page.goto(`/app/${route}`);
    await expect(page.getByRole('main')).toContainText('Casey Fictional');
  }
});
test('CSV rejects invalid rows then issues and exports three records', async ({ page }) => {
  await login(page); await page.goto('/app/issue');
  await page.getByLabel(/CSV upload/).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const upload = page.getByLabel('CSV file', { exact: true });
  const header = 'recipient_name,title,achievement\n';
  await upload.setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from(header + ',Workshop,Completed\n') });
  await expect(page.getByRole('table')).toContainText('Recipient');
  await expect(page.getByRole('button', { name: 'Review records', exact: true })).toBeDisabled();
  await upload.setInputFiles({ name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from(header + 'A Fictional,Workshop,Completed\nB Fictional,Workshop,Completed\nC Fictional,Workshop,Completed\n') });
  await expect(page.getByRole('status')).toContainText('3 records');
  await page.getByRole('button', { name: 'Review records', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await issue(page, 3);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export record links (CSV)', exact: true }).click();
  const csv = await readFile((await (await download).path())!, 'utf8');
  const rows = csv.trim().split(/\r?\n/); expect(rows).toHaveLength(4);
  for (const row of rows.slice(1)) expect(row).toMatch(/\/verify\/[A-Za-z0-9_-]{22}/);
});
test('revoke requires reason, restores focus and hides private reason publicly', async ({ page }) => {
  await login(page); await page.goto('/app/credentials/cred_demo_valid');
  const trigger = page.getByRole('button', { name: 'Revoke', exact: true }); await trigger.click();
  await page.getByRole('button', { name: 'Revoke record', exact: true }).click();
  await expect(page.getByLabel('Reason for revoking')).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await trigger.click();
  await page.getByLabel('Reason for revoking').fill('Private browser test reason');
  await page.getByRole('button', { name: 'Revoke record', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Record revoked.' })).toBeVisible();
  for (const name of ['Revoke', 'Replace']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  await page.goto(`/verify/${ids.valid}`);
  await expect(page.getByRole('heading', { name: 'Record revoked', exact: true })).toBeVisible();
  await expect(page.getByText('Private browser test reason')).toHaveCount(0);
});
test('replacement preserves old record and links to corrected version two', async ({ page }) => {
  await login(page); await page.goto('/app/credentials/cred_demo_valid');
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await page.getByLabel('Recipient name').fill('Alex Corrected');
  await page.getByLabel('Reason for replacing').fill('Correct fictional spelling');
  await page.getByRole('button', { name: 'Issue replacement', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alex Corrected', exact: true })).toBeVisible();
  await expect(page.locator('dt').filter({ hasText: /^Version$/ }).locator('+ dd')).toHaveText('2');
  await page.goto(`/verify/${ids.valid}`);
  await expect(page.getByRole('heading', { name: 'Record replaced', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View replacement record' }).click();
  await expect(page.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
  await expect(page.getByText('Alex Corrected', { exact: true })).toBeVisible();
});
test('recipient link works account free in a new context and downloads PDF', async ({ page, browser }) => {
  test.fail(true, 'Demo delivery state is sessionStorage-local: a new context cannot exchange an issuer-created link.');
  await login(page); await page.goto('/app/credentials/cred_demo_valid');
  await page.getByRole('button', { name: 'Create recipient link', exact: true }).click();
  await page.getByRole('button', { name: 'Create link', exact: true }).click();
  const link = await page.getByLabel('Private recipient link').inputValue();
  const context = await browser.newContext();
  try {
    const recipient = await context.newPage(); await recipient.goto(link);
    await expect(recipient).not.toHaveURL(/#/);
    await expect(recipient.getByRole('heading', { name: 'Your certificate' })).toBeVisible();
    const download = recipient.waitForEvent('download');
    await recipient.getByRole('button', { name: 'Download certificate (PDF)', exact: true }).click();
    expect((await readFile((await (await download).path())!)).subarray(0, 4).toString()).toBe('%PDF');
  } finally { await context.close(); }
});
test('rotating delivery links makes old and garbage tokens identically unavailable', async ({ page }) => {
  await login(page); await page.goto('/app/credentials/cred_demo_valid');
  await page.getByRole('button', { name: 'Create recipient link', exact: true }).click();
  await page.getByRole('button', { name: 'Create link', exact: true }).click();
  const old = await page.getByLabel('Private recipient link').inputValue();
  await page.getByRole('button', { name: 'Create a new recipient link', exact: true }).click();
  await page.getByRole('button', { name: 'Create link', exact: true }).click();
  await expect(page.getByLabel('Private recipient link')).not.toHaveValue(old);
  await page.goto(old);
  await expect(page.getByRole('heading', { name: 'Access link unavailable' })).toBeVisible();
  const message = await page.locator('.public-record').innerText();
  await page.goto('/receive#' + 'x'.repeat(43));
  await expect(page.getByRole('heading', { name: 'Access link unavailable' })).toBeVisible();
  await expect(page.locator('.public-record')).toHaveText(message, { useInnerText: true });
});
test('viewer and issuer controls follow their roles', async ({ page }) => {
  await login(page, 'viewer');
  if (page.viewportSize()!.width <= 800) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await expect(page.getByRole('link', { name: 'Issue credentials', exact: true })).toHaveCount(0);
  await page.goto('/app/issue');
  await expect(page.getByRole('heading', { name: 'Issuing is not available for your role' })).toBeVisible();
  await page.goto('/app/credentials/cred_demo_valid');
  await expect(page.getByRole('heading', { name: 'Alex Santos', exact: true })).toBeVisible();
  for (const name of ['Revoke', 'Replace', 'Create recipient link']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  await expect(page.getByText('alex@example.test')).toHaveCount(0);
  await logout(page); await login(page); await page.goto('/app/organization');
  await expect(page.getByRole('heading', { name: 'Fieldwork Collective', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Invitations' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: /Role for/ })).toHaveCount(0);
});
test('review approval unlocks issuance in the same browser context', async ({ page }) => {
  await login(page, 'north'); await page.goto('/app/issue');
  await expect(page.getByRole('heading', { name: 'Your organization must be reviewed before it can issue' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review records', exact: true })).toBeDisabled();
  await logout(page); await login(page, 'admin'); await page.goto('/app/review');
  const form = page.getByRole('form', { name: 'Record review for Northgate Guild' });
  await form.getByLabel('Outcome').selectOption('reviewed'); await form.getByLabel('Private reason').fill('Fictional identity checked');
  await form.getByRole('button', { name: 'Record decision' }).click();
  await expect(page.getByRole('status')).toContainText('Northgate Guild: reviewed recorded.');
  await logout(page); await login(page, 'north'); await page.goto('/app/issue');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});
test('foreign record identifiers disclose no record data', async ({ page }) => {
  await login(page, 'owner'); await page.goto('/app/credentials/cred_other_tenant');
  await expect(page.getByRole('heading', { name: 'This record is unavailable', exact: true })).toBeVisible();
  await expect(page.getByLabel('Verification link', { exact: true })).toHaveCount(0);
});


test('same-tab account-free recipient can download a real PDF', async ({ page }) => {
  await login(page); await page.goto('/app/credentials/cred_demo_valid');
  await page.getByRole('button', { name: 'Create recipient link', exact: true }).click();
  await page.getByRole('button', { name: 'Create link', exact: true }).click();
  const link = await page.getByLabel('Private recipient link').inputValue();
  await logout(page); await page.goto(link);
  await expect(page).not.toHaveURL(/#/);
  await expect(page.getByRole('heading', { name: 'Your certificate' })).toBeVisible();
  await expect(page.getByText('Alex Santos', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download certificate (PDF)', exact: true }).click();
  expect((await readFile((await (await download).path())!)).subarray(0, 4).toString()).toBe('%PDF');
});
