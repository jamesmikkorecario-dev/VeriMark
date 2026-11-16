import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseApi } from '../../src/lib/api/supabaseAdapter';
import type { VeriMarkApi } from '../../src/lib/api/types';
import { REQUIRED_OUTCOMES, scenario, type Persona } from '../tests/scenario';

// Verification against a real Supabase project. WRITES TEST DATA to that project (organizations, records, audit rows)
// and cannot remove it afterwards: issued records are immutable by design. Use a development project only.
// Skipped unless supabase/hosted/README.md has been followed. Never prints keys or passwords.
const env = process.env;
const url = env.VITE_SUPABASE_URL ?? ''; const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''; const password = env.VM_TEST_PASSWORD ?? '';
const emails: Record<Exclude<Persona, 'anonymous'> | 'admin', string> = {
  owner: env.VM_TEST_OWNER_EMAIL ?? '', issuer: env.VM_TEST_ISSUER_EMAIL ?? '', viewer: env.VM_TEST_VIEWER_EMAIL ?? '',
  otherOwner: env.VM_TEST_OTHER_OWNER_EMAIL ?? '', admin: env.VM_TEST_ADMIN_EMAIL ?? '',
};
const configured = Boolean(url && key && password && Object.values(emails).every(Boolean) && env.VM_HOSTED_TESTS === 'I-understand-this-writes-test-data');
const TABLES = ['profiles', 'organizations', 'organization_members', 'organization_invites', 'platform_admins', 'issuer_reviews', 'credential_templates',
  'credential_batches', 'batch_rows', 'batch_approvals', 'credentials', 'credential_events', 'delivery_capabilities', 'idempotency_receipts', 'audit_log',
  'verification_counters', 'rate_windows'];
const MEMBER_READABLE = ['organizations', 'organization_members', 'credential_templates', 'credentials', 'credential_events', 'audit_log'];
const TEMPLATE = { heading: 'Certificate of Completion', bodyPrefix: 'This certifies that', signatoryName: 'Test Signatory', signatoryTitle: 'Hosted verification (fictional)', accent: 'forest', orientation: 'landscape' } as const;

/** PostgreSQL's "insufficient privilege". Any other error (unknown table, bad request) would not prove a denial. */
const DENIED = '42501';
const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
async function signedIn(who: keyof typeof emails) {
  const client = newClient(); const api = createSupabaseApi(url, key, client);
  await api.signIn(emails[who], password);
  return { client, api };
}

describe.skipIf(!configured)('hosted Supabase project', () => {
  it('refuses every table to anonymous callers and exposes only the two public functions', async () => {
    const anon = newClient();
    for (const table of TABLES) {
      const read = await anon.from(table).select('*').limit(1);
      expect(read.error?.code, `anonymous read of ${table}`).toBe(DENIED);
      expect((await anon.from(table).insert({})).error?.code, `anonymous write to ${table}`).toBe(DENIED);
    }
    for (const fn of ['my_memberships', 'list_review_queue', 'is_platform_admin']) expect((await anon.rpc(fn)).error?.code, fn).toBe(DENIED);
    expect((await anon.rpc('verify_credential', { p_public_id: 'A'.repeat(22) })).data).toBeNull();
    expect((await anon.rpc('exchange_delivery', { p_token: 'A'.repeat(43) })).data).toBeNull();
  });

  it('follows the same rules as the local database on the end-to-end scenario', async () => {
    const owner = await signedIn('owner'); const issuer = await signedIn('issuer'); const viewer = await signedIn('viewer');
    const other = await signedIn('otherOwner'); const admin = await signedIn('admin');
    expect(await admin.api.isPlatformAdmin(), 'the admin test account must be listed in public.platform_admins').toBe(true);
    for (const account of [owner, issuer, viewer, other]) expect(await account.api.isPlatformAdmin()).toBe(false);

    // Re-use the organizations from an earlier run (an account may create at most five).
    const ownedBy = async (api: VeriMarkApi) => (await api.listMemberships()).find(m => m.role === 'owner');
    const main = (await ownedBy(owner.api))?.organizationId ?? (await owner.api.createOrganization('Hosted Verification Main')).id;
    const otherOrg = (await ownedBy(other.api))?.organizationId ?? (await other.api.createOrganization('Hosted Verification Other')).id;
    for (const [account, role, email] of [[issuer, 'issuer', emails.issuer], [viewer, 'viewer', emails.viewer]] as const) {
      if ((await account.api.listMemberships()).some(m => m.organizationId === main)) continue;
      const invite = await owner.api.inviteMember(main, { email, role });
      expect((await account.api.acceptInvite(invite.token)).role).toBe(role);
    }
    let organization = await owner.api.getOrganization(main);
    if (organization.reviewState !== 'reviewed') {
      await admin.api.recordIssuerReview({ organizationId: main, outcome: 'reviewed', reason: 'Hosted verification fixture', expectedRevision: organization.revision });
      organization = await owner.api.getOrganization(main);
    }
    expect(organization.reviewState).toBe('reviewed');
    expect((await other.api.getOrganization(otherOrg)).reviewState, 'the other organization must stay unreviewed').toBe('pending');
    if (!(await owner.api.listTemplates(main)).some(t => !t.archived)) await owner.api.saveTemplate(main, { name: 'Hosted verification', config: { ...TEMPLATE } });

    const apis: Record<Persona, VeriMarkApi> = { owner: owner.api, issuer: issuer.api, viewer: viewer.api, otherOwner: other.api, anonymous: createSupabaseApi(url, key, newClient()) };
    const outcome = await scenario({ org: main, otherOrg, as: async persona => apis[persona] });
    expect(outcome).toMatchObject(REQUIRED_OUTCOMES);
    expect(outcome.validation).toEqual(['VALIDATION', [
      { field: 'expiresOn', code: 'PAST_DATE', row: 2 }, { field: 'recipientDisplayName', code: 'REQUIRED', row: 2 },
      { field: 'recipientEmail', code: 'INVALID', row: 2 }, { field: 'title', code: 'TOO_LONG', row: 2 }]]);

    // Direct table access with a real session: writes refused, reads limited to the caller's organization and safe columns.
    for (const table of TABLES) {
      expect((await viewer.client.from(table).insert({})).error?.code, `member write to ${table}`).toBe(DENIED);
    }
    for (const table of TABLES.filter(t => !MEMBER_READABLE.includes(t))) expect((await owner.client.from(table).select('*').limit(1)).error?.code, `member read of ${table}`).toBe(DENIED);
    expect((await owner.client.from('credentials').select('recipient_email').limit(1)).error?.code).toBe(DENIED);
    expect((await owner.client.from('credential_events').select('reason').limit(1)).error?.code).toBe(DENIED);
    const visible = await other.client.from('credentials').select('organization_id');
    expect(visible.error).toBeNull();
    expect((visible.data ?? []).every(row => row.organization_id === otherOrg)).toBe(true);
    const mine = await owner.client.from('credentials').select('organization_id');
    expect((mine.data ?? []).length).toBeGreaterThan(0);
    expect((mine.data ?? []).every(row => row.organization_id === main)).toBe(true);
    expect((await owner.client.from('credentials').update({ title: 'Tampered' }).eq('organization_id', main)).error?.code).toBe(DENIED);
    // A platform administrator has no implicit access to tenant data.
    expect((await admin.client.from('credentials').select('id')).data ?? []).toEqual([]);
    await expect(admin.api.listCredentials(main)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(owner.api.recordIssuerReview({ organizationId: otherOrg, outcome: 'reviewed', reason: 'self-service', expectedRevision: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }, 180_000);
});

describe.skipIf(configured)('hosted Supabase project (not configured)', () => {
  it('is skipped until supabase/hosted/README.md has been followed', () => { expect(configured).toBe(false); });
});
