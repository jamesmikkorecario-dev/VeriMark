import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api/types';
import CredentialDetailPage from './CredentialDetailPage';
import { createFakeApi, detail, installDialogPolyfill, makeWorkspace, renderPage } from './shared/testing';

const renderPdf = vi.hoisted(() => vi.fn());
vi.mock('../../lib/certificate', () => ({
  renderCertificatePdf: renderPdf,
  verificationUrl: (publicId: string) => `https://verimark.example/verify/${publicId}`,
}));

beforeAll(installDialogPolyfill);
const route = { route: '/app/credentials/:credentialId', path: '/app/credentials/cred-1' };

describe('CredentialDetailPage', () => {
  it('shows every detail field, history and the verification link to owners', async () => {
    const api = createFakeApi();
    api.getCredential.mockResolvedValue(detail({ replacesPublicId: 'VM-OLD-0001', expiresAt: '2027-05-01T23:59:59Z' }));
    renderPage(<CredentialDetailPage />, { api, ...route });
    expect(await screen.findByRole('heading', { level: 1, name: 'Rowan Example' })).toBeInTheDocument();
    expect(api.getCredential).toHaveBeenCalledWith('org-1', 'cred-1');
    expect(screen.getByText('rowan@example.org')).toBeInTheDocument();
    expect(screen.getByText('Completed the 12-hour course.')).toBeInTheDocument();
    expect(screen.getByText('1 May 2027')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Earlier record VM-OLD-0001' })).toHaveAttribute('href', '/app/credentials?search=VM-OLD-0001');
    expect(screen.getByLabelText('Verification link')).toHaveValue('https://verimark.example/verify/VM-AAAA-1111');
    expect(screen.getByRole('link', { name: /Open public page/ })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(screen.getByRole('list')).getByText('Issued')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('opens the public page in the same tab in the demonstration, where data lives in this tab only', async () => {
    const api = createFakeApi('demo');
    api.getCredential.mockResolvedValue(detail());
    renderPage(<CredentialDetailPage />, { api, ...route });
    const link = await screen.findByRole('link', { name: 'Open public page' });
    expect(link).toHaveAttribute('href', '/verify/VM-AAAA-1111');
    expect(link).not.toHaveAttribute('target');
  });

  it('shows viewers no actions and no recipient e-mail', async () => {
    const api = createFakeApi();
    api.getCredential.mockResolvedValue(detail());
    renderPage(<CredentialDetailPage />, { api, workspace: makeWorkspace({ role: 'viewer' }), ...route });
    await screen.findByRole('heading', { level: 1, name: 'Rowan Example' });
    expect(screen.queryByText('rowan@example.org')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke|Replace|Download|recipient link/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('shows a non-disclosing unavailable state for NOT_FOUND', async () => {
    const api = createFakeApi();
    api.getCredential.mockRejectedValue(new ApiError('NOT_FOUND', 'credential cred-1 belongs to org-9'));
    renderPage(<CredentialDetailPage />, { api, ...route });
    expect(await screen.findByRole('heading', { name: 'This record is unavailable' })).toBeInTheDocument();
    expect(screen.queryByText(/org-9/)).not.toBeInTheDocument();
  });

  it('requires a reason to revoke, reuses the idempotency key on retry and returns focus on cancel', async () => {
    const api = createFakeApi();
    api.getCredential.mockResolvedValueOnce(detail()).mockResolvedValue(detail({ status: 'revoked', events: [...detail().events, { id: 'ev-2', type: 'revoked', at: '2026-11-16T10:00:00Z', actorDisplayName: 'Mika Fictional', reason: 'Issued in error' }] }));
    api.revokeCredential.mockRejectedValueOnce(new ApiError('TEMPORARILY_UNAVAILABLE', 'timeout')).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderPage(<CredentialDetailPage />, { api, ...route });
    const trigger = await screen.findByRole('button', { name: 'Revoke' });

    await user.click(trigger);
    let dialog = screen.getByRole('dialog', { name: 'Revoke this record?' });
    expect(dialog).toHaveTextContent('This cannot be undone.');
    await user.keyboard('{Escape}');
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    dialog = screen.getByRole('dialog', { name: 'Revoke this record?' });
    await user.click(within(dialog).getByRole('button', { name: 'Revoke record' }));
    expect(within(dialog).getByLabelText('Reason for revoking')).toHaveAccessibleDescription(/Enter the reason/);
    expect(api.revokeCredential).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('Reason for revoking'), 'Issued in error');
    await user.click(within(dialog).getByRole('button', { name: 'Revoke record' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Trying again is safe');
    await user.click(within(dialog).getByRole('button', { name: 'Revoke record' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Record revoked.');
    const [first, second] = api.revokeCredential.mock.calls;
    expect(first[2]).toEqual({ reason: 'Issued in error', idempotencyKey: expect.any(String) });
    expect(second[2].idempotencyKey).toBe(first[2].idempotencyKey);
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
    expect(screen.getByText('Reason: Issued in error')).toBeInTheDocument();
  });

  it('reloads the record when the server reports an invalid transition', async () => {
    const api = createFakeApi();
    api.getCredential.mockResolvedValueOnce(detail()).mockResolvedValue(detail({ status: 'replaced', replacedByPublicId: 'VM-NEW-2' }));
    api.revokeCredential.mockRejectedValue(new ApiError('INVALID_TRANSITION', 'already replaced'));
    const user = userEvent.setup();
    renderPage(<CredentialDetailPage />, { api, ...route });
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    await user.type(screen.getByLabelText('Reason for revoking'), 'Duplicate');
    await user.click(screen.getByRole('button', { name: 'Revoke record' }));
    expect(await screen.findByRole('status')).toHaveTextContent('status had already changed');
    expect(api.getCredential).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('link', { name: 'Newer record VM-NEW-2' })).toBeInTheDocument();
    expect(document.querySelector('dialog[open]')).toBeNull();
  });

  it('replaces with prefilled values and a required reason, then opens the successor', async () => {
    const api = createFakeApi();
    api.getCredential.mockImplementation((_org, id) => Promise.resolve(id === 'cred-1' ? detail() : detail({ id: 'cred-9', publicId: 'VM-NEW-9', recipientDisplayName: 'Rowan Example-Smith', versionNumber: 2, replacesPublicId: 'VM-AAAA-1111' })));
    api.replaceCredential.mockResolvedValue({ id: 'cred-9', publicId: 'VM-NEW-9', sourceRow: 1 });
    const user = userEvent.setup();
    renderPage(<CredentialDetailPage />, { api, ...route });
    await user.click(await screen.findByRole('button', { name: 'Replace' }));
    const dialog = screen.getByRole('dialog', { name: 'Replace this record' });
    const name = within(dialog).getByLabelText('Recipient name');
    expect(name).toHaveValue('Rowan Example');
    expect(within(dialog).getByLabelText('Recipient e-mail (optional)')).toHaveValue('rowan@example.org');
    await user.clear(name);
    await user.type(name, 'Rowan Example-Smith');
    await user.click(within(dialog).getByRole('button', { name: 'Issue replacement' }));
    const summary = within(dialog).getByRole('alert');
    expect(summary).toHaveTextContent('Enter the reason.');
    expect(api.replaceCredential).not.toHaveBeenCalled();
    // The dialog moves focus to the error summary on the next animation frame. Wait for it, as a person would:
    // typing before it lands sends the rest of the keystrokes to the summary (seen on slower Linux CI).
    await waitFor(() => expect(summary).toHaveFocus());
    await user.type(within(dialog).getByLabelText('Reason for replacing'), 'Name corrected');
    await user.click(within(dialog).getByRole('button', { name: 'Issue replacement' }));
    expect(api.replaceCredential).toHaveBeenCalledWith('org-1', 'cred-1', {
      reason: 'Name corrected', idempotencyKey: expect.any(String),
      replacement: { recipientDisplayName: 'Rowan Example-Smith', title: 'Community First Aid', achievement: 'Completed the 12-hour course.', recipientEmail: 'rowan@example.org' },
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Rowan Example-Smith' })).toBeInTheDocument();
    expect(api.getCredential).toHaveBeenLastCalledWith('org-1', 'cred-9');
    expect(screen.getByRole('status')).toHaveTextContent('Replacement issued as VM-NEW-9');
  });

  it('creates a recipient link once after confirmation and warns before regenerating', async () => {
    const api = createFakeApi();
    api.getCredential.mockResolvedValue(detail());
    api.createDeliveryLink.mockResolvedValueOnce({ token: 'secret-token-1', expiresAt: '2026-12-16T00:00:00Z' }).mockResolvedValueOnce({ token: 'secret-token-2', expiresAt: '2026-12-17T00:00:00Z' });
    const user = userEvent.setup();
    renderPage(<CredentialDetailPage />, { api, ...route });
    await user.click(await screen.findByRole('button', { name: 'Create recipient link' }));
    const dialog = screen.getByRole('dialog', { name: 'Create a recipient link?' });
    expect(dialog).toHaveTextContent('disables any earlier link');
    expect(api.createDeliveryLink).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Create link' }));
    expect(api.createDeliveryLink).toHaveBeenCalledWith('org-1', 'cred-1');
    expect(await screen.findByLabelText('Private recipient link')).toHaveValue(`${window.location.origin}/receive#secret-token-1`);
    expect(screen.getByText('This link is shown only once.')).toBeInTheDocument();
    // The same-tab shortcut exists only for the demonstration; a real issuer sends the link to someone else.
    expect(screen.queryByRole('link', { name: 'Open recipient view' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create a new recipient link' }));
    const again = screen.getByRole('dialog', { name: 'Create a new recipient link?' });
    await user.click(within(again).getByRole('button', { name: 'Cancel' }));
    expect(api.createDeliveryLink).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Create a new recipient link' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(screen.getByLabelText('Private recipient link')).toHaveValue(`${window.location.origin}/receive#secret-token-2`));
    expect(screen.queryByDisplayValue(/secret-token-1/)).not.toBeInTheDocument();
  });

  it('downloads the certificate PDF and reports failure without leaving the page', async () => {
    const api = createFakeApi();
    api.getCredential.mockResolvedValue(detail());
    URL.createObjectURL = vi.fn(() => 'blob:pdf');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPdf.mockResolvedValueOnce(new Uint8Array([37, 80, 68, 70])).mockRejectedValueOnce(new Error('font missing'));
    const user = userEvent.setup();
    renderPage(<CredentialDetailPage />, { api, ...route });
    await user.click(await screen.findByRole('button', { name: 'Download certificate (PDF)' }));
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({ publicId: 'VM-AAAA-1111', verifyUrl: 'https://verimark.example/verify/VM-AAAA-1111', template: detail().template }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Download certificate (PDF)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be prepared');
    expect(screen.queryByText(/font missing/)).not.toBeInTheDocument();
    click.mockRestore();
  });

  it('hides lifecycle actions for revoked records', async () => {
    const api = createFakeApi();
    api.getCredential.mockResolvedValue(detail({ status: 'revoked' }));
    renderPage(<CredentialDetailPage />, { api, ...route });
    expect(await screen.findByText(/It can no longer be revoked, replaced or shared/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke|Replace|recipient link/ })).not.toBeInTheDocument();
  });
});
