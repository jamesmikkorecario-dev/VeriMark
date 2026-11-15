import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseApi, toApiError } from '../../src/lib/api/supabaseAdapter';
import { ApiError, type VeriMarkApi } from '../../src/lib/api/types';
import { platformAdmin, tenant, TEMPLATE_CONFIG, TestDb, type Tenant } from './harness';

// Runs the real adapter against the real schema: the only substitute is the transport, which calls the same
// function with the same named arguments PostgREST would, under the same database role.
let db: TestDb; let admin: string; let t: Tenant;
function apiAs(actor: string | null): VeriMarkApi {
  const client = { rpc: async (name: string, args: Record<string, unknown>) => {
    try { return { data: await db.rpc(actor, name, args), error: null }; }
    catch (error) { const e = error as { message: string; detail?: string; code?: string }; return { data: null, error: { message: e.message, details: e.detail ?? null, code: e.code } }; }
  } };
  return createSupabaseApi('http://localhost', 'publishable', client as unknown as SupabaseClient);
}
const failure = async (run: Promise<unknown>): Promise<ApiError> => { try { await run; } catch (error) { if (error instanceof ApiError) return error; throw error; } throw new Error('expected a failure'); };

beforeAll(async () => { db = await TestDb.create(); admin = await platformAdmin(db); t = await tenant(db, admin, 'alpha'); });
afterAll(() => db.close());

describe('Supabase adapter against the real schema', () => {
  it('runs the whole issuer journey and returns contract-shaped data', async () => {
    const owner = apiAs(t.owner); const issuer = apiAs(t.issuer); const viewer = apiAs(t.viewer); const anon = apiAs(null);
    expect(await owner.listMemberships()).toEqual([{ organizationId: t.org, organizationName: 'alpha Collective', role: 'owner', reviewState: 'reviewed' }]);
    const organization = await owner.getOrganization(t.org);
    expect(Object.keys(organization).sort()).toEqual(['createdAt', 'displayName', 'id', 'reviewState', 'revision']);
    expect((await owner.renameOrganization(t.org, { displayName: 'Alpha Guild', expectedRevision: organization.revision })).displayName).toBe('Alpha Guild');
    expect((await owner.listMembers(t.org)).map(m => m.role).sort()).toEqual(['issuer', 'owner', 'viewer']);

    const invite = await owner.inviteMember(t.org, { email: 'new-member@example.test', role: 'viewer' });
    expect((await owner.listInvites(t.org)).map(i => i.id)).toContain(invite.id);
    await owner.revokeInvite(t.org, invite.id);

    const template = await issuer.saveTemplate(t.org, { name: 'Award', config: { ...TEMPLATE_CONFIG, accent: 'ochre' } as never });
    expect((await issuer.saveTemplate(t.org, { id: template.id, name: 'Award v2', config: template.config, expectedRevision: template.revision })).revision).toBe(2);
    expect((await viewer.listTemplates(t.org)).length).toBe(2);

    const draft = await issuer.createBatch(t.org, { templateId: template.id, source: 'csv', rows: [
      { recipientDisplayName: 'Alex Santos', title: 'Workshop', achievement: 'Completed', recipientEmail: 'alex@example.test', expiresOn: '2099-12-31' },
      { recipientDisplayName: 'Nina Reyes', title: 'Workshop', achievement: 'Completed' }] });
    const preview = await issuer.previewBatch(t.org, draft.batchId);
    expect(preview).toMatchObject({ rowCount: 2, templateName: 'Award v2', revision: draft.revision });
    const approval = await issuer.approveBatch(t.org, draft.batchId, { expectedRevision: preview.revision, previewDigest: preview.previewDigest });
    const key = crypto.randomUUID();
    const issued = await issuer.issueBatch(t.org, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: key });
    expect(await issuer.issueBatch(t.org, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: key })).toEqual(issued);
    const [first, second] = issued.credentials;

    const page = await viewer.listCredentials(t.org, { limit: 1 });
    expect(page.items.length).toBe(1); expect(page.nextCursor).toBeTruthy();
    expect((await viewer.listCredentials(t.org, { cursor: page.nextCursor!, limit: 1 })).items[0].id).not.toBe(page.items[0].id);
    expect((await viewer.listCredentials(t.org, { search: 'nina', status: 'valid' })).items.map(c => c.id)).toEqual([second.id]);

    const detail = await issuer.getCredential(t.org, first.id);
    expect(detail).toMatchObject({ recipientEmail: 'alex@example.test', status: 'valid', versionNumber: 1, issuerDisplayName: 'Alpha Guild', replacedByPublicId: null, replacesPublicId: null });
    expect(detail.template.accent).toBe('ochre');
    expect(detail.events.map(e => e.type)).toEqual(['issued']);
    expect((await viewer.getCredential(t.org, first.id)).recipientEmail).toBeNull();

    const link = await issuer.createDeliveryLink(t.org, first.id);
    expect((await anon.exchangeDelivery(link.token)).publicId).toBe(first.publicId);
    expect((await anon.verifyCredential(first.publicId)).status).toBe('valid');

    const successor = await issuer.replaceCredential(t.org, first.id, { reason: 'Corrected name', replacement: { recipientDisplayName: 'Alexander Santos', title: 'Workshop', achievement: 'Completed' }, idempotencyKey: crypto.randomUUID() });
    expect(await anon.verifyCredential(first.publicId)).toMatchObject({ status: 'replaced', replacementPublicId: successor.publicId });
    await issuer.revokeCredential(t.org, second.id, { reason: 'Issued in error', idempotencyKey: crypto.randomUUID() });
    expect((await anon.verifyCredential(second.publicId)).status).toBe('revoked');

    expect(await viewer.getMetrics(t.org)).toEqual({ issued: 3, valid: 1, expired: 0, revoked: 1, replaced: 1, verificationChecks: 3 });
    const audit = await viewer.listAudit(t.org, { limit: 100 });
    expect(audit.items.map(a => a.action)).toEqual(expect.arrayContaining(['credential.issued', 'credential.revoked', 'credential.replaced', 'delivery_link.created', 'batch.approved']));
    await issuer.archiveTemplate(t.org, template.id);

    const adminApi = apiAs(admin);
    expect(await adminApi.isPlatformAdmin()).toBe(true); expect(await owner.isPlatformAdmin()).toBe(false);
    const queued = (await adminApi.listReviewQueue()).find(q => q.organizationId === t.org)!;
    await adminApi.recordIssuerReview({ organizationId: t.org, outcome: 'suspended', reason: 'Synthetic', expectedRevision: queued.revision });
    expect((await owner.getOrganization(t.org)).reviewState).toBe('suspended');
  });

  it('maps database refusals to typed errors with field details', async () => {
    const issuer = apiAs(t.issuer); const outsider = apiAs(await db.user('adapter-outsider')); const anon = apiAs(null);
    const validation = await failure(issuer.createBatch(t.org, { templateId: t.template, source: 'single', rows: [{ recipientDisplayName: '', title: 'T', achievement: 'A', expiresOn: '2001-01-01' }] }));
    expect(validation.code).toBe('VALIDATION');
    expect(validation.fields).toEqual([{ field: 'recipientDisplayName', code: 'REQUIRED', row: 1 }, { field: 'expiresOn', code: 'PAST_DATE', row: 1 }]);
    expect((await failure(outsider.listCredentials(t.org))).code).toBe('NOT_FOUND');
    expect((await failure(apiAs(t.viewer).archiveTemplate(t.org, t.template))).code).toBe('FORBIDDEN');
    expect((await failure(anon.verifyCredential('A'.repeat(22)))).code).toBe('NOT_FOUND');
    expect((await failure(anon.exchangeDelivery('A'.repeat(43)))).code).toBe('DELIVERY_UNAVAILABLE');
  });

  it('never turns an unexpected failure into an answer', async () => {
    // Anonymous callers have no execute privilege here: a raw "permission denied" must not leak or look like data.
    const denied = await failure(apiAs(null).listCredentials(t.org));
    expect(denied).toMatchObject({ code: 'TEMPORARILY_UNAVAILABLE', retryable: true });
    expect(denied.message).not.toMatch(/permission|function|sql/i);
    const broken = createSupabaseApi('http://localhost', 'k', { rpc: async () => { throw new TypeError('Failed to fetch'); } } as unknown as SupabaseClient);
    expect(await failure(broken.verifyCredential('A'.repeat(22)))).toMatchObject({ code: 'UNABLE_TO_VERIFY', retryable: true });
    expect(await failure(broken.listMemberships())).toMatchObject({ code: 'TEMPORARILY_UNAVAILABLE', retryable: true });
    expect(toApiError({ message: 'VM:RATE_LIMITED', details: '42' })).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 42, retryable: true });
    expect(toApiError({ message: 'VM:NOT_A_CODE' }).code).toBe('TEMPORARILY_UNAVAILABLE');
    expect(toApiError({ message: 'JWT expired', code: 'PGRST301' }).code).toBe('UNAUTHENTICATED');
  });
});
