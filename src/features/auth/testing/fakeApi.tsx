/* eslint-disable react-refresh/only-export-components -- test-only helpers, never hot-reloaded */
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { ApiProvider } from '../../../lib/api/context';
import type { Membership, Organization, SessionUser, VeriMarkApi } from '../../../lib/api/types';
import App from '../../../app/App';

/** Hand-written fake: every method rejects as an unexpected call unless the test supplies an implementation. */
export function createFakeApi(overrides: Partial<VeriMarkApi> = {}, mode: VeriMarkApi['mode'] = 'supabase'): VeriMarkApi {
  const methods = [
    'getSession', 'signIn', 'signUp', 'signOut', 'requestPasswordReset', 'updatePassword',
    'listMemberships', 'createOrganization', 'getOrganization', 'renameOrganization', 'listMembers', 'setMemberRole', 'removeMember',
    'listInvites', 'inviteMember', 'revokeInvite', 'acceptInvite', 'isPlatformAdmin', 'listReviewQueue', 'recordIssuerReview',
    'listTemplates', 'saveTemplate', 'archiveTemplate', 'createBatch', 'previewBatch', 'approveBatch', 'issueBatch',
    'listCredentials', 'getCredential', 'revokeCredential', 'replaceCredential', 'createDeliveryLink', 'listAudit', 'getMetrics',
    'verifyCredential', 'exchangeDelivery',
  ] as const;
  const api: Record<string, unknown> = { mode, onAuthChange: vi.fn(() => () => {}) };
  for (const name of methods) api[name] = vi.fn(() => Promise.reject(new Error(`unexpected call: ${name}`)));
  api.getSession = vi.fn(async () => null);
  for (const [name, impl] of Object.entries(overrides)) api[name] = typeof impl === 'function' ? vi.fn(impl as (...args: unknown[]) => unknown) : impl;
  return api as unknown as VeriMarkApi;
}

export const user: SessionUser = { id: 'u1', email: 'robin@example.test', displayName: 'Robin Example' };
export const organization: Organization = { id: 'org1', displayName: 'Example Learning Circle', reviewState: 'reviewed', revision: 3, createdAt: '2026-01-02T00:00:00.000Z' };
export const membership = (role: Membership['role'], org: Organization = organization): Membership => ({ organizationId: org.id, organizationName: org.displayName, role, reviewState: org.reviewState });

/** A signed-in account with one membership; override anything per test. */
export function signedInApi(role: Membership['role'] | null, overrides: Partial<VeriMarkApi> = {}, mode: VeriMarkApi['mode'] = 'supabase') {
  return createFakeApi({
    getSession: async () => user,
    listMemberships: async () => (role ? [membership(role)] : []),
    isPlatformAdmin: async () => false,
    getOrganization: async () => organization,
    signOut: async () => {},
    ...overrides,
  }, mode);
}

export function LocationProbe() {
  const location = useLocation();
  return <div hidden data-testid="location">{location.pathname}{location.search}</div>;
}

export function renderApp(path: string, api: VeriMarkApi) {
  return render(
    <ApiProvider api={api}>
      <MemoryRouter initialEntries={[path]}><App /><LocationProbe /></MemoryRouter>
    </ApiProvider>,
  );
}

/** Browser APIs that jsdom lacks but RouteEffects and the drawer use. */
export function stubBrowser() {
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false, addListener() {}, removeListener() {} }));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
}
