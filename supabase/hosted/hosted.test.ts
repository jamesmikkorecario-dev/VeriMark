import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { VeriMarkApi } from '../../src/lib/api/types';
import { REQUIRED_OUTCOMES, scenario, type Persona } from '../tests/scenario';
import { ensureFixtures, newClient, readHostedConfig, signOutAll, type Fixtures } from './fixtures';

// API-level verification against a real Supabase project (see README.md in this folder). WRITES TEST DATA that cannot be
// removed: issued records are immutable by design. Fails closed unless fully configured. Never prints keys or passwords.
const { config, problems } = readHostedConfig();
if (!config) throw new Error(`Hosted execution refused: ${problems.join('; ')}`);
const TABLES = ['profiles', 'organizations', 'organization_members', 'organization_invites', 'platform_admins', 'issuer_reviews', 'credential_templates',
  'credential_batches', 'batch_rows', 'batch_approvals', 'credentials', 'credential_events', 'delivery_capabilities', 'idempotency_receipts', 'audit_log',
  'verification_counters', 'rate_windows'];
const MEMBER_READABLE = ['organizations', 'organization_members', 'credential_templates', 'credentials', 'credential_events', 'audit_log'];
/** PostgreSQL's "insufficient privilege". Any other error (unknown table, bad request) would not prove a denial. */
const DENIED = '42501';

describe('hosted Supabase project', () => {
  let f: Fixtures;
  beforeAll(async () => { f = await ensureFixtures(config!); }, 120_000);
  afterAll(async () => { if (f) await signOutAll(f); });

  it('refuses every table to anonymous callers and exposes only the two public functions', async () => {
    const anon = newClient(config!);
    for (const table of TABLES) {
      expect((await anon.from(table).select('*').limit(1)).error?.code, `anonymous read of ${table}`).toBe(DENIED);
      expect((await anon.from(table).insert({})).error?.code, `anonymous write to ${table}`).toBe(DENIED);
    }
    for (const fn of ['my_memberships', 'list_review_queue', 'is_platform_admin']) expect((await anon.rpc(fn)).error?.code, fn).toBe(DENIED);
    expect((await anon.rpc('create_organization', { p_display_name: 'refused' })).error?.code).toBe(DENIED);
    const unknown = await anon.rpc('verify_credential', { p_public_id: 'A'.repeat(22) });
    expect(unknown.error).toBeNull(); expect(unknown.data).toBeNull();
    const garbage = await anon.rpc('exchange_delivery', { p_token: 'A'.repeat(43) });
    expect(garbage.error).toBeNull(); expect(garbage.data).toBeNull();
  });

  it('follows the same rules as the local database on the end-to-end scenario', async () => {
    const apis: Record<Persona, VeriMarkApi> = { owner: f.accounts.owner.api, issuer: f.accounts.issuer.api, viewer: f.accounts.viewer.api, otherOwner: f.accounts.otherOwner.api, anonymous: f.anonymous };
    const outcome = await scenario({ org: f.main, otherOrg: f.otherOrg, viewerEmail: f.config.emails.viewer, as: async persona => apis[persona] });
    expect(outcome).toMatchObject(REQUIRED_OUTCOMES);
    expect(outcome.validation).toEqual(['VALIDATION', [
      { field: 'expiresOn', code: 'PAST_DATE', row: 2 }, { field: 'recipientDisplayName', code: 'REQUIRED', row: 2 },
      { field: 'recipientEmail', code: 'INVALID', row: 2 }, { field: 'title', code: 'TOO_LONG', row: 2 }]]);
  }, 180_000);

  it('gives signed-in members no direct write access and no private data', async () => {
    const { owner, viewer } = f.accounts;
    for (const table of TABLES) expect((await viewer.client.from(table).insert({})).error?.code, `member write to ${table}`).toBe(DENIED);
    for (const table of TABLES.filter(t => !MEMBER_READABLE.includes(t))) expect((await owner.client.from(table).select('*').limit(1)).error?.code, `member read of ${table}`).toBe(DENIED);
    expect((await owner.client.from('credentials').select('recipient_email').limit(1)).error?.code).toBe(DENIED);
    expect((await owner.client.from('credential_events').select('reason').limit(1)).error?.code).toBe(DENIED);
    // Contradictory filters prove statement privileges without risking any record if grants regress.
    expect((await owner.client.from('credentials').update({ title: 'Tampered' }).eq('id', f.seed.id).neq('id', f.seed.id)).error?.code).toBe(DENIED);
    expect((await owner.client.from('credentials').delete().eq('id', f.seed.id).neq('id', f.seed.id)).error?.code).toBe(DENIED);
    // Already present: even broken INSERT grants cannot elevate another account.
    expect((await owner.client.from('platform_admins').insert({ user_id: f.accounts.admin.userId })).error?.code).toBe(DENIED);
  });

  it('keeps organizations apart and gives platform administrators no tenant data', async () => {
    const { owner, otherOwner, admin } = f.accounts;
    const mine = await owner.client.from('credentials').select('organization_id');
    expect(mine.error).toBeNull(); expect((mine.data ?? []).length).toBeGreaterThan(0);
    expect((mine.data ?? []).every(row => row.organization_id === f.main)).toBe(true);
    const theirs = await otherOwner.client.from('credentials').select('organization_id');
    expect(theirs.error).toBeNull(); expect((theirs.data ?? []).every(row => row.organization_id === f.otherOrg)).toBe(true);
    // Each test account sees only organizations it belongs to: never the project's real organizations.
    for (const [account, org] of [[owner, f.main], [otherOwner, f.otherOrg]] as const) {
      const result = await account.client.from('organizations').select('id');
      expect(result.error).toBeNull(); expect(result.data?.map(row => row.id)).toEqual([org]);
    }
    for (const table of MEMBER_READABLE) {
      const result = await admin.client.from(table).select(table === 'organization_members' ? 'organization_id' : 'id');
      expect(result.error, `administrator query of ${table}`).toBeNull();
      expect(result.data, `administrator read of ${table}`).toEqual([]);
    }
    await expect(admin.api.listCredentials(f.main)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(admin.api.getCredential(f.main, f.seed.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(otherOwner.api.getCredential(f.main, f.seed.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(owner.api.recordIssuerReview({ organizationId: f.otherOrg, outcome: 'reviewed', reason: 'self-service', expectedRevision: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(owner.api.listReviewQueue()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await f.anonymous.verifyCredential(f.seed.publicId)).status).toBe('valid');
  });
});

