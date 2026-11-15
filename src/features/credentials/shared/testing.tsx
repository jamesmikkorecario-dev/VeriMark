// Test-only helpers for FS-C pages: a hand-written fake VeriMarkApi and a workspace wrapper. Never imported by app code.
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { ApiProvider } from '../../../lib/api/context';
import { ApiError, type CredentialDetail, type CredentialSummary, type ReviewState, type Role, type Template, type VeriMarkApi } from '../../../lib/api/types';
import { WorkspaceContext, type Workspace } from '../../organizations/WorkspaceContext';

type FakeApi = { -readonly [K in keyof VeriMarkApi]: VeriMarkApi[K] extends (...args: infer A) => infer R ? Mock<(...args: A) => R> : VeriMarkApi[K] };

const methods: Array<Exclude<keyof VeriMarkApi, 'mode'>> = [
  'getSession', 'onAuthChange', 'signIn', 'signUp', 'signOut', 'requestPasswordReset', 'updatePassword',
  'listMemberships', 'createOrganization', 'getOrganization', 'renameOrganization', 'listMembers', 'setMemberRole', 'removeMember',
  'listInvites', 'inviteMember', 'revokeInvite', 'acceptInvite', 'isPlatformAdmin', 'listReviewQueue', 'recordIssuerReview',
  'listTemplates', 'saveTemplate', 'archiveTemplate', 'createBatch', 'previewBatch', 'approveBatch', 'issueBatch',
  'listCredentials', 'getCredential', 'revokeCredential', 'replaceCredential', 'createDeliveryLink', 'listAudit', 'getMetrics',
  'verifyCredential', 'exchangeDelivery',
];

/** Every method rejects with INTERNAL_ERROR unless a test sets an implementation. */
export function createFakeApi(mode: VeriMarkApi['mode'] = 'supabase'): FakeApi {
  const api = { mode } as Record<string, unknown>;
  for (const name of methods) api[name] = vi.fn(() => Promise.reject(new ApiError('INTERNAL_ERROR', `unexpected call: ${name}`)));
  return api as unknown as FakeApi;
}

export function makeWorkspace({ role = 'owner', reviewState = 'reviewed' }: { role?: Role; reviewState?: ReviewState } = {}): Workspace {
  return {
    user: { id: 'user-1', email: 'mika@example.org', displayName: 'Mika Fictional' },
    membership: { organizationId: 'org-1', organizationName: 'Riverside Learning Co-op', role, reviewState },
    organization: { id: 'org-1', displayName: 'Riverside Learning Co-op', reviewState, revision: 3, createdAt: '2026-01-10T09:00:00Z' },
    canIssue: role !== 'viewer',
    refresh: vi.fn(() => Promise.resolve()),
  };
}

export function renderPage(ui: ReactElement, { api, workspace = makeWorkspace(), path = '/', route = '*', extraRoutes = [] }: { api: FakeApi; workspace?: Workspace; path?: string; route?: string; extraRoutes?: Array<{ path: string; element: ReactElement }> }) {
  return render(<ApiProvider api={api as unknown as VeriMarkApi}>
    <WorkspaceContext.Provider value={workspace}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
          {extraRoutes.map(extra => <Route key={extra.path} path={extra.path} element={extra.element} />)}
        </Routes>
      </MemoryRouter>
    </WorkspaceContext.Provider>
  </ApiProvider>);
}

/** jsdom lacks a full <dialog> implementation; this mirrors the modal behaviour the pages rely on. */
export function installDialogPolyfill() {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { __fsc?: boolean };
  if (proto.__fsc) return;
  proto.__fsc = true;
  proto.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  proto.close = function close(this: HTMLDialogElement) { if (this.hasAttribute('open')) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } };
}

export const template = (overrides: Partial<Template> = {}): Template => ({
  id: 'tpl-1', organizationId: 'org-1', name: 'Course completion', revision: 2, archived: false, updatedAt: '2026-10-01T10:00:00Z',
  config: { heading: 'Certificate of Completion', bodyPrefix: 'This certifies that', signatoryName: 'Dana Placeholder', signatoryTitle: 'Programme Lead', accent: 'forest', orientation: 'landscape' },
  ...overrides,
});

export const summary = (overrides: Partial<CredentialSummary> = {}): CredentialSummary => ({
  id: 'cred-1', publicId: 'VM-AAAA-1111', recipientDisplayName: 'Rowan Example', title: 'Community First Aid', achievement: 'Completed the 12-hour course.',
  issuedAt: '2026-09-01T10:00:00Z', expiresAt: null, status: 'valid', versionNumber: 1, ...overrides,
});

export const detail = (overrides: Partial<CredentialDetail> = {}): CredentialDetail => ({
  ...summary(), issuerDisplayName: 'Riverside Learning Co-op', template: template().config,
  events: [{ id: 'ev-1', type: 'issued', at: '2026-09-01T10:00:00Z', actorDisplayName: 'Mika Fictional', reason: null }],
  replacedByPublicId: null, replacesPublicId: null, recipientEmail: 'rowan@example.org', ...overrides,
});

/** A promise whose resolution the test controls. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
