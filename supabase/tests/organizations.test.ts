import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issue, platformAdmin, row, tenant, TEMPLATE_CONFIG, TestDb, uuid, type Tenant } from './harness';

// US-001/US-008, AUTH-03/05: bootstrap, last-owner protection, invitations, platform review, templates, history.
let db: TestDb; let admin: string; let t: Tenant;
beforeAll(async () => { db = await TestDb.create(); admin = await platformAdmin(db); t = await tenant(db, admin, 'alpha'); });
afterAll(() => db.close());
const role = async (org: string, user: string) => (await db.admin<{ role: string }>('select role from public.organization_members where organization_id = $1 and user_id = $2', [org, user]))[0]?.role;

describe('accounts and organizations', () => {
  it('a new account gets a profile from safe metadata only', async () => {
    const id = await db.user('new-person');
    expect(await db.admin('select display_name from public.profiles where id = $1', [id])).toEqual([{ display_name: 'new-person' }]);
    await db.admin("insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-8000-999999999999', 'x@example.test', '{\"role\":\"owner\",\"is_admin\":true}')");
    expect(await db.admin("select count(*)::int as n from public.platform_admins where user_id = '00000000-0000-4000-8000-999999999999'")).toEqual([{ n: 0 }]);
    expect(await db.admin("select display_name from public.profiles where id = '00000000-0000-4000-8000-999999999999'")).toEqual([{ display_name: 'x' }]);
  });
  it('creating an organization makes the caller its only owner, pending review', async () => {
    const user = await db.user('founder');
    const org = await db.rpc<{ id: string; reviewState: string; revision: number }>(user, 'create_organization', { p_display_name: '  Northgate Guild  ' });
    expect(org).toMatchObject({ reviewState: 'pending', revision: 1, displayName: 'Northgate Guild' });
    expect(await db.rpc(user, 'my_memberships')).toEqual([{ organizationId: org.id, organizationName: 'Northgate Guild', role: 'owner', reviewState: 'pending' }]);
    expect((await db.fails(db.rpc(user, 'create_organization', { p_display_name: ' ' }))).code).toBe('VALIDATION');
    expect((await db.fails(db.rpc(user, 'create_organization', { p_display_name: 'x'.repeat(121) }))).code).toBe('VALIDATION');
  });
  it('caps organizations per account', async () => {
    const user = await db.user('prolific');
    for (let i = 0; i < 5; i++) await db.rpc(user, 'create_organization', { p_display_name: `Org ${i}` });
    expect((await db.fails(db.rpc(user, 'create_organization', { p_display_name: 'One too many' }))).code).toBe('RATE_LIMITED');
  });
  it('rename needs the current revision', async () => {
    const current = await db.rpc<{ revision: number }>(t.owner, 'get_organization', { p_org: t.org });
    expect((await db.fails(db.rpc(t.owner, 'rename_organization', { p_org: t.org, p_display_name: 'Stale', p_expected_revision: current.revision - 1 }))).code).toBe('REVISION_CONFLICT');
    const renamed = await db.rpc<{ revision: number; displayName: string }>(t.owner, 'rename_organization', { p_org: t.org, p_display_name: 'Alpha Renamed', p_expected_revision: current.revision });
    expect(renamed).toMatchObject({ displayName: 'Alpha Renamed', revision: current.revision + 1 });
  });
  it('issued records keep the issuer name they were issued under', async () => {
    const s = await tenant(db, admin, 'snapshot'); const [c] = await issue(db, s, [row('Snapshot Person')]);
    const org = await db.rpc<{ revision: number }>(s.owner, 'get_organization', { p_org: s.org });
    await db.rpc(s.owner, 'rename_organization', { p_org: s.org, p_display_name: 'Entirely New Name', p_expected_revision: org.revision });
    expect((await db.rpc<{ issuer: { displayName: string } }>(null, 'verify_credential', { p_public_id: c.publicId })).issuer.displayName).toBe('snapshot Collective');
  });
});

describe('members', () => {
  it('the last owner cannot be demoted or removed, including by themselves', async () => {
    expect((await db.fails(db.rpc(t.owner, 'set_member_role', { p_org: t.org, p_user: t.owner, p_role: 'viewer' }))).code).toBe('INVALID_TRANSITION');
    expect((await db.fails(db.rpc(t.owner, 'remove_member', { p_org: t.org, p_user: t.owner }))).code).toBe('INVALID_TRANSITION');
    expect(await role(t.org, t.owner)).toBe('owner');
  });
  it('ownership can be shared and then the first owner may step down', async () => {
    const s = await tenant(db, admin, 'handover');
    await db.rpc(s.owner, 'set_member_role', { p_org: s.org, p_user: s.issuer, p_role: 'owner' });
    await db.rpc(s.issuer, 'set_member_role', { p_org: s.org, p_user: s.owner, p_role: 'viewer' });
    expect(await role(s.org, s.owner)).toBe('viewer');
    expect((await db.fails(db.rpc(s.owner, 'set_member_role', { p_org: s.org, p_user: s.owner, p_role: 'owner' }))).code).toBe('FORBIDDEN');
    expect((await db.fails(db.rpc(s.issuer, 'remove_member', { p_org: s.org, p_user: s.issuer }))).code).toBe('INVALID_TRANSITION');
  });
  it('rejects unknown roles and unknown members', async () => {
    expect((await db.fails(db.rpc(t.owner, 'set_member_role', { p_org: t.org, p_user: t.viewer, p_role: 'platform_admin' }))).code).toBe('VALIDATION');
    expect((await db.fails(db.rpc(t.owner, 'set_member_role', { p_org: t.org, p_user: uuid(), p_role: 'issuer' }))).code).toBe('NOT_FOUND');
  });
});

describe('invitations', () => {
  const invite = (email: string, r = 'issuer') => db.rpc<{ id: string; token: string }>(t.owner, 'create_invite', { p_org: t.org, p_email: email, p_role: r });
  it('stores only a hash, is single use and bound to the invited confirmed address', async () => {
    const invited = await db.user('invited'); const other = await db.user('someone-else'); const unconfirmed = await db.user('unconfirmed', { confirmed: false });
    const created = await invite('Invited@Example.Test');
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await db.admin<{ dump: string }>('select row_to_json(i)::text as dump from public.organization_invites i where id = $1', [created.id]))[0].dump).not.toContain(created.token);
    expect((await db.fails(db.rpc(other, 'accept_invite', { p_token: created.token }))).code).toBe('NOT_FOUND');
    expect(await role(t.org, other)).toBeUndefined();
    const forUnconfirmed = await invite('unconfirmed@example.test');
    expect((await db.fails(db.rpc(unconfirmed, 'accept_invite', { p_token: forUnconfirmed.token }))).code).toBe('NOT_FOUND');
    expect(await db.rpc(invited, 'accept_invite', { p_token: created.token })).toMatchObject({ organizationId: t.org, role: 'issuer' });
    expect((await db.fails(db.rpc(invited, 'accept_invite', { p_token: created.token }))).code).toBe('NOT_FOUND');
  });
  it('cannot grant ownership or platform authority', async () => {
    for (const r of ['owner', 'platform_admin', '']) expect((await db.fails(invite('grant@example.test', r))).code).toBe('VALIDATION');
    expect((await db.fails(invite('not an email'))).code).toBe('VALIDATION');
  });
  it('expired, revoked and superseded invitations fail identically', async () => {
    const user = await db.user('late');
    const expired = await invite('late@example.test');
    await db.admin("update public.organization_invites set expires_at = now() - interval '1 second' where id = $1", [expired.id]);
    expect((await db.fails(db.rpc(user, 'accept_invite', { p_token: expired.token }))).code).toBe('NOT_FOUND');
    const first = await invite('late@example.test'); const second = await invite('late@example.test');
    expect((await db.fails(db.rpc(user, 'accept_invite', { p_token: first.token }))).code).toBe('NOT_FOUND');
    await db.rpc(t.owner, 'revoke_invite', { p_org: t.org, p_invite: second.id });
    expect((await db.fails(db.rpc(user, 'accept_invite', { p_token: second.token }))).code).toBe('NOT_FOUND');
    expect((await db.fails(db.rpc(user, 'accept_invite', { p_token: 'not-a-token' }))).code).toBe('NOT_FOUND');
    expect(await role(t.org, user)).toBeUndefined();
  });
  it('accepting never changes an existing member\'s role', async () => {
    const created = await invite('alpha-owner@example.test', 'viewer');
    expect(await db.rpc(t.owner, 'accept_invite', { p_token: created.token })).toMatchObject({ role: 'owner' });
    expect(await role(t.org, t.owner)).toBe('owner');
  });
  it('only pending invitations are listed, without secrets', async () => {
    await invite('listed@example.test', 'viewer');
    const list = await db.rpc<Record<string, unknown>[]>(t.owner, 'list_invites', { p_org: t.org });
    expect(list.some(i => i.email === 'listed@example.test')).toBe(true);
    for (const i of list) expect(Object.keys(i).sort()).toEqual(['createdAt', 'email', 'expiresAt', 'id', 'role']);
  });
});

describe('platform review', () => {
  it('only platform administrators can review, and never their own organization', async () => {
    const p = await tenant(db, admin, 'reviewme', false);
    for (const actor of [p.owner, p.issuer, t.owner]) {
      expect((await db.fails(db.rpc(actor, 'record_issuer_review', { p_org: p.org, p_outcome: 'reviewed', p_reason: 'Self approval', p_expected_revision: 1 }))).code).toBe('FORBIDDEN');
      expect((await db.fails(db.rpc(actor, 'list_review_queue'))).code).toBe('FORBIDDEN');
      expect(await db.rpc(actor, 'is_platform_admin')).toBe(false);
    }
    expect(await db.rpc(admin, 'is_platform_admin')).toBe(true);
    const own = await db.rpc<{ id: string }>(admin, 'create_organization', { p_display_name: 'Admin Side Project' });
    expect((await db.fails(db.rpc(admin, 'record_issuer_review', { p_org: own.id, p_outcome: 'reviewed', p_reason: 'Mine', p_expected_revision: 1 }))).code).toBe('FORBIDDEN');
    expect((await db.rpc<{ reviewState: string }>(p.owner, 'get_organization', { p_org: p.org })).reviewState).toBe('pending');
  });
  it('records the outcome with a reason and bumps the revision', async () => {
    const p = await tenant(db, admin, 'reviewed-later', false);
    expect((await db.fails(db.rpc(admin, 'record_issuer_review', { p_org: p.org, p_outcome: 'reviewed', p_reason: ' ', p_expected_revision: 1 }))).code).toBe('VALIDATION');
    expect((await db.fails(db.rpc(admin, 'record_issuer_review', { p_org: p.org, p_outcome: 'accredited', p_reason: 'x', p_expected_revision: 1 }))).code).toBe('VALIDATION');
    expect((await db.fails(db.rpc(admin, 'record_issuer_review', { p_org: p.org, p_outcome: 'reviewed', p_reason: 'x', p_expected_revision: 9 }))).code).toBe('REVISION_CONFLICT');
    await db.rpc(admin, 'record_issuer_review', { p_org: p.org, p_outcome: 'reviewed', p_reason: 'Documents checked', p_expected_revision: 1 });
    expect(await db.rpc(p.owner, 'get_organization', { p_org: p.org })).toMatchObject({ reviewState: 'reviewed', revision: 2 });
    const queue = await db.rpc<{ organizationId: string; lastReviewAt: string | null }[]>(admin, 'list_review_queue');
    expect(queue.find(q => q.organizationId === p.org)?.lastReviewAt).not.toBeNull();
  });
  it('a platform administrator has no implicit access to tenant records', async () => {
    expect((await db.fails(db.rpc(admin, 'list_credentials', { p_org: t.org }))).code).toBe('NOT_FOUND');
    expect((await db.fails(db.rpc(admin, 'list_members', { p_org: t.org }))).code).toBe('NOT_FOUND');
    expect(await db.as(admin, 'select 1 from public.credentials where organization_id = $1', [t.org])).toEqual([]);
  });
  it('nobody can grant platform authority through the API', async () => {
    const granting = await db.admin<{ proname: string }>(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and p.prokind = 'f' and pg_get_functiondef(p.oid) ~* '(insert into|update|delete from)\\s+public\\.platform_admins'`);
    expect(granting).toEqual([]);
  });
});

describe('templates', () => {
  it('validates configuration strictly and edits by revision', async () => {
    const save = (config: unknown, id: string | null = null, revision: number | null = null, name = 'Award') => db.rpc<{ id: string; revision: number }>(t.issuer, 'save_template', { p_org: t.org, p_id: id, p_name: name, p_config: config, p_expected_revision: revision });
    for (const bad of [{}, { ...TEMPLATE_CONFIG, accent: 'red' }, { ...TEMPLATE_CONFIG, orientation: 'square' }, { ...TEMPLATE_CONFIG, heading: '' }, { ...TEMPLATE_CONFIG, heading: 'x'.repeat(121) }, { ...TEMPLATE_CONFIG, logoUrl: 'https://example.test/x.svg' }, ['text'], null]) {
      expect((await db.fails(save(bad))).code).toBe('VALIDATION');
    }
    expect((await db.fails(save(TEMPLATE_CONFIG, null, null, ''))).code).toBe('VALIDATION');
    const created = await save(TEMPLATE_CONFIG);
    expect((await db.fails(save(TEMPLATE_CONFIG, created.id, 5))).code).toBe('REVISION_CONFLICT');
    expect((await save({ ...TEMPLATE_CONFIG, accent: 'ink' }, created.id, 1)).revision).toBe(2);
  });
});

describe('history', () => {
  it('lists credentials newest first with stable keyset pages, search and status filter', async () => {
    const s = await tenant(db, admin, 'paging');
    await issue(db, s, Array.from({ length: 7 }, (_, i) => row(`Paged Person ${i}`)));
    const [special] = await issue(db, s, [row('Zed 100%_Special')]);
    await db.rpc(s.issuer, 'revoke_credential', { p_org: s.org, p_credential: special.id, p_reason: 'Test', p_key: uuid() });
    type P = { items: { id: string; status: string; recipientDisplayName: string }[]; nextCursor: string | null };
    const list = (args: Record<string, unknown> = {}) => db.rpc<P>(s.viewer, 'list_credentials', { p_org: s.org, ...args });
    const seen: string[] = []; let cursor: string | null = null; let pages = 0;
    do { const page: P = await list({ p_limit: 3, p_cursor: cursor }); seen.push(...page.items.map(i => i.id)); cursor = page.nextCursor; pages++; } while (cursor);
    expect(pages).toBe(3); expect(seen.length).toBe(8); expect(new Set(seen).size).toBe(8);
    expect((await list({ p_status: 'revoked' })).items.map(i => i.id)).toEqual([special.id]);
    expect((await list({ p_status: 'valid' })).items.length).toBe(7);
    expect((await list({ p_search: '100%_spec' })).items.map(i => i.id)).toEqual([special.id]);
    expect((await list({ p_search: '%' })).items.length).toBe(1);
    expect((await list({ p_search: special.publicId })).items.map(i => i.id)).toEqual([special.id]);
    expect((await list({ p_limit: 100000 })).items.length).toBe(8);
    expect((await db.fails(list({ p_cursor: 'garbage' }))).code).toBe('VALIDATION');
    expect((await db.fails(list({ p_status: 'deleted' }))).code).toBe('VALIDATION');
    expect(await db.rpc(s.viewer, 'get_metrics', { p_org: s.org })).toEqual({ issued: 8, valid: 7, expired: 0, revoked: 1, replaced: 0, verificationChecks: 0 });
  });
  it('audit history is scoped, paginated and names the actor', async () => {
    type A = { items: { id: string; action: string; actorDisplayName: string }[]; nextCursor: string | null };
    const first = await db.rpc<A>(t.viewer, 'list_audit', { p_org: t.org, p_limit: 2 });
    expect(first.items.length).toBe(2); expect(first.nextCursor).not.toBeNull();
    const second = await db.rpc<A>(t.viewer, 'list_audit', { p_org: t.org, p_limit: 2, p_cursor: first.nextCursor });
    expect(Number(second.items[0].id)).toBeLessThan(Number(first.items[1].id));
    const all = await db.rpc<A>(t.viewer, 'list_audit', { p_org: t.org, p_limit: 100 });
    expect(all.items.map(i => i.action)).toContain('organization.created');
    expect(all.items.every(i => typeof i.actorDisplayName === 'string' && i.actorDisplayName.length > 0)).toBe(true);
    expect((await db.fails(db.rpc(t.viewer, 'list_audit', { p_org: t.org, p_cursor: '1; drop table audit_log' }))).code).toBe('VALIDATION');
  });
});
