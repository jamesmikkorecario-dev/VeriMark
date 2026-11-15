import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issue, platformAdmin, row, tenant, TEMPLATE_CONFIG, TestDb, uuid, type Tenant } from './harness';

// US-003/US-004, DB-03/04: validation, approval of the exact reviewed content, atomic and idempotent issuance.
let db: TestDb; let admin: string; let t: Tenant; let pending: Tenant;
beforeAll(async () => { db = await TestDb.create(); admin = await platformAdmin(db); t = await tenant(db, admin, 'alpha'); pending = await tenant(db, admin, 'pending', false); });
afterAll(() => db.close());

const draft = (rows: unknown[], actor = t.issuer, org = t) => db.rpc<{ batchId: string; revision: number; rowCount: number }>(actor, 'create_batch', { p_org: org.org, p_template: org.template, p_source: rows.length === 1 ? 'single' : 'csv', p_rows: rows });
const preview = (batch: string, org = t) => db.rpc<{ previewDigest: string; rows: Record<string, unknown>[]; rowCount: number }>(org.issuer, 'preview_batch', { p_org: org.org, p_batch: batch });
const approve = (batch: string, digest: string, revision = 1, org = t) => db.rpc<{ approvalId: string }>(org.issuer, 'approve_batch', { p_org: org.org, p_batch: batch, p_expected_revision: revision, p_preview_digest: digest });
const issueBatch = (batch: string, approval: string | null, key: string | null, org = t) => db.rpc<{ batchId: string; credentials: { id: string; publicId: string; sourceRow: number }[] }>(org.issuer, 'issue_batch', { p_org: org.org, p_batch: batch, p_approval: approval, p_key: key });
const credentialCount = async (org = t) => (await db.admin<{ n: number }>('select count(*)::int as n from public.credentials where organization_id = $1', [org.org]))[0].n;

describe('draft validation', () => {
  it('reports every row problem with row numbers and creates nothing', async () => {
    const before = await db.admin('select count(*)::int as n from public.credential_batches');
    const error = await db.fails(draft([
      row('Valid Person'),
      { recipientDisplayName: '  ', title: 'x'.repeat(201), achievement: 'ok' },
      row('Bad Contact', { recipientEmail: 'not-an-email', expiresOn: '2020-01-01' }),
      row('Bad Date', { expiresOn: '2026-02-30' }),
      { ...row('Extra'), role: 'owner' },
      'not an object',
    ]));
    expect(error.code).toBe('VALIDATION');
    expect(JSON.parse(error.detail)).toEqual([
      { field: 'recipientDisplayName', code: 'REQUIRED', row: 2 }, { field: 'title', code: 'TOO_LONG', row: 2 },
      { field: 'recipientEmail', code: 'INVALID', row: 3 }, { field: 'expiresOn', code: 'PAST_DATE', row: 3 },
      { field: 'expiresOn', code: 'INVALID', row: 4 }, { field: 'row', code: 'UNKNOWN_FIELD', row: 5 }, { field: 'row', code: 'INVALID', row: 6 },
    ]);
    expect(await db.admin('select count(*)::int as n from public.credential_batches')).toEqual(before);
  });
  it('rejects duplicate rows, empty input, oversized batches and non-string values', async () => {
    expect(JSON.parse((await db.fails(draft([row('Same Person'), row('Other'), row('  same person ')]))).detail)).toEqual([{ field: 'row', code: 'DUPLICATE', row: 3 }]);
    expect((await db.fails(draft([]))).code).toBe('VALIDATION');
    expect(JSON.parse((await db.fails(draft(Array.from({ length: 201 }, (_, i) => row(`Person ${i}`))))).detail)).toEqual([{ field: 'rows', code: 'TOO_MANY' }]);
    expect(JSON.parse((await db.fails(draft([{ recipientDisplayName: 42, title: ['x'], achievement: { a: 1 } }]))).detail).map((e: { code: string }) => e.code)).toEqual(['INVALID', 'INVALID', 'INVALID']);
    expect((await db.fails(db.rpc(t.issuer, 'create_batch', { p_org: t.org, p_template: t.template, p_source: 'single', p_rows: [row('One'), row('Two')] }))).code).toBe('VALIDATION');
    expect((await db.fails(db.rpc(t.issuer, 'create_batch', { p_org: t.org, p_template: t.template, p_source: 'csv', p_rows: [row('x'.repeat(190), { achievement: 'y'.repeat(2000) })].concat(Array.from({ length: 199 }, (_, i) => row(`P${i}`, { achievement: 'z'.repeat(2000) + 'ééééé'.repeat(2500) }))) }))).code).toBe('PAYLOAD_TOO_LARGE');
  });
  it('accepts the maximum batch, trims and normalizes text', async () => {
    const batch = await draft(Array.from({ length: 200 }, (_, i) => row(`  Person ${i}  `)));
    expect(batch.rowCount).toBe(200);
    expect((await preview(batch.batchId)).rows[0].recipientDisplayName).toBe('Person 0');
  });
  it('an archived template cannot start a batch', async () => {
    const extra = (await db.rpc<{ id: string }>(t.owner, 'save_template', { p_org: t.org, p_id: null, p_name: 'Old', p_config: TEMPLATE_CONFIG, p_expected_revision: null })).id;
    await db.rpc(t.owner, 'archive_template', { p_org: t.org, p_id: extra });
    expect((await db.fails(db.rpc(t.issuer, 'create_batch', { p_org: t.org, p_template: extra, p_source: 'single', p_rows: [row('Late')] }))).code).toBe('NOT_FOUND');
  });
});

describe('approval and issuance', () => {
  it('issues exactly the approved rows once and records events and audit entries', async () => {
    const before = await credentialCount();
    const batch = await draft([row('Alex Santos', { expiresOn: '2099-12-31' }), row('Nina Reyes')]);
    const p = await preview(batch.batchId);
    const approval = await approve(batch.batchId, p.previewDigest);
    const result = await issueBatch(batch.batchId, approval.approvalId, uuid());
    expect(result.credentials.map(c => c.sourceRow)).toEqual([1, 2]);
    for (const c of result.credentials) expect(c.publicId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(new Set(result.credentials.map(c => c.publicId)).size).toBe(2);
    expect(await credentialCount()).toBe(before + 2);
    const stored = await db.admin<{ expires_at: Date; issuer_display_name: string }>('select expires_at, issuer_display_name from public.credentials where id = $1', [result.credentials[0].id]);
    expect(new Date(stored[0].expires_at).toISOString()).toBe('2100-01-01T00:00:00.000Z');
    expect(stored[0].issuer_display_name).toBe('alpha Collective');
    expect(await db.admin("select count(*)::int as n from public.credential_events where type = 'issued' and credential_id = any($1::uuid[])", [result.credentials.map(c => c.id)])).toEqual([{ n: 2 }]);
    expect(await db.admin("select count(*)::int as n from public.audit_log where action = 'credential.issued' and target_id = any($1::uuid[])", [result.credentials.map(c => c.id)])).toEqual([{ n: 2 }]);
  });
  it('an exact replay returns the original result without issuing again', async () => {
    const batch = await draft([row('Replay Person')]);
    const approval = await approve(batch.batchId, (await preview(batch.batchId)).previewDigest);
    const key = uuid(); const first = await issueBatch(batch.batchId, approval.approvalId, key); const count = await credentialCount();
    expect(await issueBatch(batch.batchId, approval.approvalId, key)).toEqual(first);
    expect(await credentialCount()).toBe(count);
  });
  it('the same key for a different request conflicts, and an issued batch cannot be issued under a new key', async () => {
    const one = await draft([row('Key Person One')]); const two = await draft([row('Key Person Two')]);
    const approvalOne = await approve(one.batchId, (await preview(one.batchId)).previewDigest);
    const approvalTwo = await approve(two.batchId, (await preview(two.batchId)).previewDigest);
    const key = uuid(); await issueBatch(one.batchId, approvalOne.approvalId, key); const count = await credentialCount();
    expect((await db.fails(issueBatch(two.batchId, approvalTwo.approvalId, key))).code).toBe('IDEMPOTENCY_CONFLICT');
    expect((await db.fails(issueBatch(one.batchId, approvalOne.approvalId, uuid()))).code).toBe('INVALID_TRANSITION');
    expect((await db.fails(approve(one.batchId, (await preview(one.batchId)).previewDigest))).code).toBe('INVALID_TRANSITION');
    expect(await credentialCount()).toBe(count);
  });
  it('a receipt belongs to the actor who created it', async () => {
    const batch = await draft([row('Actor Scoped')]);
    const approval = await approve(batch.batchId, (await preview(batch.batchId)).previewDigest);
    const key = uuid(); await issueBatch(batch.batchId, approval.approvalId, key);
    expect((await db.fails(db.rpc(t.owner, 'issue_batch', { p_org: t.org, p_batch: batch.batchId, p_approval: approval.approvalId, p_key: key }))).code).toBe('INVALID_TRANSITION');
  });
  it('requires an approval of the exact digest and revision', async () => {
    const batch = await draft([row('Needs Approval')]); const p = await preview(batch.batchId); const count = await credentialCount();
    expect((await db.fails(issueBatch(batch.batchId, null, uuid()))).code).toBe('APPROVAL_REQUIRED');
    expect((await db.fails(approve(batch.batchId, 'f'.repeat(64)))).code).toBe('REVISION_CONFLICT');
    expect((await db.fails(approve(batch.batchId, p.previewDigest, 7))).code).toBe('REVISION_CONFLICT');
    const other = await draft([row('Other Batch')]); const otherApproval = await approve(other.batchId, (await preview(other.batchId)).previewDigest);
    const approval = await approve(batch.batchId, p.previewDigest);
    expect((await db.fails(issueBatch(batch.batchId, otherApproval.approvalId, uuid()))).code).toBe('APPROVAL_REQUIRED');
    expect((await db.fails(issueBatch(batch.batchId, uuid(), uuid()))).code).toBe('APPROVAL_REQUIRED');
    expect((await db.fails(issueBatch(batch.batchId, approval.approvalId, null))).code).toBe('VALIDATION');
    expect(await credentialCount()).toBe(count);
  });
  it('content changed after approval invalidates the approval', async () => {
    const batch = await draft([row('Tampered Later')]);
    const approval = await approve(batch.batchId, (await preview(batch.batchId)).previewDigest); const count = await credentialCount();
    await db.admin("update public.batch_rows set recipient_display_name = 'Someone Else' where batch_id = $1", [batch.batchId]);
    expect((await db.fails(issueBatch(batch.batchId, approval.approvalId, uuid()))).code).toBe('APPROVAL_REQUIRED');
    expect(await credentialCount()).toBe(count);
  });
  it('the digest covers every reviewed field and the pinned template', async () => {
    const digest = async (r: unknown) => (await preview((await draft([r])).batchId)).previewDigest;
    const base = await digest(row('Digest Person'));
    expect(await digest(row('Digest Person'))).toBe(base);
    for (const changed of [row('Digest Persom'), row('Digest Person', { title: 'Other' }), row('Digest Person', { achievement: 'Other' }), row('Digest Person', { expiresOn: '2099-01-01' }), row('Digest Person', { recipientEmail: 'd@example.test' })]) expect(await digest(changed)).not.toBe(base);
    const batch = await draft([row('Pinned Template')]); const before = (await preview(batch.batchId)).previewDigest;
    await db.rpc(t.owner, 'save_template', { p_org: t.org, p_id: t.template, p_name: 'Standard', p_config: { ...TEMPLATE_CONFIG, heading: 'Edited later' }, p_expected_revision: 1 });
    expect((await preview(batch.batchId)).previewDigest).toBe(before);
  });
  it('a failure during issuance leaves nothing behind', async () => {
    const batch = await draft([row('Atomic One'), row('Atomic Two'), row('Atomic Three')]);
    const approval = await approve(batch.batchId, (await preview(batch.batchId)).previewDigest); const count = await credentialCount();
    await db.script(`create function public.test_fail_third() returns trigger language plpgsql as $f$ begin if new.source_row = 3 then raise exception 'injected failure'; end if; return new; end $f$;
      create trigger test_fail_third before insert on public.credentials for each row execute function public.test_fail_third()`);
    try { await expect(issueBatch(batch.batchId, approval.approvalId, uuid())).rejects.toThrow('injected failure'); }
    finally { await db.script('drop trigger test_fail_third on public.credentials; drop function public.test_fail_third()'); }
    expect(await credentialCount()).toBe(count);
    expect(await db.admin('select state from public.credential_batches where id = $1', [batch.batchId])).toEqual([{ state: 'approved' }]);
    expect(await db.admin('select count(*)::int as n from public.idempotency_receipts where response ->> \'batchId\' = $1', [batch.batchId])).toEqual([{ n: 0 }]);
    expect((await issueBatch(batch.batchId, approval.approvalId, uuid())).credentials.length).toBe(3);
  });
  it('an expiry that passed between draft and issue blocks the whole batch', async () => {
    const batch = await draft([row('Soon Expired', { expiresOn: '2099-01-01' })]);
    const approval = await approve(batch.batchId, (await preview(batch.batchId)).previewDigest);
    await db.admin("update public.batch_rows set expires_at = now() - interval '1 second' where batch_id = $1", [batch.batchId]);
    const fresh = await approve(batch.batchId, (await preview(batch.batchId)).previewDigest);
    expect(approval.approvalId).not.toBe(fresh.approvalId);
    expect((await db.fails(issueBatch(batch.batchId, fresh.approvalId, uuid()))).code).toBe('VALIDATION');
  });
});

describe('issuer eligibility', () => {
  it('an organization that is not reviewed can prepare but not issue', async () => {
    const batch = await draft([row('Pending Person')], pending.issuer, pending);
    const approval = await approve(batch.batchId, (await preview(batch.batchId, pending)).previewDigest, 1, pending);
    expect((await db.fails(issueBatch(batch.batchId, approval.approvalId, uuid(), pending))).code).toBe('ISSUER_NOT_ELIGIBLE');
    expect(await credentialCount(pending)).toBe(0);
  });
  it('suspension stops issuance and replacement but keeps existing records', async () => {
    const s = await tenant(db, admin, 'suspended');
    const [credential] = await issue(db, s, [row('Before Suspension')]);
    const revision = (await db.rpc<{ revision: number }>(s.owner, 'get_organization', { p_org: s.org })).revision;
    await db.rpc(admin, 'record_issuer_review', { p_org: s.org, p_outcome: 'suspended', p_reason: 'Synthetic abuse report', p_expected_revision: revision });
    const batch = await draft([row('After Suspension')], s.issuer, s);
    const approval = await approve(batch.batchId, (await preview(batch.batchId, s)).previewDigest, 1, s);
    expect((await db.fails(issueBatch(batch.batchId, approval.approvalId, uuid(), s))).code).toBe('ISSUER_NOT_ELIGIBLE');
    expect((await db.fails(db.rpc(s.issuer, 'replace_credential', { p_org: s.org, p_credential: credential.id, p_reason: 'Typo', p_replacement: row('Corrected'), p_key: uuid() }))).code).toBe('ISSUER_NOT_ELIGIBLE');
    const verified = await db.rpc<{ status: string; issuer: { reviewState: string } }>(null, 'verify_credential', { p_public_id: credential.publicId });
    expect(verified.status).toBe('valid');
    expect(verified.issuer.reviewState).toBe('suspended');
    await db.rpc(s.issuer, 'revoke_credential', { p_org: s.org, p_credential: credential.id, p_reason: 'Withdrawn', p_key: uuid() });
  });
});
