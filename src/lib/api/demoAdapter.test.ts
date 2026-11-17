import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, type ApiErrorCode, type DraftRowInput, type VeriMarkApi } from './types';
import { createDemoApi, DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_PUBLIC_IDS, DEMO_STORAGE_KEY, statusOf } from './demoAdapter';

const FIELDWORK = 'org_demo_fieldwork';
const NORTHGATE = 'org_demo_northgate';
const TEMPLATE = 'tpl_demo_fieldwork';
const DAY = 86_400_000;

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

let storage: MemoryStorage;
let clock: Date;
const make = () => createDemoApi({ storage, now: () => clock });
let api: VeriMarkApi;

beforeEach(() => {
  storage = new MemoryStorage();
  clock = new Date('2026-11-16T12:00:00.000Z');
  api = make();
});

async function rejects(promise: Promise<unknown>, code: ApiErrorCode) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error, `expected ${code}`).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
  return error as ApiError;
}
const as = (who: 'owner' | 'issuer' | 'viewer' | 'admin' | 'north', target = api) => target.signIn(`${who}@demo.verimark.test`, DEMO_PASSWORD);
const row = (overrides: Partial<DraftRowInput> = {}): DraftRowInput => ({ recipientDisplayName: 'Robin Vale', title: 'Fictional Course', achievement: 'Completed a fictional course.', ...overrides });
async function issueOne(overrides: Partial<DraftRowInput> = {}, key = 'key-1') {
  const draft = await api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'single', rows: [row(overrides)] });
  const preview = await api.previewBatch(FIELDWORK, draft.batchId);
  const approval = await api.approveBatch(FIELDWORK, draft.batchId, { expectedRevision: draft.revision, previewDigest: preview.previewDigest });
  const result = await api.issueBatch(FIELDWORK, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: key });
  return { draft, preview, approval, result };
}

describe('seed and persistence', () => {
  it('exposes fixed fictional public ids in the required format and demo accounts', async () => {
    for (const id of Object.values(DEMO_PUBLIC_IDS)) expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(DEMO_ACCOUNTS.map(a => a.email)).toEqual(expect.arrayContaining(['owner@demo.verimark.test', 'issuer@demo.verimark.test', 'viewer@demo.verimark.test', 'admin@demo.verimark.test', 'north@demo.verimark.test']));
    expect((await api.verifyCredential(DEMO_PUBLIC_IDS.valid)).status).toBe('valid');
    expect((await api.verifyCredential(DEMO_PUBLIC_IDS.expired)).status).toBe('expired');
    expect((await api.verifyCredential(DEMO_PUBLIC_IDS.revoked)).status).toBe('revoked');
    const replaced = await api.verifyCredential(DEMO_PUBLIC_IDS.replaced);
    expect(replaced.status).toBe('replaced');
    expect(replaced.replacementPublicId).toBe(DEMO_PUBLIC_IDS.replacement);
    await as('owner');
    const page = await api.listCredentials(FIELDWORK, { limit: 100 });
    expect(page.items).toHaveLength(8);
  });

  it('keeps state across adapter instances (reload) using a versioned key', async () => {
    await as('owner');
    await api.createOrganization('Second Fictional Org');
    expect(storage.getItem(DEMO_STORAGE_KEY)).toContain('Second Fictional Org');
    const reloaded = make();
    expect((await reloaded.getSession())?.email).toBe('owner@demo.verimark.test');
    expect((await reloaded.listMemberships()).map(m => m.organizationName)).toContain('Second Fictional Org');
  });

  it.each(['{not json', JSON.stringify({ version: 99 }), JSON.stringify({ version: 1, seq: 1, sessionUserId: null })])('reseeds corrupt storage %s', async raw => {
    storage.setItem(DEMO_STORAGE_KEY, raw);
    const fresh = make();
    expect(await fresh.getSession()).toBeNull();
    expect((await fresh.verifyCredential(DEMO_PUBLIC_IDS.valid)).status).toBe('valid');
  });

  it('works without any storage', async () => {
    const memory = createDemoApi({ storage: null, now: () => clock });
    await memory.signIn('owner@demo.verimark.test', DEMO_PASSWORD);
    expect((await memory.listMemberships())[0].role).toBe('owner');
  });
});

describe('identity', () => {
  it('rejects bad credentials generically and notifies listeners on change', async () => {
    const seen: (string | null)[] = [];
    const stop = api.onAuthChange(user => seen.push(user?.email ?? null));
    await rejects(api.signIn('owner@demo.verimark.test', 'wrong-password'), 'UNAUTHENTICATED');
    await rejects(api.signIn('nobody@demo.verimark.test', DEMO_PASSWORD), 'UNAUTHENTICATED');
    await as('owner');
    await api.signOut();
    stop();
    await as('viewer');
    expect(seen).toEqual(['owner@demo.verimark.test', null]);
  });

  it('requires a session for private operations', async () => {
    await rejects(api.listMemberships(), 'UNAUTHENTICATED');
    await rejects(api.listCredentials(FIELDWORK), 'UNAUTHENTICATED');
    await rejects(api.updatePassword('another-password'), 'UNAUTHENTICATED');
  });

  it('signs up without confirmation, validates input and refuses a taken email', async () => {
    const error = await rejects(api.signUp({ email: 'bad', password: 'short', displayName: '' }), 'VALIDATION');
    expect(error.fields.map(f => `${f.field}:${f.code}`).sort()).toEqual(['displayName:REQUIRED', 'email:INVALID', 'password:TOO_SHORT']);
    expect(await api.signUp({ email: 'New@Example.test', password: 'long-enough-1', displayName: 'Casey New' })).toEqual({ needsEmailConfirmation: false });
    expect((await api.getSession())?.email).toBe('new@example.test');
    expect(await api.listMemberships()).toEqual([]);
    await rejects(api.signUp({ email: 'new@example.test', password: 'long-enough-1', displayName: 'Dup' }), 'VALIDATION');
  });

  it('password reset does not reveal whether an account exists; update password changes sign-in', async () => {
    await expect(api.requestPasswordReset('owner@demo.verimark.test')).resolves.toBeUndefined();
    await expect(api.requestPasswordReset('missing@demo.verimark.test')).resolves.toBeUndefined();
    await as('issuer');
    await rejects(api.updatePassword('short'), 'VALIDATION');
    await api.updatePassword('a-brand-new-password');
    await api.signOut();
    await rejects(as('issuer'), 'UNAUTHENTICATED');
    await expect(api.signIn('issuer@demo.verimark.test', 'a-brand-new-password')).resolves.toMatchObject({ displayName: 'Sam Okafor' });
  });
});

describe('tenant separation and roles', () => {
  it('returns NOT_FOUND for organizations the user does not belong to', async () => {
    await as('north');
    for (const call of [
      api.getOrganization(FIELDWORK), api.listMembers(FIELDWORK), api.listCredentials(FIELDWORK), api.listTemplates(FIELDWORK),
      api.getCredential(FIELDWORK, 'cred_demo_valid'), api.listAudit(FIELDWORK), api.getMetrics(FIELDWORK),
      api.renameOrganization(FIELDWORK, { displayName: 'Taken', expectedRevision: 2 }),
    ]) await rejects(call, 'NOT_FOUND');
    await as('owner');
    await rejects(api.getOrganization(NORTHGATE), 'NOT_FOUND');
    await rejects(api.getCredential(FIELDWORK, 'does-not-exist'), 'NOT_FOUND');
  });

  it('forbids viewers from writing and non-owners from managing members, invites and the name', async () => {
    await as('viewer');
    await rejects(api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'single', rows: [row()] }), 'FORBIDDEN');
    await rejects(api.revokeCredential(FIELDWORK, 'cred_demo_valid', { reason: 'x', idempotencyKey: 'k' }), 'FORBIDDEN');
    await rejects(api.createDeliveryLink(FIELDWORK, 'cred_demo_valid'), 'FORBIDDEN');
    await rejects(api.saveTemplate(FIELDWORK, { name: 'n', config: (await api.listTemplates(FIELDWORK))[0].config }), 'FORBIDDEN');
    expect((await api.getCredential(FIELDWORK, 'cred_demo_valid')).recipientEmail).toBeNull();
    await as('issuer');
    expect((await api.getCredential(FIELDWORK, 'cred_demo_valid')).recipientEmail).toBe('alex@example.test');
    await rejects(api.renameOrganization(FIELDWORK, { displayName: 'New', expectedRevision: 2 }), 'FORBIDDEN');
    await rejects(api.inviteMember(FIELDWORK, { email: 'x@example.test', role: 'viewer' }), 'FORBIDDEN');
    await rejects(api.listInvites(FIELDWORK), 'FORBIDDEN');
    await rejects(api.setMemberRole(FIELDWORK, 'user_demo_viewer', 'issuer'), 'FORBIDDEN');
    await rejects(api.removeMember(FIELDWORK, 'user_demo_viewer'), 'FORBIDDEN');
  });

  it('renames with an expected revision and reports conflicts', async () => {
    await as('owner');
    const org = await api.getOrganization(FIELDWORK);
    const renamed = await api.renameOrganization(FIELDWORK, { displayName: '  Fieldwork Commons  ', expectedRevision: org.revision });
    expect(renamed).toMatchObject({ displayName: 'Fieldwork Commons', revision: org.revision + 1 });
    await rejects(api.renameOrganization(FIELDWORK, { displayName: 'Stale', expectedRevision: org.revision }), 'REVISION_CONFLICT');
    await rejects(api.renameOrganization(FIELDWORK, { displayName: 'x'.repeat(121), expectedRevision: renamed.revision }), 'VALIDATION');
  });

  it('keeps the issuer name issued records were signed with after a rename, like the database snapshot', async () => {
    await as('issuer');
    const issued = (await issueOne()).result.credentials[0];
    const link = await api.createDeliveryLink(FIELDWORK, issued.id);
    await as('owner');
    const org = await api.getOrganization(FIELDWORK);
    await api.renameOrganization(FIELDWORK, { displayName: 'Fieldwork Commons', expectedRevision: org.revision });
    expect((await api.getCredential(FIELDWORK, issued.id)).issuerDisplayName).toBe('Fieldwork Collective');
    expect((await api.verifyCredential(issued.publicId)).issuer.displayName).toBe('Fieldwork Collective');
    expect((await api.exchangeDelivery(link.token)).issuerDisplayName).toBe('Fieldwork Collective');
    await as('issuer');
    const after = (await issueOne({ recipientDisplayName: 'After Rename' }, 'key-2')).result.credentials[0];
    expect((await api.getCredential(FIELDWORK, after.id)).issuerDisplayName).toBe('Fieldwork Commons');
  });

  it('protects the last owner from demotion and removal', async () => {
    await as('owner');
    await rejects(api.setMemberRole(FIELDWORK, 'user_demo_owner', 'issuer'), 'INVALID_TRANSITION');
    await rejects(api.removeMember(FIELDWORK, 'user_demo_owner'), 'INVALID_TRANSITION');
    await api.setMemberRole(FIELDWORK, 'user_demo_issuer', 'owner');
    await api.setMemberRole(FIELDWORK, 'user_demo_owner', 'viewer');
    expect((await api.listMemberships())[0].role).toBe('viewer');
    await rejects(api.removeMember(FIELDWORK, 'user_demo_issuer'), 'FORBIDDEN');
  });

  it('creates an organization owned by the creator in pending review', async () => {
    await as('admin');
    expect(await api.listMemberships()).toEqual([]);
    const org = await api.createOrganization('Harbour Learning Circle');
    expect(org.reviewState).toBe('pending');
    expect(await api.listMemberships()).toEqual([{ organizationId: org.id, organizationName: 'Harbour Learning Circle', role: 'owner', reviewState: 'pending' }]);
    await rejects(api.createOrganization('   '), 'VALIDATION');
  });
});

describe('invitations', () => {
  it('issues a 43-character single-use token bound to the invited email and stores only a hash', async () => {
    await as('owner');
    const invite = await api.inviteMember(FIELDWORK, { email: 'Casey@Example.test', role: 'issuer' });
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invite.email).toBe('casey@example.test');
    expect(new Date(invite.expiresAt).getTime() - clock.getTime()).toBe(7 * DAY);
    expect(storage.getItem(DEMO_STORAGE_KEY)).not.toContain(invite.token);
    expect((await api.listInvites(FIELDWORK)).map(i => i.id)).toEqual([invite.id]);

    await as('viewer');
    await rejects(api.acceptInvite(invite.token), 'NOT_FOUND');
    await api.signUp({ email: 'casey@example.test', password: 'casey-password', displayName: 'Casey Fictional' });
    await rejects(api.acceptInvite('not-a-token'), 'NOT_FOUND');
    expect(await api.acceptInvite(invite.token)).toEqual({ organizationId: FIELDWORK, organizationName: 'Fieldwork Collective', role: 'issuer', reviewState: 'reviewed' });
    await rejects(api.acceptInvite(invite.token), 'NOT_FOUND');
    await as('owner');
    expect(await api.listInvites(FIELDWORK)).toEqual([]);
  });

  it('rejects expired and revoked invitations identically', async () => {
    await as('owner');
    const expiring = await api.inviteMember(FIELDWORK, { email: 'late@example.test', role: 'viewer' });
    const revoked = await api.inviteMember(FIELDWORK, { email: 'gone@example.test', role: 'viewer' });
    await api.revokeInvite(FIELDWORK, revoked.id);
    await api.signUp({ email: 'gone@example.test', password: 'gone-password', displayName: 'Gone' });
    await rejects(api.acceptInvite(revoked.token), 'NOT_FOUND');
    await api.signUp({ email: 'late@example.test', password: 'late-password', displayName: 'Late' });
    clock = new Date(clock.getTime() + 7 * DAY);
    await rejects(api.acceptInvite(expiring.token), 'NOT_FOUND');
  });

  it('validates invitations and supersedes an earlier pending invite for the same email', async () => {
    await as('owner');
    await rejects(api.inviteMember(FIELDWORK, { email: 'viewer@demo.verimark.test', role: 'viewer' }), 'VALIDATION');
    await rejects(api.inviteMember(FIELDWORK, { email: 'x@example.test', role: 'owner' as 'viewer' }), 'VALIDATION');
    const first = await api.inviteMember(FIELDWORK, { email: 'twice@example.test', role: 'viewer' });
    const second = await api.inviteMember(FIELDWORK, { email: 'twice@example.test', role: 'issuer' });
    expect((await api.listInvites(FIELDWORK)).map(i => i.id)).toEqual([second.id]);
    await api.signUp({ email: 'twice@example.test', password: 'twice-password', displayName: 'Twice' });
    await rejects(api.acceptInvite(first.token), 'NOT_FOUND');
    expect((await api.acceptInvite(second.token)).role).toBe('issuer');
  });
});

describe('platform review', () => {
  it('only platform admins see the queue and record reviews with a reason and revision', async () => {
    await as('owner');
    expect(await api.isPlatformAdmin()).toBe(false);
    await rejects(api.listReviewQueue(), 'FORBIDDEN');
    await rejects(api.recordIssuerReview({ organizationId: NORTHGATE, outcome: 'reviewed', reason: 'ok', expectedRevision: 1 }), 'FORBIDDEN');
    await as('admin');
    expect(await api.isPlatformAdmin()).toBe(true);
    const queue = await api.listReviewQueue();
    expect(queue[0]).toMatchObject({ organizationId: NORTHGATE, reviewState: 'pending' });
    await rejects(api.recordIssuerReview({ organizationId: NORTHGATE, outcome: 'reviewed', reason: ' ', expectedRevision: 1 }), 'VALIDATION');
    await rejects(api.recordIssuerReview({ organizationId: NORTHGATE, outcome: 'reviewed', reason: 'Checked', expectedRevision: 0 }), 'REVISION_CONFLICT');
    await api.recordIssuerReview({ organizationId: NORTHGATE, outcome: 'reviewed', reason: 'Fictional identity check', expectedRevision: 1 });
    expect((await api.listReviewQueue()).find(q => q.organizationId === NORTHGATE)).toMatchObject({ reviewState: 'reviewed', revision: 2 });
    await as('north');
    const audit = await api.listAudit(NORTHGATE);
    expect(JSON.stringify(audit)).not.toContain('Fictional identity check');
  });
});

describe('issuance', () => {
  beforeEach(async () => { await as('issuer'); });

  it('validates every row before creating anything', async () => {
    const error = await rejects(api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'csv', rows: [
      row(), row({ recipientDisplayName: '' }), row({ recipientDisplayName: 'B', title: 'x'.repeat(201) }), row({ recipientDisplayName: 'C', achievement: 'y'.repeat(2001) }),
      row({ recipientDisplayName: 'D', recipientEmail: 'nope' }), row({ recipientDisplayName: 'E', expiresOn: '2026-11-15' }), row({ recipientDisplayName: 'F', expiresOn: '2026-02-30' }), row(),
    ] }), 'VALIDATION');
    expect(error.fields).toEqual([
      { field: 'recipientDisplayName', code: 'REQUIRED', row: 2 },
      { field: 'title', code: 'TOO_LONG', row: 3 },
      { field: 'achievement', code: 'TOO_LONG', row: 4 },
      { field: 'recipientEmail', code: 'INVALID', row: 5 },
      { field: 'expiresOn', code: 'PAST_DATE', row: 6 },
      { field: 'expiresOn', code: 'INVALID', row: 7 },
      { field: 'recipientDisplayName', code: 'DUPLICATE', row: 8 },
    ]);
    await rejects(api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'csv', rows: [] }), 'VALIDATION');
    await rejects(api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'csv', rows: Array.from({ length: 201 }, (_, i) => row({ recipientDisplayName: `R${i}` })) }), 'VALIDATION');
    await rejects(api.createBatch(FIELDWORK, { templateId: 'tpl_demo_northgate', source: 'single', rows: [row()] }), 'NOT_FOUND');
    expect((await api.getMetrics(FIELDWORK)).issued).toBe(8);
  });

  it('produces a deterministic digest tied to rows and template revision', async () => {
    const a = await api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'single', rows: [row({ recipientDisplayName: '  Robin Vale ' })] });
    const b = await api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'single', rows: [row()] });
    const c = await api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'single', rows: [row({ title: 'Other' })] });
    const [pa, pb, pc] = await Promise.all([a, b, c].map(d => api.previewBatch(FIELDWORK, d.batchId)));
    expect(pa.previewDigest).toBe(pb.previewDigest);
    expect(pa.previewDigest).not.toBe(pc.previewDigest);
    const template = (await api.listTemplates(FIELDWORK))[0];
    await api.saveTemplate(FIELDWORK, { id: template.id, name: template.name, config: { ...template.config, heading: 'Changed' }, expectedRevision: template.revision });
    expect((await api.previewBatch(FIELDWORK, a.batchId)).previewDigest).not.toBe(pa.previewDigest);
  });

  it('requires approval of the exact digest and revision', async () => {
    const draft = await api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'single', rows: [row()] });
    const preview = await api.previewBatch(FIELDWORK, draft.batchId);
    await rejects(api.approveBatch(FIELDWORK, draft.batchId, { expectedRevision: 2, previewDigest: preview.previewDigest }), 'REVISION_CONFLICT');
    await rejects(api.approveBatch(FIELDWORK, draft.batchId, { expectedRevision: 1, previewDigest: 'f'.repeat(64) }), 'REVISION_CONFLICT');
    await rejects(api.issueBatch(FIELDWORK, draft.batchId, { approvalId: 'none', idempotencyKey: 'k' }), 'APPROVAL_REQUIRED');
    const approval = await api.approveBatch(FIELDWORK, draft.batchId, { expectedRevision: 1, previewDigest: preview.previewDigest });
    const template = (await api.listTemplates(FIELDWORK))[0];
    await api.saveTemplate(FIELDWORK, { id: template.id, name: template.name, config: { ...template.config, signatoryTitle: 'Changed' }, expectedRevision: template.revision });
    await rejects(api.issueBatch(FIELDWORK, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: 'k' }), 'REVISION_CONFLICT');
  });

  it('issues atomically and idempotently with 22-character public ids', async () => {
    const { draft, approval, result } = await issueOne({ expiresOn: '2027-01-31' });
    expect(result.credentials).toHaveLength(1);
    expect(result.credentials[0].publicId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const again = await api.issueBatch(FIELDWORK, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: 'key-1' });
    expect(again).toEqual(result);
    await rejects(api.issueBatch(FIELDWORK, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: 'key-2' }), 'INVALID_TRANSITION');
    await rejects(api.approveBatch(FIELDWORK, draft.batchId, { expectedRevision: 1, previewDigest: 'x' }), 'INVALID_TRANSITION');
    const other = await api.createBatch(FIELDWORK, { templateId: TEMPLATE, source: 'single', rows: [row({ recipientDisplayName: 'Other Person' })] });
    const otherPreview = await api.previewBatch(FIELDWORK, other.batchId);
    const otherApproval = await api.approveBatch(FIELDWORK, other.batchId, { expectedRevision: 1, previewDigest: otherPreview.previewDigest });
    await rejects(api.issueBatch(FIELDWORK, other.batchId, { approvalId: otherApproval.approvalId, idempotencyKey: 'key-1' }), 'IDEMPOTENCY_CONFLICT');
    const metrics = await api.getMetrics(FIELDWORK);
    expect(metrics.issued).toBe(9);
    const detail = await api.getCredential(FIELDWORK, result.credentials[0].id);
    expect(detail).toMatchObject({ expiresAt: '2027-01-31T23:59:59.999Z', status: 'valid', versionNumber: 1, issuerDisplayName: 'Fieldwork Collective' });
    expect((await api.listAudit(FIELDWORK, { limit: 5 })).items.map(a => a.action)).toEqual(['batch.approved', 'batch.created', 'credential.issued', 'batch.approved', 'batch.created']);
  });

  it('refuses issuance and replacement for organizations that are not reviewed', async () => {
    await as('north');
    const draft = await api.createBatch(NORTHGATE, { templateId: 'tpl_demo_northgate', source: 'single', rows: [row()] });
    const preview = await api.previewBatch(NORTHGATE, draft.batchId);
    const approval = await api.approveBatch(NORTHGATE, draft.batchId, { expectedRevision: 1, previewDigest: preview.previewDigest });
    await rejects(api.issueBatch(NORTHGATE, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: 'n1' }), 'ISSUER_NOT_ELIGIBLE');
    expect((await api.getMetrics(NORTHGATE)).issued).toBe(0);
  });
});

describe('lifecycle', () => {
  beforeEach(async () => { await as('owner'); });

  it('computes status with precedence revoked > replaced > expired > valid', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const past = '2025-01-01T00:00:00Z';
    expect(statusOf({ revokedAt: past, replacedById: 'x', expiresAt: past }, now)).toBe('revoked');
    expect(statusOf({ revokedAt: null, replacedById: 'x', expiresAt: past }, now)).toBe('replaced');
    expect(statusOf({ revokedAt: null, replacedById: null, expiresAt: past }, now)).toBe('expired');
    expect(statusOf({ revokedAt: null, replacedById: null, expiresAt: now.toISOString() }, now)).toBe('expired');
    expect(statusOf({ revokedAt: null, replacedById: null, expiresAt: null }, now)).toBe('valid');
  });

  it('expires at read time', async () => {
    const { result } = await issueOne({ expiresOn: '2026-11-20' });
    expect((await api.verifyCredential(result.credentials[0].publicId)).status).toBe('valid');
    clock = new Date('2026-11-21T00:00:00Z');
    expect((await api.verifyCredential(result.credentials[0].publicId)).status).toBe('expired');
  });

  it('revokes irreversibly and idempotently per key', async () => {
    await rejects(api.revokeCredential(FIELDWORK, 'cred_demo_valid', { reason: '', idempotencyKey: 'r1' }), 'VALIDATION');
    await api.revokeCredential(FIELDWORK, 'cred_demo_valid', { reason: 'Issued in error', idempotencyKey: 'r1' });
    await api.revokeCredential(FIELDWORK, 'cred_demo_valid', { reason: 'Issued in error', idempotencyKey: 'r1' });
    await rejects(api.revokeCredential(FIELDWORK, 'cred_demo_valid', { reason: 'Again', idempotencyKey: 'r2' }), 'INVALID_TRANSITION');
    await rejects(api.revokeCredential(FIELDWORK, 'cred_demo_f5', { reason: 'Issued in error', idempotencyKey: 'r1' }), 'IDEMPOTENCY_CONFLICT');
    const detail = await api.getCredential(FIELDWORK, 'cred_demo_valid');
    expect(detail.status).toBe('revoked');
    expect(detail.events.filter(e => e.type === 'revoked')).toHaveLength(1);
    await rejects(api.replaceCredential(FIELDWORK, 'cred_demo_valid', { reason: 'fix', replacement: row(), idempotencyKey: 'p1' }), 'INVALID_TRANSITION');
  });

  it('replaces by issuing a linked successor without changing the original content', async () => {
    const before = await api.getCredential(FIELDWORK, 'cred_demo_f5');
    const ref = await api.replaceCredential(FIELDWORK, 'cred_demo_f5', { reason: 'Corrected title', replacement: row({ recipientDisplayName: before.recipientDisplayName, title: 'Oral History Interviewing II' }), idempotencyKey: 'p1' });
    expect(await api.replaceCredential(FIELDWORK, 'cred_demo_f5', { reason: 'Corrected title', replacement: row({ recipientDisplayName: before.recipientDisplayName, title: 'Oral History Interviewing II' }), idempotencyKey: 'p1' })).toEqual(ref);
    const after = await api.getCredential(FIELDWORK, 'cred_demo_f5');
    expect(after).toMatchObject({ status: 'replaced', title: before.title, achievement: before.achievement, issuedAt: before.issuedAt, replacedByPublicId: ref.publicId });
    const successor = await api.getCredential(FIELDWORK, ref.id);
    expect(successor).toMatchObject({ versionNumber: 2, replacesPublicId: before.publicId, title: 'Oral History Interviewing II', status: 'valid' });
    await rejects(api.replaceCredential(FIELDWORK, 'cred_demo_f5', { reason: 'Again', replacement: row(), idempotencyKey: 'p2' }), 'INVALID_TRANSITION');
    expect((await api.verifyCredential(before.publicId)).replacementPublicId).toBe(ref.publicId);
    expect((await api.listAudit(FIELDWORK, { limit: 1 })).items[0].action).toBe('credential.replaced');
  });
});

describe('credential listing', () => {
  beforeEach(async () => { await as('viewer'); });

  it('searches recipient, title and public id, filters by status and pages newest first', async () => {
    expect((await api.listCredentials(FIELDWORK, { search: 'alex' })).items.map(c => c.publicId)).toEqual([DEMO_PUBLIC_IDS.valid]);
    expect((await api.listCredentials(FIELDWORK, { search: 'ARCHIVE' })).items).toHaveLength(1);
    expect((await api.listCredentials(FIELDWORK, { search: DEMO_PUBLIC_IDS.expired.toLowerCase() })).items).toHaveLength(1);
    expect((await api.listCredentials(FIELDWORK, { status: 'revoked' })).items.map(c => c.status)).toEqual(['revoked']);
    const first = await api.listCredentials(FIELDWORK, { limit: 3 });
    expect(first.items[0].publicId).toBe(DEMO_PUBLIC_IDS.valid);
    expect(first.nextCursor).not.toBeNull();
    const all = [...first.items];
    let cursor = first.nextCursor;
    while (cursor) {
      const next = await api.listCredentials(FIELDWORK, { limit: 3, cursor });
      all.push(...next.items);
      cursor = next.nextCursor;
    }
    expect(all).toHaveLength(8);
    expect(new Set(all.map(c => c.id)).size).toBe(8);
    const issued = all.map(c => c.issuedAt);
    expect([...issued].sort().reverse()).toEqual(issued);
    await rejects(api.listCredentials(FIELDWORK, { cursor: 'bogus' }), 'VALIDATION');
    expect((await api.listCredentials(FIELDWORK, { limit: 1000 })).items).toHaveLength(8);
  });
});

describe('public verification and delivery', () => {
  it('treats malformed and unknown ids as NOT_FOUND and counts checks', async () => {
    await rejects(api.verifyCredential('short'), 'NOT_FOUND');
    await rejects(api.verifyCredential('ZZZZZZZZZZZZZZZZZZZZZZ'), 'NOT_FOUND');
    const result = await api.verifyCredential(DEMO_PUBLIC_IDS.valid);
    expect(Object.keys(result).sort()).toEqual(['achievement', 'checkedAt', 'expiresAt', 'issuedAt', 'issuer', 'proofType', 'publicId', 'recipientDisplayName', 'replacementPublicId', 'status', 'title']);
    expect(JSON.stringify(result)).not.toContain('alex@example.test');
    await as('viewer');
    expect((await api.getMetrics(FIELDWORK)).verificationChecks).toBe(15);
  });

  it('creates 43-character delivery links that revoke earlier links and expire after 30 days', async () => {
    await as('issuer');
    const first = await api.createDeliveryLink(FIELDWORK, 'cred_demo_valid');
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(first.expiresAt).getTime() - clock.getTime()).toBe(30 * DAY);
    expect(storage.getItem(DEMO_STORAGE_KEY)).not.toContain(first.token);
    await api.signOut();
    expect((await api.exchangeDelivery(first.token)).publicId).toBe(DEMO_PUBLIC_IDS.valid);
    await as('issuer');
    const second = await api.createDeliveryLink(FIELDWORK, 'cred_demo_valid');
    await rejects(api.exchangeDelivery(first.token), 'DELIVERY_UNAVAILABLE');
    expect((await api.exchangeDelivery(second.token)).recipientDisplayName).toBe('Alex Santos');
    await rejects(api.exchangeDelivery('garbage'), 'DELIVERY_UNAVAILABLE');
    clock = new Date(clock.getTime() + 30 * DAY);
    await rejects(api.exchangeDelivery(second.token), 'DELIVERY_UNAVAILABLE');
  });

  it('makes delivery unavailable once the credential is revoked', async () => {
    await as('issuer');
    const link = await api.createDeliveryLink(FIELDWORK, 'cred_demo_f7');
    await api.revokeCredential(FIELDWORK, 'cred_demo_f7', { reason: 'Withdrawn', idempotencyKey: 'rv' });
    await rejects(api.exchangeDelivery(link.token), 'DELIVERY_UNAVAILABLE');
    await rejects(api.createDeliveryLink(FIELDWORK, 'cred_demo_f7'), 'INVALID_TRANSITION');
  });
});
