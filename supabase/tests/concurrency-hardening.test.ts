import { afterAll, beforeAll, expect, it } from 'vitest';
import { TestDb, platformAdmin, tenant, issue, row, uuid, TEMPLATE_CONFIG, type Tenant } from './harness';

// Sequential boundary regressions only. PGlite cannot prove inter-session lock behavior.
let db: TestDb;
let admin: string;
let sequence = 0;
beforeAll(async () => { db = await TestDb.create(); admin = await platformAdmin(db); });
afterAll(async () => { await db.close(); });
const fresh = () => tenant(db, admin, `concurrency-${++sequence}`);
async function approved(t: Tenant) {
  const batch = await db.rpc<{ batchId: string; revision: number }>(t.issuer, 'create_batch', { p_org: t.org, p_template: t.template, p_source: 'single', p_rows: [row('Synthetic Person')] });
  const preview = await db.rpc<{ previewDigest: string }>(t.issuer, 'preview_batch', { p_org: t.org, p_batch: batch.batchId });
  const approval = await db.rpc<{ approvalId: string }>(t.issuer, 'approve_batch', { p_org: t.org, p_batch: batch.batchId, p_expected_revision: batch.revision, p_preview_digest: preview.previewDigest });
  return { p_org: t.org, p_batch: batch.batchId, p_approval: approval.approvalId, p_key: uuid() };
}
async function effects(t: Tenant) {
  return db.admin(`select
    (select count(*)::int from public.credentials where organization_id = $1) as credentials,
    (select count(*)::int from public.credential_events where organization_id = $1) as events,
    (select count(*)::int from public.idempotency_receipts where organization_id = $1) as receipts`, [t.org]);
}

it('removal committed before issue denies even an exact receipt replay without effects', async () => {
  const t = await fresh(); const args = await approved(t);
  await db.rpc(t.issuer, 'issue_batch', args);
  await db.rpc(t.owner, 'remove_member', { p_org: t.org, p_user: t.issuer });
  const before = await effects(t);
  expect((await db.fails(db.rpc(t.issuer, 'issue_batch', args))).code).toBe('NOT_FOUND');
  expect(await effects(t)).toEqual(before);
});

it('demotion committed before issue denies approved work and preserves the batch', async () => {
  const t = await fresh(); const args = await approved(t);
  await db.rpc(t.owner, 'set_member_role', { p_org: t.org, p_user: t.issuer, p_role: 'viewer' });
  const before = await effects(t);
  expect((await db.fails(db.rpc(t.issuer, 'issue_batch', args))).code).toBe('FORBIDDEN');
  expect(await effects(t)).toEqual(before);
  expect(await db.admin('select state from public.credential_batches where id = $1', [args.p_batch])).toEqual([{ state: 'approved' }]);
});

it('suspension committed before issue or replacement creates no credentials or receipts', async () => {
  const t = await fresh(); const [c] = await issue(db, t, [row('Original')]); const args = await approved(t);
  await db.rpc(admin, 'record_issuer_review', { p_org: t.org, p_outcome: 'suspended', p_reason: 'Synthetic review', p_expected_revision: 2 });
  const before = await effects(t);
  expect((await db.fails(db.rpc(t.issuer, 'issue_batch', args))).code).toBe('ISSUER_NOT_ELIGIBLE');
  expect((await db.fails(db.rpc(t.issuer, 'replace_credential', { p_org: t.org, p_credential: c.id, p_reason: 'Correction', p_replacement: row('Corrected'), p_key: uuid() }))).code).toBe('ISSUER_NOT_ELIGIBLE');
  expect(await effects(t)).toEqual(before);
});

it('replacement replay is stable and later revoke or replacement cannot fork the lineage', async () => {
  const t = await fresh(); const [c] = await issue(db, t, [row('Original')]);
  const args = { p_org: t.org, p_credential: c.id, p_reason: 'Correction', p_replacement: row('Corrected'), p_key: uuid() };
  const successor = await db.rpc(t.issuer, 'replace_credential', args); const before = await effects(t);
  expect(await db.rpc(t.issuer, 'replace_credential', args)).toEqual(successor);
  expect((await db.fails(db.rpc(t.issuer, 'replace_credential', { ...args, p_key: uuid() }))).code).toBe('INVALID_TRANSITION');
  expect((await db.fails(db.rpc(t.issuer, 'revoke_credential', { p_org: t.org, p_credential: c.id, p_reason: 'Withdraw', p_key: uuid() }))).code).toBe('INVALID_TRANSITION');
  expect(await effects(t)).toEqual(before);
});

it('revoke replay is stable and a revoked predecessor cannot acquire a successor', async () => {
  const t = await fresh(); const [c] = await issue(db, t, [row('Original')]);
  const args = { p_org: t.org, p_credential: c.id, p_reason: 'Withdraw', p_key: uuid() };
  await db.rpc(t.issuer, 'revoke_credential', args); const before = await effects(t);
  await db.rpc(t.issuer, 'revoke_credential', args);
  expect((await db.fails(db.rpc(t.issuer, 'replace_credential', { ...args, p_key: uuid(), p_replacement: row('Corrected') }))).code).toBe('INVALID_TRANSITION');
  expect(await effects(t)).toEqual(before);
});

it('stale organization and template revisions fail without overwriting the winning update', async () => {
  const t = await fresh();
  await db.rpc(t.owner, 'rename_organization', { p_org: t.org, p_display_name: 'Winner', p_expected_revision: 2 });
  expect((await db.fails(db.rpc(t.owner, 'rename_organization', { p_org: t.org, p_display_name: 'Stale', p_expected_revision: 2 }))).code).toBe('REVISION_CONFLICT');
  const args = { p_org: t.org, p_id: t.template, p_name: 'Winner', p_config: TEMPLATE_CONFIG, p_expected_revision: 1 };
  await db.rpc(t.issuer, 'save_template', args);
  expect((await db.fails(db.rpc(t.issuer, 'save_template', { ...args, p_name: 'Stale' }))).code).toBe('REVISION_CONFLICT');
  expect(await db.admin('select display_name from public.organizations where id = $1', [t.org])).toEqual([{ display_name: 'Winner' }]);
  expect(await db.admin('select name, revision from public.credential_templates where id = $1', [t.template])).toEqual([{ name: 'Winner', revision: 2 }]);
});
