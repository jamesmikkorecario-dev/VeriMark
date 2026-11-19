import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Member, type Organization, type ReviewQueueItem } from '../../lib/api/types';
import { createFakeApi, membership, organization, renderApp, signedInApi, stubBrowser, user } from '../auth/testing/fakeApi';
import { resetDemoData } from '../../lib/api/demo/reset';

vi.mock('../../lib/api/demo/reset', () => ({ resetDemoData: vi.fn(), DEMO_ENTRY_PATH: '/demo' }));

beforeEach(() => { stubBrowser(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const location = () => screen.getByTestId('location').textContent;
const sidebar = () => within(document.querySelector('aside.sidebar') as HTMLElement);
const members: Member[] = [
  { userId: user.id, displayName: user.displayName, role: 'owner', joinedAt: '2026-01-02T00:00:00.000Z' },
  { userId: 'u2', displayName: 'Sam Second', role: 'viewer', joinedAt: '2026-02-02T00:00:00.000Z' },
];

describe('workspace shell', () => {
  it('hides issuing from viewers and platform review from non-admins', async () => {
    renderApp('/app/organization', signedInApi('viewer', { listMembers: async () => members }));
    await screen.findByRole('heading', { level: 1, name: organization.displayName });
    const nav = sidebar().getByRole('navigation', { name: 'Workspace' });
    expect(within(nav).getByRole('link', { name: 'Credentials' })).toHaveAttribute('href', '/app/credentials');
    expect(within(nav).queryByRole('link', { name: 'Issue credentials' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Platform review' })).toBeNull();
  });

  it('shows issuing to issuers and review to platform admins', async () => {
    renderApp('/app/organization', signedInApi('issuer', { isPlatformAdmin: async () => true, listMembers: async () => members }));
    await screen.findByRole('heading', { level: 1, name: organization.displayName });
    const nav = sidebar().getByRole('navigation', { name: 'Workspace' });
    expect(within(nav).getByRole('link', { name: 'Issue credentials' })).toHaveAttribute('href', '/app/issue');
    expect(within(nav).getByRole('link', { name: 'Platform review' })).toHaveAttribute('href', '/app/review');
  });

  it('sends users without a membership to onboarding, which creates an organization and opens it', async () => {
    const created: Organization = { ...organization, id: 'org-new', displayName: 'New Circle', reviewState: 'pending', revision: 1 };
    let memberships: ReturnType<typeof membership>[] = [];
    const api = signedInApi(null, {
      listMemberships: async () => memberships,
      createOrganization: async name => { memberships = [membership('owner', { ...created, displayName: name })]; return { ...created, displayName: name }; },
      getOrganization: async () => created,
    });
    renderApp('/app/credentials', api);
    await waitFor(() => expect(location()).toBe('/app/onboarding'));
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Create organization' }));
    expect(screen.getAllByText('Enter the organization name.').length).toBeGreaterThan(0);
    expect(api.createOrganization).not.toHaveBeenCalled();
    await ui.type(screen.getByLabelText('Organization name'), '  New Circle ');
    await ui.click(screen.getByRole('button', { name: 'Create organization' }));
    await waitFor(() => expect(location()).toBe('/app'));
    expect(api.createOrganization).toHaveBeenCalledWith('New Circle');
    expect(await screen.findByText(/review pending\./i)).toBeInTheDocument();
  });

  it('lets an admin without a membership reach platform review', async () => {
    const api = signedInApi(null, { isPlatformAdmin: async () => true, listReviewQueue: async () => [] });
    renderApp('/app/review', api);
    expect(await screen.findByRole('heading', { level: 1, name: 'Organization review' })).toBeInTheDocument();
    expect(location()).toBe('/app/review');
  });

  it('sends an admin without a membership to platform review, not onboarding', async () => {
    const api = signedInApi(null, { isPlatformAdmin: async () => true, listReviewQueue: async () => [] });
    renderApp('/app/credentials', api);
    await waitFor(() => expect(location()).toBe('/app/review'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Organization review' })).toBeInTheDocument();
  });

  it('switches organization, persists the choice for the session and clears it on sign-out', async () => {
    const second: Organization = { ...organization, id: 'org2', displayName: 'Second Guild' };
    const api = signedInApi('owner', {
      listMemberships: async () => [membership('owner'), membership('viewer', second)],
      getOrganization: async id => (id === 'org2' ? second : organization),
      listMembers: async () => members, listInvites: async () => [],
    });
    renderApp('/app/organization', api);
    await screen.findByRole('heading', { level: 1, name: organization.displayName });
    const ui = userEvent.setup();
    await ui.selectOptions(sidebar().getByLabelText('Switch organization'), 'org2');
    await waitFor(() => expect(location()).toBe('/app'));
    expect(JSON.parse(sessionStorage.getItem('verimark.activeOrganization')!)).toEqual({ userId: user.id, organizationId: 'org2' });
    await waitFor(() => expect(sidebar().getByText('Second Guild', { selector: 'strong' })).toBeInTheDocument());
    await ui.click(sidebar().getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(location()).toBe('/sign-in'));
    expect(api.signOut).toHaveBeenCalled();
    expect(sessionStorage.getItem('verimark.activeOrganization')).toBeNull();
  });

  it('labels demo mode as fictional', async () => {
    renderApp('/app/organization', signedInApi('viewer', { listMembers: async () => members }, 'demo'));
    await screen.findByRole('heading', { level: 1, name: organization.displayName });
    expect(screen.getByText('DEMONSTRATION — FICTIONAL DATA · NOTHING HERE IS REAL')).toBeInTheDocument();
  });

  it('offers a confirmed "Reset demo data" in the demo banner only', async () => {
    const ui = userEvent.setup();
    renderApp('/app/organization', signedInApi('viewer', { listMembers: async () => members }, 'demo'));
    await screen.findByRole('heading', { level: 1, name: organization.displayName });
    const banner = screen.getByText('DEMONSTRATION — FICTIONAL DATA · NOTHING HERE IS REAL').parentElement as HTMLElement;
    await ui.click(within(banner).getByRole('button', { name: 'Reset demo data' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset the demo data?' });
    expect(resetDemoData).not.toHaveBeenCalled();
    await ui.click(within(dialog).getByRole('button', { name: 'Keep my changes' }));
    expect(resetDemoData).not.toHaveBeenCalled();
    await ui.click(within(banner).getByRole('button', { name: 'Reset demo data' }));
    await ui.click(within(screen.getByRole('dialog', { name: 'Reset the demo data?' })).getByRole('button', { name: 'Yes, reset everything' }));
    expect(resetDemoData).toHaveBeenCalledTimes(1);
  });

  it('has no reset control outside demo mode', async () => {
    renderApp('/app/organization', signedInApi('viewer', { listMembers: async () => members }));
    await screen.findByRole('heading', { level: 1, name: organization.displayName });
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).toBeNull();
  });

  it('shows a retryable error when the workspace cannot load', async () => {
    let fail = true;
    const api = signedInApi('viewer', { listMemberships: async () => { if (fail) throw new ApiError('TEMPORARILY_UNAVAILABLE', 'pg down'); return [membership('viewer')]; }, listMembers: async () => members });
    renderApp('/app/organization', api);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.queryByText('pg down')).toBeNull();
    fail = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('heading', { level: 1, name: organization.displayName })).toBeInTheDocument();
  });
});

describe('organization page', () => {
  it('gives viewers read-only content and never loads invitations', async () => {
    const api = signedInApi('viewer', { listMembers: async () => members });
    renderApp('/app/organization', api);
    expect(await screen.findByText('Sam Second')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Role for/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Invitations' })).toBeNull();
    expect(screen.getByText('Only owners can rename the organization or manage members.')).toBeInTheDocument();
    expect(api.listInvites).not.toHaveBeenCalled();
    expect(screen.getAllByText(/identity check, not accreditation/).length).toBeGreaterThan(0);
  });

  it('renames with the expected revision and handles a conflict', async () => {
    let current = organization;
    const api = signedInApi('owner', {
      getOrganization: async () => current,
      listMembers: async () => members, listInvites: async () => [],
      renameOrganization: async () => { current = { ...organization, displayName: 'Changed Elsewhere', revision: 4 }; throw new ApiError('REVISION_CONFLICT', 'stale'); },
    });
    renderApp('/app/organization', api);
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Organization name');
    await ui.clear(input);
    await ui.type(input, 'Better Name');
    await ui.click(screen.getByRole('button', { name: 'Save name' }));
    expect(api.renameOrganization).toHaveBeenCalledWith('org1', { displayName: 'Better Name', expectedRevision: 3 });
    expect(await screen.findByText(/Someone else changed this organization/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Changed Elsewhere' })).toBeInTheDocument();
  });

  it('surfaces last-owner protection when an owner tries to demote themselves', async () => {
    const api = signedInApi('owner', {
      listMembers: async () => members, listInvites: async () => [],
      setMemberRole: async () => { throw new ApiError('INVALID_TRANSITION', 'last owner'); },
    });
    renderApp('/app/organization', api);
    const ui = userEvent.setup();
    const row = (await screen.findByText(`${user.displayName} (you)`)).closest('li')!;
    await ui.selectOptions(within(row).getByLabelText(`Role for ${user.displayName}`), 'viewer');
    await ui.click(within(row).getByRole('button', { name: 'Save role' }));
    expect(await screen.findByText(/must always have at least one owner/)).toBeInTheDocument();
    expect(api.setMemberRole).toHaveBeenCalledWith('org1', user.id, 'viewer');
  });

  it('removes a member only after confirmation', async () => {
    const api = signedInApi('owner', { listMembers: async () => members, listInvites: async () => [], removeMember: async () => {} });
    renderApp('/app/organization', api);
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Remove Sam Second' }));
    expect(api.removeMember).not.toHaveBeenCalled();
    await ui.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('org1', 'u2'));
    expect(await screen.findByText('Sam Second was removed.')).toBeInTheDocument();
  });

  it('creates an invitation and shows its one-time link once', async () => {
    const token = 'T'.repeat(43);
    const api = signedInApi('owner', {
      listMembers: async () => members, listInvites: async () => [],
      inviteMember: async (_org, input) => ({ id: 'i1', email: input.email, role: input.role, token, createdAt: '2026-11-16T00:00:00Z', expiresAt: '2026-11-23T00:00:00Z' }),
    });
    renderApp('/app/organization', api);
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Create invitation' }));
    expect(screen.getAllByText('Enter the email address to invite.').length).toBeGreaterThan(0);
    await ui.type(screen.getByLabelText('Email address'), 'new@example.test');
    await ui.selectOptions(screen.getByLabelText('Role'), 'issuer');
    await ui.click(screen.getByRole('button', { name: 'Create invitation' }));
    expect(api.inviteMember).toHaveBeenCalledWith('org1', { email: 'new@example.test', role: 'issuer' });
    expect(await screen.findByLabelText('Invitation link')).toHaveValue(`${window.location.origin}/invite#${token}`);
    expect(screen.getByText('Copy this link now. It will not be shown again.')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'I have saved the link' }));
    expect(screen.queryByDisplayValue(new RegExp(token))).toBeNull();
    expect(document.body.textContent).not.toContain(token);
  });

  it('lists and withdraws pending invitations', async () => {
    let invites = [{ id: 'i1', email: 'pending@example.test', role: 'viewer' as const, createdAt: '2026-11-16T00:00:00Z', expiresAt: '2026-11-23T00:00:00Z' }];
    const api = signedInApi('owner', { listMembers: async () => members, listInvites: async () => invites, revokeInvite: async () => { invites = []; } });
    renderApp('/app/organization', api);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Withdraw invitation for pending@example.test' }));
    expect(api.revokeInvite).toHaveBeenCalledWith('org1', 'i1');
    expect(await screen.findByText('No pending invitations.')).toBeInTheDocument();
  });
});

describe('platform review', () => {
  it('denies non-admins without loading the queue', async () => {
    const api = signedInApi('owner');
    renderApp('/app/review', api);
    expect(await screen.findByRole('heading', { name: 'Platform review is restricted' })).toBeInTheDocument();
    expect(api.listReviewQueue).not.toHaveBeenCalled();
  });

  it('requires a private reason and records the outcome with the expected revision', async () => {
    let queue: ReviewQueueItem[] = [{ organizationId: 'org9', displayName: 'Pending Guild', reviewState: 'pending', revision: 2, createdAt: '2026-11-01T00:00:00Z', lastReviewAt: null }];
    const api = signedInApi(null, {
      isPlatformAdmin: async () => true,
      listReviewQueue: async () => queue,
      recordIssuerReview: async () => { queue = [{ ...queue[0], reviewState: 'reviewed', revision: 3 }]; },
    });
    renderApp('/app/review', api);
    const ui = userEvent.setup();
    const form = await screen.findByRole('form', { name: 'Record review for Pending Guild' });
    await ui.click(within(form).getByRole('button', { name: 'Record decision' }));
    expect(within(form).getAllByText('Enter a private reason for this decision.').length).toBeGreaterThan(0);
    expect(api.recordIssuerReview).not.toHaveBeenCalled();
    await ui.type(within(form).getByLabelText('Private reason'), 'Checked registration documents');
    await ui.click(within(form).getByRole('button', { name: 'Record decision' }));
    expect(api.recordIssuerReview).toHaveBeenCalledWith({ organizationId: 'org9', outcome: 'reviewed', reason: 'Checked registration documents', expectedRevision: 2 });
    expect(await screen.findByText('Pending Guild: reviewed recorded.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Awaiting review (0)' })).toBeInTheDocument();
  });

  it('shows an error with retry when the queue fails', async () => {
    let fail = true;
    const api = createFakeApi({
      getSession: async () => user, listMemberships: async () => [], isPlatformAdmin: async () => true,
      listReviewQueue: async () => { if (fail) throw new ApiError('INTERNAL_ERROR', 'boom'); return []; },
    });
    renderApp('/app/review', api);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    fail = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('heading', { name: 'Nothing is waiting' })).toBeInTheDocument();
  });
});
