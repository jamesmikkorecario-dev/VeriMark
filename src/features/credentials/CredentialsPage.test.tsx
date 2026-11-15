import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api/types';
import CredentialsPage from './CredentialsPage';
import { createFakeApi, makeWorkspace, renderPage, summary } from './shared/testing';

describe('CredentialsPage', () => {
  it('lists records with status and paginates with the next cursor', async () => {
    const api = createFakeApi();
    api.listCredentials
      .mockResolvedValueOnce({ items: [summary(), summary({ id: 'cred-2', publicId: 'VM-2', recipientDisplayName: 'Sam Placeholder', status: 'revoked' })], nextCursor: 'c-2' })
      .mockResolvedValueOnce({ items: [summary({ id: 'cred-3', publicId: 'VM-3', recipientDisplayName: 'Ari Sample', status: 'expired' })], nextCursor: null });
    const user = userEvent.setup();
    renderPage(<CredentialsPage />, { api });
    const link = await screen.findByRole('link', { name: 'Rowan Example' });
    expect(link).toHaveAttribute('href', '/app/credentials/cred-1');
    expect(api.listCredentials).toHaveBeenCalledWith('org-1', { search: undefined, status: 'all', limit: 25 });
    expect(within(screen.getByRole('table')).getByText('Revoked')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('link', { name: 'Ari Sample' })).toBeInTheDocument();
    expect(api.listCredentials).toHaveBeenLastCalledWith('org-1', { search: undefined, status: 'all', cursor: 'c-2', limit: 25 });
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('debounces search and sends a single request for the final text', async () => {
    const api = createFakeApi();
    api.listCredentials.mockResolvedValue({ items: [summary()], nextCursor: null });
    const user = userEvent.setup();
    renderPage(<CredentialsPage />, { api });
    await screen.findByRole('link', { name: 'Rowan Example' });
    await user.type(screen.getByLabelText('Search records'), 'Rowan');
    await waitFor(() => expect(api.listCredentials).toHaveBeenCalledTimes(2));
    expect(api.listCredentials).toHaveBeenLastCalledWith('org-1', { search: 'Rowan', status: 'all', limit: 25 });
  });

  it('filters by status and distinguishes no results from no records', async () => {
    const api = createFakeApi();
    api.listCredentials.mockResolvedValueOnce({ items: [summary()], nextCursor: null }).mockResolvedValueOnce({ items: [], nextCursor: null }).mockResolvedValueOnce({ items: [summary()], nextCursor: null });
    const user = userEvent.setup();
    renderPage(<CredentialsPage />, { api });
    await screen.findByRole('link', { name: 'Rowan Example' });
    await user.selectOptions(screen.getByLabelText('Status'), 'revoked');
    expect(await screen.findByRole('heading', { name: 'No matching records' })).toBeInTheDocument();
    expect(api.listCredentials).toHaveBeenLastCalledWith('org-1', expect.objectContaining({ status: 'revoked' }));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('link', { name: 'Rowan Example' })).toBeInTheDocument();
  });

  it('shows an empty state with an issue action only for issuers', async () => {
    const api = createFakeApi();
    api.listCredentials.mockResolvedValue({ items: [], nextCursor: null });
    renderPage(<CredentialsPage />, { api });
    expect(await screen.findByRole('heading', { name: 'No records yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Issue your first credential' })).toHaveAttribute('href', '/app/issue');
  });

  it('hides issue actions from viewers', async () => {
    const api = createFakeApi();
    api.listCredentials.mockResolvedValue({ items: [], nextCursor: null });
    renderPage(<CredentialsPage />, { api, workspace: makeWorkspace({ role: 'viewer' }) });
    expect(await screen.findByRole('heading', { name: 'No records yet' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Issue/ })).not.toBeInTheDocument();
  });

  it('shows a friendly error with retry', async () => {
    const api = createFakeApi();
    api.listCredentials.mockRejectedValueOnce(new ApiError('RATE_LIMITED', 'too many', { retryAfterSeconds: 30 })).mockResolvedValueOnce({ items: [summary()], nextCursor: null });
    const user = userEvent.setup();
    renderPage(<CredentialsPage />, { api });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Please wait about 30 seconds and try again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Rowan Example' })).toBeInTheDocument();
  });

  it('reads an initial search from the URL', async () => {
    const api = createFakeApi();
    api.listCredentials.mockResolvedValue({ items: [summary()], nextCursor: null });
    renderPage(<CredentialsPage />, { api, path: '/app/credentials?search=VM-AAAA-1111' });
    await screen.findByRole('link', { name: 'Rowan Example' });
    expect(api.listCredentials).toHaveBeenCalledWith('org-1', expect.objectContaining({ search: 'VM-AAAA-1111' }));
    expect(screen.getByLabelText('Search records')).toHaveValue('VM-AAAA-1111');
  });
});
