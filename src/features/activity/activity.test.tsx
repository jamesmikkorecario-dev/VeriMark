import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError, type OrganizationMetrics } from '../../lib/api/types';
import { createFakeApi, makeWorkspace, renderPage, summary } from '../credentials/shared/testing';
import ActivityPage from './ActivityPage';
import DashboardHome from './DashboardHome';

const metrics: OrganizationMetrics = { issued: 12, valid: 8, expired: 1, revoked: 2, replaced: 1, verificationChecks: 340 };

describe('ActivityPage', () => {
  it('shows entries in readable words and loads more with the cursor', async () => {
    const api = createFakeApi();
    api.listAudit
      .mockResolvedValueOnce({ items: [{ id: 'a1', at: '2026-11-15T09:30:00Z', actorDisplayName: 'Mika Fictional', action: 'credential.revoked', targetLabel: 'VM-AAAA-1111' }], nextCursor: 'n1' })
      .mockResolvedValueOnce({ items: [{ id: 'a2', at: '2026-11-14T09:30:00Z', actorDisplayName: 'Dana Placeholder', action: 'some_new_action', targetLabel: '' }], nextCursor: null });
    const user = userEvent.setup();
    renderPage(<ActivityPage />, { api });
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Revoked a credential')).toBeInTheDocument();
    expect(within(table).getByText('VM-AAAA-1111')).toBeInTheDocument();
    expect(api.listAudit).toHaveBeenCalledWith('org-1', { limit: 25 });
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await within(table).findByText('Some new action')).toBeInTheDocument();
    expect(api.listAudit).toHaveBeenLastCalledWith('org-1', { cursor: 'n1', limit: 25 });
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows empty and error states', async () => {
    const api = createFakeApi();
    api.listAudit.mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 'SQLSTATE 42P01')).mockResolvedValueOnce({ items: [], nextCursor: null });
    const user = userEvent.setup();
    renderPage(<ActivityPage />, { api, workspace: makeWorkspace({ role: 'viewer' }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'No activity yet' })).toBeInTheDocument();
  });
});

describe('DashboardHome', () => {
  it('shows honest metrics, recent records and issuer actions', async () => {
    const api = createFakeApi();
    api.getMetrics.mockResolvedValue(metrics);
    api.listCredentials.mockResolvedValue({ items: [summary(), summary({ id: 'cred-2', recipientDisplayName: 'Sam Placeholder', status: 'expired' })], nextCursor: 'x' });
    renderPage(<DashboardHome />, { api });
    expect(await screen.findByText('340')).toBeInTheDocument();
    expect(screen.getByText(/Not a count of unique people/)).toBeInTheDocument();
    expect(api.listCredentials).toHaveBeenCalledWith('org-1', { limit: 5 });
    expect(screen.getByRole('link', { name: 'Sam Placeholder' })).toHaveAttribute('href', '/app/credentials/cred-2');
    expect(screen.getByRole('link', { name: 'Issue credentials' })).toHaveAttribute('href', '/app/issue');
    expect(screen.getByRole('link', { name: 'Members and organization' })).toBeInTheDocument();
    expect(screen.queryByText(/Demonstration numbers/)).not.toBeInTheDocument();
  });

  it('labels demo numbers as fictional', async () => {
    const api = createFakeApi('demo');
    api.getMetrics.mockResolvedValue(metrics);
    api.listCredentials.mockResolvedValue({ items: [], nextCursor: null });
    renderPage(<DashboardHome />, { api });
    expect(await screen.findByText(/Demonstration numbers. They are fictional/)).toBeInTheDocument();
  });

  it('shows a pending review notice and no issue action while pending', async () => {
    const api = createFakeApi();
    api.getMetrics.mockResolvedValue({ ...metrics, issued: 0 });
    api.listCredentials.mockResolvedValue({ items: [], nextCursor: null });
    renderPage(<DashboardHome />, { api, workspace: makeWorkspace({ role: 'issuer', reviewState: 'pending' }) });
    expect(screen.getByRole('heading', { name: 'Your organization is awaiting review' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'No records yet' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Issue/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prepare templates' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Members and organization' })).not.toBeInTheDocument();
  });

  it('gives viewers read-only next steps and recovers from errors', async () => {
    const api = createFakeApi();
    api.getMetrics.mockRejectedValueOnce(new ApiError('TEMPORARILY_UNAVAILABLE', 'x')).mockResolvedValue(metrics);
    api.listCredentials.mockResolvedValue({ items: [], nextCursor: null });
    const user = userEvent.setup();
    renderPage(<DashboardHome />, { api, workspace: makeWorkspace({ role: 'viewer' }) });
    expect(screen.getByText('You have read-only access to this organization.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Issue|templates/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('340')).toBeInTheDocument();
  });
});
