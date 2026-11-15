import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDemoApi, DEMO_PASSWORD } from '../../src/lib/api/demoAdapter';
import { createSupabaseApi } from '../../src/lib/api/supabaseAdapter';
import { ApiError, type DraftRowInput, type VeriMarkApi } from '../../src/lib/api/types';
import { platformAdmin, tenant, TestDb, type Tenant } from './harness';

// The demonstration adapter claims to follow the database's rules. This runs one scenario through both and
// requires the same outcomes, so the demonstration cannot drift from the real backend unnoticed.
type Persona = 'owner' | 'issuer' | 'viewer' | 'otherOwner' | 'anonymous';
interface World { as(persona: Persona): Promise<VeriMarkApi>; org: string; otherOrg: string }

const code = async (run: Promise<unknown>): Promise<string> => {
  try { await run; return 'OK'; } catch (error) { if (error instanceof ApiError) return error.code; throw error; }
};
const person = (name: string, extra: Partial<DraftRowInput> = {}): DraftRowInput => ({ recipientDisplayName: name, title: 'Parity Workshop', achievement: 'Completed', ...extra });

async function issueOne(api: VeriMarkApi, org: string, row: DraftRowInput, key = crypto.randomUUID()) {
  const template = (await api.listTemplates(org)).find(t => !t.archived)!;
  const draft = await api.createBatch(org, { templateId: template.id, source: 'single', rows: [row] });
  const preview = await api.previewBatch(org, draft.batchId);
  const approval = await api.approveBatch(org, draft.batchId, { expectedRevision: preview.revision, previewDigest: preview.previewDigest });
  const result = await api.issueBatch(org, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: key });
  return { draft, approval, key, credential: result.credentials[0], result };
}

async function scenario(world: World): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const { org, otherOrg } = world;
  let api = await world.as('issuer');

  // Validation: same fields, codes and row numbers.
  const template = (await api.listTemplates(org)).find(t => !t.archived)!;
  try {
    await api.createBatch(org, { templateId: template.id, source: 'csv', rows: [person('Good'), { recipientDisplayName: ' ', title: 'x'.repeat(201), achievement: 'ok', recipientEmail: 'nope', expiresOn: '2001-01-01' }] });
    out.validation = 'OK';
  } catch (error) { out.validation = error instanceof ApiError ? [error.code, [...error.fields].sort((a, b) => a.field.localeCompare(b.field))] : String(error); }
  out.duplicateRows = await code(api.createBatch(org, { templateId: template.id, source: 'csv', rows: [person('Twin'), person('twin ')] }));

  // Issue, replay, and key reuse.
  const first = await issueOne(api, org, person('Parity One', { recipientEmail: 'one@example.test' }));
  out.publicIdShape = /^[A-Za-z0-9_-]{22}$/.test(first.credential.publicId);
  out.replaySame = JSON.stringify(await api.issueBatch(org, first.draft.batchId, { approvalId: first.approval.approvalId, idempotencyKey: first.key })) === JSON.stringify(first.result);
  out.issuedTwiceNewKey = await code(api.issueBatch(org, first.draft.batchId, { approvalId: first.approval.approvalId, idempotencyKey: crypto.randomUUID() }));
  const second = await api.createBatch(org, { templateId: template.id, source: 'single', rows: [person('Parity Two')] });
  const secondPreview = await api.previewBatch(org, second.batchId);
  out.issueWithoutApproval = await code(api.issueBatch(org, second.batchId, { approvalId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }));
  out.approveWrongDigest = await code(api.approveBatch(org, second.batchId, { expectedRevision: secondPreview.revision, previewDigest: 'f'.repeat(64) }));
  const secondApproval = await api.approveBatch(org, second.batchId, { expectedRevision: secondPreview.revision, previewDigest: secondPreview.previewDigest });
  out.keyReusedForOtherBatch = await code(api.issueBatch(org, second.batchId, { approvalId: secondApproval.approvalId, idempotencyKey: first.key }));
  const two = (await api.issueBatch(org, second.batchId, { approvalId: secondApproval.approvalId, idempotencyKey: crypto.randomUUID() })).credentials[0];

  // Delivery links.
  const linkA = await api.createDeliveryLink(org, first.credential.id);
  const linkB = await api.createDeliveryLink(org, first.credential.id);
  out.tokenShape = /^[A-Za-z0-9_-]{43}$/.test(linkA.token);
  const detailAsIssuer = await api.getCredential(org, first.credential.id);
  out.issuerSeesEmail = detailAsIssuer.recipientEmail;

  api = await world.as('anonymous');
  out.verifyValid = (await api.verifyCredential(first.credential.publicId)).status;
  out.verifyKeys = Object.keys(await api.verifyCredential(first.credential.publicId)).sort();
  out.verifyUnknown = await code(api.verifyCredential('Z'.repeat(22)));
  out.verifyMalformed = await code(api.verifyCredential('nope'));
  out.oldLink = await code(api.exchangeDelivery(linkA.token));
  out.newLinkKeys = Object.keys(await api.exchangeDelivery(linkB.token)).sort();
  out.publicIdAsToken = await code(api.exchangeDelivery(first.credential.publicId));

  // Roles and tenants.
  api = await world.as('viewer');
  out.viewerSeesEmail = (await api.getCredential(org, first.credential.id)).recipientEmail;
  out.viewerRevoke = await code(api.revokeCredential(org, first.credential.id, { reason: 'no', idempotencyKey: crypto.randomUUID() }));
  out.viewerCreateBatch = await code(api.createBatch(org, { templateId: template.id, source: 'single', rows: [person('Viewer Try')] }));
  out.viewerInvite = await code(api.inviteMember(org, { email: 'friend@example.test', role: 'issuer' }));
  out.viewerLink = await code(api.createDeliveryLink(org, first.credential.id));
  api = await world.as('issuer');
  out.issuerInvite = await code(api.inviteMember(org, { email: 'friend@example.test', role: 'issuer' }));
  out.issuerRename = await code(api.renameOrganization(org, { displayName: 'Hijack', expectedRevision: 1 }));
  api = await world.as('otherOwner');
  out.crossTenantList = await code(api.listCredentials(org));
  out.crossTenantGet = await code(api.getCredential(org, first.credential.id));
  out.crossTenantRevoke = await code(api.revokeCredential(org, first.credential.id, { reason: 'no', idempotencyKey: crypto.randomUUID() }));
  out.ownIdForeignRecord = await code(api.getCredential(otherOrg, first.credential.id));
  // The other organization is not reviewed: it can prepare but not issue.
  const otherTemplate = await api.saveTemplate(otherOrg, { name: 'Parity', config: template.config });
  const pending = await api.createBatch(otherOrg, { templateId: otherTemplate.id, source: 'single', rows: [person('Pending Person')] });
  const pendingPreview = await api.previewBatch(otherOrg, pending.batchId);
  const pendingApproval = await api.approveBatch(otherOrg, pending.batchId, { expectedRevision: pendingPreview.revision, previewDigest: pendingPreview.previewDigest });
  out.unreviewedIssue = await code(api.issueBatch(otherOrg, pending.batchId, { approvalId: pendingApproval.approvalId, idempotencyKey: crypto.randomUUID() }));

  // Lifecycle.
  api = await world.as('issuer');
  out.revokeNoReason = await code(api.revokeCredential(org, first.credential.id, { reason: '  ', idempotencyKey: crypto.randomUUID() }));
  const revokeKey = crypto.randomUUID();
  out.revoke = await code(api.revokeCredential(org, first.credential.id, { reason: 'Issued in error', idempotencyKey: revokeKey }));
  out.revokeReplay = await code(api.revokeCredential(org, first.credential.id, { reason: 'Issued in error', idempotencyKey: revokeKey }));
  out.revokeAgain = await code(api.revokeCredential(org, first.credential.id, { reason: 'Again', idempotencyKey: crypto.randomUUID() }));
  out.replaceRevoked = await code(api.replaceCredential(org, first.credential.id, { reason: 'Fix', replacement: person('Parity One Fixed'), idempotencyKey: crypto.randomUUID() }));
  out.linkAfterRevoke = await code(api.createDeliveryLink(org, first.credential.id));
  const successor = await api.replaceCredential(org, two.id, { reason: 'Name corrected', replacement: person('Parity Two Fixed'), idempotencyKey: crypto.randomUUID() });
  out.replaceAgain = await code(api.replaceCredential(org, two.id, { reason: 'Fork', replacement: person('Fork'), idempotencyKey: crypto.randomUUID() }));
  out.successorVersion = (await api.getCredential(org, successor.id)).versionNumber;
  out.eventsOfReplaced = (await api.getCredential(org, two.id)).events.map(e => e.type);
  out.statusFilter = (await api.listCredentials(org, { status: 'revoked', search: 'Parity' })).items.map(c => c.recipientDisplayName);

  api = await world.as('anonymous');
  out.verifyRevoked = (await api.verifyCredential(first.credential.publicId)).status;
  out.revokedLink = await code(api.exchangeDelivery(linkB.token));
  const replaced = await api.verifyCredential(two.publicId);
  out.verifyReplaced = [replaced.status, replaced.replacementPublicId === successor.publicId, replaced.recipientDisplayName];
  out.verifySuccessor = (await api.verifyCredential(successor.publicId)).recipientDisplayName;
  return out;
}

let db: TestDb;
beforeAll(async () => { db = await TestDb.create(); });
afterAll(() => db.close());

async function databaseWorld(): Promise<World> {
  const admin = await platformAdmin(db);
  const main: Tenant = await tenant(db, admin, 'parity');
  const other: Tenant = await tenant(db, admin, 'parity-other', false);
  const actors: Record<Persona, string | null> = { owner: main.owner, issuer: main.issuer, viewer: main.viewer, otherOwner: other.owner, anonymous: null };
  const apiFor = (actor: string | null) => createSupabaseApi('http://localhost', 'k', { rpc: async (name: string, args: Record<string, unknown>) => {
    try { return { data: await db.rpc(actor, name, args), error: null }; }
    catch (error) { const e = error as { message: string; detail?: string }; return { data: null, error: { message: e.message, details: e.detail ?? null } }; }
  } } as unknown as SupabaseClient);
  return { org: main.org, otherOrg: other.org, as: async persona => apiFor(actors[persona]) };
}

async function demoWorld(): Promise<World> {
  const api = createDemoApi({ storage: null });
  const emails: Record<Exclude<Persona, 'anonymous'>, string> = { owner: 'owner@demo.verimark.test', issuer: 'issuer@demo.verimark.test', viewer: 'viewer@demo.verimark.test', otherOwner: 'north@demo.verimark.test' };
  await api.signIn(emails.owner, DEMO_PASSWORD); const org = (await api.listMemberships())[0].organizationId;
  await api.signIn(emails.otherOwner, DEMO_PASSWORD); const otherOrg = (await api.listMemberships())[0].organizationId;
  return { org, otherOrg, as: async persona => { await api.signOut(); if (persona !== 'anonymous') await api.signIn(emails[persona], DEMO_PASSWORD); return api; } };
}

describe('demonstration adapter and database agree', () => {
  it('on one end-to-end scenario of rules, refusals and shapes', async () => {
    const database = await scenario(await databaseWorld());
    const demo = await scenario(await demoWorld());
    expect(demo).toEqual(database);
    // Guard against both being wrong in the same way on the points that matter most.
    expect(database).toMatchObject({
      viewerRevoke: 'FORBIDDEN', crossTenantGet: 'NOT_FOUND', ownIdForeignRecord: 'NOT_FOUND', unreviewedIssue: 'ISSUER_NOT_ELIGIBLE',
      issueWithoutApproval: 'APPROVAL_REQUIRED', approveWrongDigest: 'REVISION_CONFLICT', keyReusedForOtherBatch: 'IDEMPOTENCY_CONFLICT',
      issuedTwiceNewKey: 'INVALID_TRANSITION', replaySame: true, revokeAgain: 'INVALID_TRANSITION', replaceRevoked: 'INVALID_TRANSITION',
      replaceAgain: 'INVALID_TRANSITION', oldLink: 'DELIVERY_UNAVAILABLE', revokedLink: 'DELIVERY_UNAVAILABLE', publicIdAsToken: 'DELIVERY_UNAVAILABLE',
      verifyUnknown: 'NOT_FOUND', verifyMalformed: 'NOT_FOUND', verifyRevoked: 'revoked', viewerSeesEmail: null, issuerSeesEmail: 'one@example.test',
      verifyReplaced: ['replaced', true, 'Parity Two'], verifySuccessor: 'Parity Two Fixed', successorVersion: 2,
    });
  });
});
