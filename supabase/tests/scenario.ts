import { ApiError, type DraftRowInput, type VeriMarkApi } from '../../src/lib/api/types';

// One end-to-end scenario of rules, refusals and result shapes, written against VeriMarkApi only, so the same
// checks can run on the demonstration adapter, on the local database, and on a hosted Supabase project.
export type Persona = 'owner' | 'issuer' | 'viewer' | 'otherOwner' | 'anonymous';
export interface World { as(persona: Persona): Promise<VeriMarkApi>; org: string; otherOrg: string; /** Address of the viewer persona, an existing member of `org`. */ viewerEmail: string }

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

export async function scenario(world: World): Promise<Record<string, unknown>> {
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
  api = await world.as('owner');
  out.inviteExistingMember = await code(api.inviteMember(org, { email: world.viewerEmail.toUpperCase(), role: 'issuer' }));
  api = await world.as('otherOwner');
  out.crossTenantList = await code(api.listCredentials(org));
  out.crossTenantGet = await code(api.getCredential(org, first.credential.id));
  out.crossTenantRevoke = await code(api.revokeCredential(org, first.credential.id, { reason: 'no', idempotencyKey: crypto.randomUUID() }));
  out.ownIdForeignRecord = await code(api.getCredential(otherOrg, first.credential.id));
  // The other organization is not reviewed: it can prepare but not issue.
  // Reuse a template when one exists: repeated runs against a persistent database must not pile up templates.
  const otherTemplate = (await api.listTemplates(otherOrg)).find(t => !t.archived) ?? await api.saveTemplate(otherOrg, { name: 'Parity', config: template.config });
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
  const linkTwo = await api.createDeliveryLink(org, two.id);
  const successor = await api.replaceCredential(org, two.id, { reason: 'Name corrected', replacement: person('Parity Two Fixed'), idempotencyKey: crypto.randomUUID() });
  // Checked before any new-link attempt: a successful attempt would itself revoke linkTwo and hide the defect.
  out.replacedLink = await code(api.exchangeDelivery(linkTwo.token));
  out.linkAfterReplace = await code(api.createDeliveryLink(org, two.id));
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

/** The outcomes that matter most, pinned so that two implementations cannot be wrong in the same way. */
export const REQUIRED_OUTCOMES = {
  viewerRevoke: 'FORBIDDEN', viewerCreateBatch: 'FORBIDDEN', viewerInvite: 'FORBIDDEN', viewerLink: 'FORBIDDEN', issuerInvite: 'FORBIDDEN', issuerRename: 'FORBIDDEN', inviteExistingMember: 'VALIDATION',
  crossTenantList: 'NOT_FOUND', crossTenantGet: 'NOT_FOUND', crossTenantRevoke: 'NOT_FOUND', ownIdForeignRecord: 'NOT_FOUND', unreviewedIssue: 'ISSUER_NOT_ELIGIBLE',
  issueWithoutApproval: 'APPROVAL_REQUIRED', approveWrongDigest: 'REVISION_CONFLICT', keyReusedForOtherBatch: 'IDEMPOTENCY_CONFLICT',
  issuedTwiceNewKey: 'INVALID_TRANSITION', replaySame: true, duplicateRows: 'VALIDATION', publicIdShape: true, tokenShape: true,
  revokeNoReason: 'VALIDATION', revoke: 'OK', revokeReplay: 'OK', revokeAgain: 'INVALID_TRANSITION', replaceRevoked: 'INVALID_TRANSITION', linkAfterRevoke: 'INVALID_TRANSITION', linkAfterReplace: 'INVALID_TRANSITION',
  replaceAgain: 'INVALID_TRANSITION', oldLink: 'DELIVERY_UNAVAILABLE', revokedLink: 'DELIVERY_UNAVAILABLE', replacedLink: 'DELIVERY_UNAVAILABLE', publicIdAsToken: 'DELIVERY_UNAVAILABLE',
  verifyValid: 'valid', verifyUnknown: 'NOT_FOUND', verifyMalformed: 'NOT_FOUND', verifyRevoked: 'revoked', viewerSeesEmail: null, issuerSeesEmail: 'one@example.test',
  verifyReplaced: ['replaced', true, 'Parity Two'], verifySuccessor: 'Parity Two Fixed', successorVersion: 2, eventsOfReplaced: ['issued', 'replaced'],
  verifyKeys: ['achievement', 'checkedAt', 'expiresAt', 'issuedAt', 'issuer', 'proofType', 'publicId', 'recipientDisplayName', 'replacementPublicId', 'status', 'title'],
  newLinkKeys: ['achievement', 'expiresAt', 'issuedAt', 'issuerDisplayName', 'publicId', 'recipientDisplayName', 'status', 'template', 'title'],
} as const;
