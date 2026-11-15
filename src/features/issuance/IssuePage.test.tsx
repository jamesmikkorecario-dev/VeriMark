import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type BatchPreview, type DraftRowInput } from '../../lib/api/types';
import { createFakeApi, deferred, makeWorkspace, renderPage, template } from '../credentials/shared/testing';
import IssuePage from './IssuePage';

const preview = (rows: DraftRowInput[], overrides: Partial<BatchPreview> = {}): BatchPreview => ({
  batchId: 'batch-1', revision: 1, templateId: 'tpl-1', templateRevision: 2, templateName: 'Course completion', rowCount: rows.length, previewDigest: 'digest-1',
  rows: rows.map((r, i) => ({ sourceRow: i + 1, recipientDisplayName: r.recipientDisplayName, title: r.title, achievement: r.achievement, expiresAt: r.expiresOn ? `${r.expiresOn}T23:59:59Z` : null })),
  ...overrides,
});

function setupApi() {
  const api = createFakeApi();
  api.listTemplates.mockResolvedValue([template(), template({ id: 'tpl-old', name: 'Old', archived: true })]);
  api.createBatch.mockImplementation((_org, input) => Promise.resolve({ batchId: 'batch-1', revision: 1, rowCount: input.rows.length }));
  api.previewBatch.mockImplementation(() => Promise.resolve(preview(api.createBatch.mock.calls.at(-1)![1].rows)));
  api.approveBatch.mockResolvedValue({ approvalId: 'appr-1', approvedAt: '2026-11-16T10:00:00Z' });
  api.issueBatch.mockImplementation(() => Promise.resolve({ batchId: 'batch-1', credentials: api.createBatch.mock.calls.at(-1)![1].rows.map((_, i) => ({ id: `cred-${i + 1}`, publicId: `VM-${i + 1}`, sourceRow: i + 1 })) }));
  return api;
}

async function fillSingle(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Continue' }));
  await user.type(screen.getByLabelText('Recipient name'), 'Rowan Example');
  await user.type(screen.getByLabelText('Title'), 'Community First Aid');
  await user.type(screen.getByLabelText('Achievement'), 'Completed the course.');
}

async function reachReview(user: UserEvent) {
  await fillSingle(user);
  await user.click(screen.getByRole('button', { name: 'Review records' }));
  await screen.findByRole('heading', { name: 'Review before issuing' });
}

let randomUUID: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  let n = 0;
  randomUUID = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-00000000000${++n}` as `${string}-${string}-${string}-${string}-${string}`);
});
afterEach(() => { randomUUID.mockRestore(); });

describe('IssuePage', () => {
  it('denies viewers', async () => {
    const api = createFakeApi();
    renderPage(<IssuePage />, { api, workspace: makeWorkspace({ role: 'viewer' }) });
    expect(screen.getByRole('heading', { name: 'Issuing is not available for your role' })).toBeInTheDocument();
    expect(api.listTemplates).not.toHaveBeenCalled();
  });

  it('shows an empty state linking to templates when no usable template exists', async () => {
    const api = createFakeApi();
    api.listTemplates.mockResolvedValue([template({ archived: true })]);
    renderPage(<IssuePage />, { api });
    expect(await screen.findByRole('heading', { name: 'Create a template first' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to templates' })).toHaveAttribute('href', '/app/templates');
  });

  it('issues a single record through draft, preview, approve and issue, then exports links', async () => {
    const api = setupApi();
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => { created.push(blob); return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await reachReview(user);
    expect(api.createBatch).toHaveBeenCalledWith('org-1', { templateId: 'tpl-1', source: 'single', rows: [{ recipientDisplayName: 'Rowan Example', title: 'Community First Aid', achievement: 'Completed the course.' }] });
    expect(api.previewBatch).toHaveBeenCalledWith('org-1', 'batch-1');
    const table = screen.getByRole('table', { name: /Exactly these 1 record will be issued/ });
    expect(within(table).getByText('Rowan Example')).toBeInTheDocument();
    const issue = screen.getByRole('button', { name: 'Approve and issue 1 record' });
    expect(issue).toBeDisabled();
    await user.click(screen.getByLabelText('I have reviewed these records; issued records cannot be edited'));
    await user.click(issue);
    expect(await screen.findByRole('heading', { name: '1 record issued' })).toBeInTheDocument();
    expect(api.approveBatch).toHaveBeenCalledWith('org-1', 'batch-1', { expectedRevision: 1, previewDigest: 'digest-1' });
    expect(api.issueBatch).toHaveBeenCalledWith('org-1', 'batch-1', { approvalId: 'appr-1', idempotencyKey: '00000000-0000-4000-8000-000000000001' });
    expect(screen.getByRole('link', { name: 'Open record for Rowan Example' })).toHaveAttribute('href', '/app/credentials/cred-1');
    await user.click(screen.getByRole('button', { name: 'Export record links (CSV)' }));
    expect(click).toHaveBeenCalled();
    const text = await created[0].text();
    expect(text).toBe(`public_id,verification_url,recipient_name\r\nVM-1,${window.location.origin}/verify/VM-1,Rowan Example\r\n`);
    click.mockRestore();
  });

  it('reuses the same idempotency key and approval when retrying after a failure', async () => {
    const api = setupApi();
    api.issueBatch.mockRejectedValueOnce(new ApiError('TEMPORARILY_UNAVAILABLE', 'gateway timeout'));
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await reachReview(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Approve and issue 1 record' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trying again is safe');
    await user.click(screen.getByRole('button', { name: 'Try issuing again' }));
    await screen.findByRole('heading', { name: '1 record issued' });
    expect(api.approveBatch).toHaveBeenCalledTimes(1);
    expect(api.issueBatch).toHaveBeenCalledTimes(2);
    const keys = api.issueBatch.mock.calls.map(call => call[2].idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('blocks double submission while issuing is pending', async () => {
    const api = setupApi();
    const gate = deferred<{ batchId: string; credentials: [] }>();
    api.issueBatch.mockReturnValue(gate.promise);
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await reachReview(user);
    await user.click(screen.getByRole('checkbox'));
    const button = screen.getByRole('button', { name: 'Approve and issue 1 record' });
    await user.click(button);
    expect(await screen.findByRole('button', { name: 'Issuing…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Issuing…' }));
    expect(api.approveBatch).toHaveBeenCalledTimes(1);
    expect(api.issueBatch).toHaveBeenCalledTimes(1);
    gate.resolve({ batchId: 'batch-1', credentials: [] });
    await screen.findByRole('heading', { name: '0 records issued' });
  });

  it('validates the single form before creating anything', async () => {
    const api = setupApi();
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Recipient e-mail (optional)'), 'not-an-email');
    await user.type(screen.getByLabelText('Expiry date (optional)'), '2020-01-01');
    await user.click(screen.getByRole('button', { name: 'Review records' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('Enter the recipient name.');
    expect(summary).toHaveTextContent('Enter an e-mail address like name@example.org.');
    expect(summary).toHaveTextContent('The expiry date must be after today.');
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(api.createBatch).not.toHaveBeenCalled();
  });

  it('shows every CSV row error in a table and blocks progress until a valid file is uploaded', async () => {
    const api = setupApi();
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await user.click(await screen.findByLabelText(/CSV upload/));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Download sample CSV' })).toBeInTheDocument();
    const bad = new File(['recipient_name,title,achievement,email\n,Course,Done,\nRowan,Course,Done,bad\nRowan,Course,Done,bad\n'], 'class.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('CSV file'), bad);
    const table = await screen.findByRole('table', { name: /4 problems in class.csv/ });
    const rows = within(table).getAllByRole('row').slice(1).map(r => r.textContent);
    expect(rows).toEqual([
      expect.stringContaining('Enter the recipient name.'),
      expect.stringContaining('Enter an e-mail address'),
      expect.stringContaining('Enter an e-mail address'),
      expect.stringContaining('repeats an earlier row'),
    ]);
    expect(screen.getByRole('button', { name: 'Review records' })).toBeDisabled();
    const good = new File(['recipient_name,title,achievement\nRowan,Course,Done\nSam,Course,Done\n'], 'fixed.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('CSV file'), good);
    expect(await screen.findByText('2 records in fixed.csv passed the checks.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review records' }));
    await screen.findByRole('heading', { name: 'Review before issuing' });
    expect(api.createBatch).toHaveBeenCalledWith('org-1', expect.objectContaining({ source: 'csv', rows: [
      { recipientDisplayName: 'Rowan', title: 'Course', achievement: 'Done' }, { recipientDisplayName: 'Sam', title: 'Course', achievement: 'Done' },
    ] }));
  });

  it('maps server row errors back into the CSV error table', async () => {
    const api = setupApi();
    api.createBatch.mockRejectedValue(new ApiError('VALIDATION', 'check constraint', { fields: [{ field: 'rows[2].title', code: 'TOO_LONG', row: 2 }] }));
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await user.click(await screen.findByLabelText(/CSV upload/));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.upload(screen.getByLabelText('CSV file'), new File(['recipient_name,title,achievement\nA,B,C\nD,E,F\n'], 'x.csv'));
    await user.click(await screen.findByRole('button', { name: 'Review records' }));
    const table = await screen.findByRole('table', { name: /1 problem/ });
    expect(within(table).getByText('Title must be 200 characters or fewer.')).toBeInTheDocument();
    expect(screen.queryByText('check constraint')).not.toBeInTheDocument();
  });

  it('explains review is required and never calls the API to issue for a pending organization', async () => {
    const api = setupApi();
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api, workspace: makeWorkspace({ reviewState: 'pending' }) });
    expect(await screen.findByRole('heading', { name: 'Your organization must be reviewed before it can issue' })).toBeInTheDocument();
    await fillSingle(user);
    expect(screen.getByRole('button', { name: 'Review records' })).toBeDisabled();
    expect(api.createBatch).not.toHaveBeenCalled();
  });

  it('returns to review with a fresh preview after a revision conflict on approval', async () => {
    const api = setupApi();
    api.approveBatch.mockRejectedValueOnce(new ApiError('REVISION_CONFLICT', 'stale'));
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await reachReview(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Approve and issue 1 record' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Review the records below again');
    expect(api.previewBatch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(api.issueBatch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Approve and issue 1 record' }));
    await screen.findByRole('heading', { name: '1 record issued' });
  });

  it('stops on an idempotency conflict and points to the records list', async () => {
    const api = setupApi();
    api.issueBatch.mockRejectedValue(new ApiError('IDEMPOTENCY_CONFLICT', 'key reused'));
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await reachReview(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Approve and issue 1 record' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This request was already used');
    expect(screen.getByRole('link', { name: 'Check records' })).toHaveAttribute('href', '/app/credentials');
    expect(screen.getByRole('button', { name: 'Try issuing again' })).toBeDisabled();
  });

  it('handles ISSUER_NOT_ELIGIBLE from the server', async () => {
    const api = setupApi();
    api.approveBatch.mockRejectedValue(new ApiError('ISSUER_NOT_ELIGIBLE', 'org suspended'));
    const user = userEvent.setup();
    renderPage(<IssuePage />, { api });
    await reachReview(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Approve and issue 1 record' }));
    await waitFor(() => expect(screen.getAllByText(/must be reviewed/).length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Approve and issue 1 record' })).toBeDisabled();
    expect(api.issueBatch).not.toHaveBeenCalled();
  });
});
