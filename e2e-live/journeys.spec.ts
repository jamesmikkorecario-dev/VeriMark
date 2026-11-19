import { readFile } from 'node:fs/promises';
import { approveAndIssue, expect, expectModeLabel, fictional, issueAndOpen, live, ready, signInWithForm, signOut, test } from './live';

// Journeys that create records. They run once, at desktop width; quality.spec.ts covers the other widths without writing.
test.beforeEach(({ page }, info) => { void page; test.skip(info.project.name !== 'live-1440', 'Record-creating journeys run once'); });

test('sign-in refuses a wrong password, returns to the requested page, and signs out', async ({ page }) => {
  await page.goto('/app/credentials');
  await expect(page).toHaveURL(/\/sign-in/);
  await expectModeLabel(page);
  await signInWithForm(page, 'viewer', 'definitely-not-the-password');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText(live.emails.viewer);
  await expect(page).toHaveURL(/\/sign-in/);
  await signInWithForm(page, 'viewer');
  await expect(page).toHaveURL('/app/credentials');
  await expect(page.getByRole('heading', { name: 'Credentials', exact: true })).toBeVisible();
  await expectModeLabel(page);
  await signOut(page);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('a single record is issued, listed, logged and publicly verifiable', async ({ stage }) => {
  const recipient = fictional('Casey Fictional');
  const page = await stage.as('issuer');
  const { verifyPath } = await issueAndOpen(page, recipient);
  expect(verifyPath).toMatch(/^\/verify\/[A-Za-z0-9_-]{22}$/);
  await ready(page, '/app/credentials');
  await page.getByLabel('Search records').fill(recipient);
  await expect(page.getByRole('main')).toContainText(recipient);
  await ready(page, '/app/activity');
  await expect(page.getByRole('main')).toContainText(recipient);
  const visitor = await stage.anonymous();
  await visitor.goto(verifyPath);
  await expect(visitor.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
  await expect(visitor.getByText(recipient, { exact: true })).toBeVisible();
  await expect(visitor.getByText(live.mainOrg, { exact: true })).toBeVisible();
  await expect(visitor.getByText('Identity and authority reviewed by VeriMark — not an accreditation')).toBeVisible();
  await expect(visitor.getByText('This is an online database check, not a cryptographic proof.')).toBeVisible();
});

test('a CSV with a bad row is refused; a clean one issues every row and exports links', async ({ stage }) => {
  const page = await stage.as('issuer');
  await ready(page, '/app/issue');
  await page.getByLabel(/CSV upload/).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const upload = page.getByLabel('CSV file', { exact: true });
  const header = 'recipient_name,title,achievement\n';
  await upload.setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from(header + ',Workshop,Completed\n') });
  await expect(page.getByRole('button', { name: 'Review records', exact: true })).toBeDisabled();
  const names = ['Avery', 'Blake', 'Corin'].map(n => fictional(`${n} Fictional`));
  await upload.setInputFiles({ name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from(header + names.map(n => `${n},Live CSV Workshop,Completed\n`).join('')) });
  await expect(page.getByRole('status')).toContainText('3 records');
  await page.getByRole('button', { name: 'Review records', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await approveAndIssue(page, 3);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export record links (CSV)', exact: true }).click();
  const rows = (await readFile((await (await download).path())!, 'utf8')).trim().split(/\r?\n/);
  expect(rows).toHaveLength(4);
  for (const [index, row] of rows.slice(1).entries()) { expect(row).toMatch(/\/verify\/[A-Za-z0-9_-]{22}/); expect(row).toContain(names[index]); }
});

test('revoking needs a reason, is final, and the reason stays private', async ({ stage }) => {
  const page = await stage.as('issuer');
  const { verifyPath } = await issueAndOpen(page, fictional('Riley Fictional'));
  const trigger = page.getByRole('button', { name: 'Revoke', exact: true }); await trigger.click();
  await page.getByRole('button', { name: 'Revoke record', exact: true }).click();
  await expect(page.getByLabel('Reason for revoking')).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await trigger.click();
  await page.getByLabel('Reason for revoking').fill('Private automated-test reason');
  await page.getByRole('button', { name: 'Revoke record', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Record revoked.' })).toBeVisible();
  for (const name of ['Revoke', 'Replace', 'Create recipient link']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  const visitor = await stage.anonymous();
  await visitor.goto(verifyPath);
  await expect(visitor.getByRole('heading', { name: 'Record revoked', exact: true })).toBeVisible();
  await expect(visitor.getByText('Private automated-test reason')).toHaveCount(0);
});

test('replacing issues a corrected successor and keeps the original as replaced', async ({ stage }) => {
  const original = fictional('Jordan Fictionl'); const corrected = fictional('Jordan Fictional');
  const page = await stage.as('issuer');
  const { verifyPath } = await issueAndOpen(page, original);
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await page.getByLabel('Recipient name').fill(corrected);
  await page.getByLabel('Reason for replacing').fill('Correct fictional spelling');
  await page.getByRole('button', { name: 'Issue replacement', exact: true }).click();
  await expect(page.getByRole('heading', { name: corrected, exact: true })).toBeVisible();
  await expect(page.locator('dt').filter({ hasText: /^Version$/ }).locator('+ dd')).toHaveText('2');
  const visitor = await stage.anonymous();
  await visitor.goto(verifyPath);
  await expect(visitor.getByRole('heading', { name: 'Record replaced', exact: true })).toBeVisible();
  await expect(visitor.getByText(original, { exact: true })).toBeVisible();
  await visitor.getByRole('link', { name: 'View replacement record' }).click();
  await expect(visitor.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
  await expect(visitor.getByText(corrected, { exact: true })).toBeVisible();
});

test('a recipient link opens without an account, downloads a PDF, and is replaced by a newer link', async ({ stage }) => {
  const recipient = fictional('Morgan Fictional');
  const page = await stage.as('issuer');
  await issueAndOpen(page, recipient);
  await page.getByRole('button', { name: 'Create recipient link', exact: true }).click();
  await page.getByRole('button', { name: 'Create link', exact: true }).click();
  const first = await page.getByLabel('Private recipient link').inputValue();
  expect(first).toMatch(/\/receive#[A-Za-z0-9_-]{43}$/);
  if (live.target === 'hosted') {
    // A different browser with no session: the real recipient's situation.
    const recipientPage = await stage.anonymous();
    await recipientPage.goto(first);
    await expect(recipientPage).not.toHaveURL(/#/);
    await expect(recipientPage.getByRole('heading', { name: 'Your certificate' })).toBeVisible();
    await expect(recipientPage.getByText(recipient, { exact: true })).toBeVisible();
    const download = recipientPage.waitForEvent('download');
    await recipientPage.getByRole('button', { name: 'Download certificate (PDF)', exact: true }).click();
    expect((await readFile((await (await download).path())!)).subarray(0, 4).toString()).toBe('%PDF');
  }
  await page.getByRole('button', { name: 'Create a new recipient link', exact: true }).click();
  await page.getByRole('button', { name: 'Create link', exact: true }).click();
  await expect(page.getByLabel('Private recipient link')).not.toHaveValue(first);
  const second = await page.getByLabel('Private recipient link').inputValue();
  const visitor = await stage.anonymous();
  await visitor.goto(first);
  await expect(visitor.getByRole('heading', { name: 'Access link unavailable' })).toBeVisible();
  // Wording differs between the demonstration and hosted modes; what matters is that both failures read identically.
  const message = await visitor.getByText(/^This access link is unavailable\./).textContent();
  await visitor.goto('/receive#' + 'A'.repeat(43));
  await expect(visitor.getByText(message!)).toBeVisible();
  await visitor.goto(second);
  await expect(visitor).not.toHaveURL(/#/);
  await expect(visitor.getByRole('heading', { name: 'Your certificate' })).toBeVisible();
  const download = visitor.waitForEvent('download');
  await visitor.getByRole('button', { name: 'Download certificate (PDF)', exact: true }).click();
  expect((await readFile((await (await download).path())!)).subarray(0, 4).toString()).toBe('%PDF');
});

test('roles limit what each member sees, and other organizations see nothing', async ({ stage }) => {
  const seedPath = `/app/credentials/${live.seed.id}`;
  const viewer = await stage.as('viewer');
  await expect(viewer.getByRole('link', { name: 'Issue credentials', exact: true })).toHaveCount(0);
  await viewer.goto('/app/issue');
  await expect(viewer.getByRole('heading', { name: 'Issuing is not available for your role' })).toBeVisible();
  await ready(viewer, seedPath);
  await expect(viewer.getByLabel('Verification link', { exact: true })).toBeVisible();
  for (const name of ['Revoke', 'Replace', 'Create recipient link', 'Download certificate (PDF)']) await expect(viewer.getByRole('button', { name, exact: true })).toHaveCount(0);
  await expect(viewer.getByText('Recipient e-mail')).toHaveCount(0);
  const issuer = await stage.as('issuer');
  await ready(issuer, '/app/organization');
  await expect(issuer.getByRole('heading', { name: live.mainOrg, exact: true })).toBeVisible();
  await expect(issuer.getByRole('button', { name: 'Create invitation' })).toHaveCount(0);
  await expect(issuer.getByRole('combobox', { name: /Role for/ })).toHaveCount(0);
  const outsider = await stage.as('otherOwner');
  await outsider.goto(seedPath);
  await expect(outsider.getByRole('heading', { name: 'This record is unavailable', exact: true })).toBeVisible();
  await expect(outsider.getByLabel('Verification link', { exact: true })).toHaveCount(0);
  await ready(outsider, '/app/credentials');
  await expect(outsider.getByRole('main')).not.toContainText('Fictional');
});

test('an unreviewed organization cannot issue; only a platform reviewer can record a review', async ({ stage }) => {
  const pending = await stage.as('otherOwner');
  await pending.goto('/app/issue');
  await expect(pending.getByRole('heading', { name: 'Your organization must be reviewed before it can issue' })).toBeVisible();
  await pending.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(pending.getByRole('button', { name: 'Review records', exact: true })).toBeDisabled();
  await expect(pending.getByRole('link', { name: 'Platform review', exact: true })).toHaveCount(0);
  await pending.goto('/app/review');
  await expect(pending.getByRole('heading', { name: 'Platform review is restricted' })).toBeVisible();
  const admin = await stage.as('admin');
  await ready(admin, '/app/review');
  // Only ever touch the main test organization, by its exact name. Other organizations in the queue are left alone.
  const form = admin.getByRole('form', { name: `Record review for ${live.mainOrg}`, exact: true });
  await expect(form).toHaveCount(1);
  await form.getByLabel('Outcome').selectOption('reviewed');
  await form.getByLabel('Private reason').fill('Automated test: fictional organization re-confirmed');
  await form.getByRole('button', { name: 'Record decision' }).click();
  await expect(admin.getByRole('status')).toContainText(`${live.mainOrg}: reviewed recorded.`);
  const owner = await stage.as('issuer');
  await ready(owner, '/app/issue');
  await expect(owner.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});

test('members: an existing member cannot be invited again; a removed member can be invited and only they can accept', async ({ stage }) => {
  const owner = await stage.as('owner');
  await ready(owner, '/app/organization');
  // Left over from the previous run: the invitee is removed first, which also exercises member removal.
  const remove = owner.getByRole('button', { name: `Remove ${live.inviteeName}`, exact: true });
  await expect(owner.getByRole('heading', { name: 'Members' })).toBeVisible();
  if (await remove.count()) {
    await remove.click();
    await owner.getByRole('button', { name: 'Confirm removal' }).click();
    await expect(owner.getByText(`${live.inviteeName} was removed.`)).toBeVisible();
  }
  await owner.getByLabel('Email address').fill(live.emails.viewer);
  await owner.getByLabel('Role', { exact: true }).selectOption('issuer');
  await owner.getByRole('button', { name: 'Create invitation' }).click();
  await expect(owner.getByRole('alert')).toContainText('This person is already a member of the organization.');
  await expect(owner.getByRole('textbox', { name: 'Invitation link' })).toHaveCount(0);

  await owner.getByLabel('Email address').fill(live.emails.invitee);
  await owner.getByLabel('Role', { exact: true }).selectOption('viewer');
  await owner.getByRole('button', { name: 'Create invitation' }).click();
  await expect(owner.getByText('Copy this link now. It will not be shown again.')).toBeVisible();
  const link = await owner.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toMatch(/\/invite#[A-Za-z0-9_-]{43}$/);
  await owner.getByRole('button', { name: 'I have saved the link' }).click();
  await expect(owner.getByRole('textbox', { name: 'Invitation link' })).toHaveCount(0);

  const wrong = await stage.as('otherOwner');
  await wrong.goto(link);
  await expect(wrong).toHaveURL('/invite');
  await wrong.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(wrong.getByRole('heading', { name: 'This invitation is unavailable' })).toBeVisible();

  const invited = await stage.as('invitee');
  await invited.goto(link);
  await expect(invited).toHaveURL('/invite');
  await invited.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(invited.getByRole('heading', { name: `You have joined ${live.mainOrg}` })).toBeVisible();
});
