import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issue, platformAdmin, row, tenant, TestDb, uuid, type Issued, type Tenant } from './harness';

// AUTH-01/02/04, DB-01/05/06: every denial is checked through the real anon/authenticated roles, never as the owner.
let db: TestDb; let admin: string; let a: Tenant; let b: Tenant; let outsider: string; let credA: Issued; let credB: Issued;
const TABLES = ['profiles', 'organizations', 'organization_members', 'organization_invites', 'platform_admins', 'issuer_reviews', 'credential_templates',
  'credential_batches', 'batch_rows', 'batch_approvals', 'credentials', 'credential_events', 'delivery_capabilities', 'idempotency_receipts', 'audit_log',
  'verification_counters', 'rate_windows'];
let FIRST_COLUMN: Record<string, string> = {};
const MEMBER_READABLE = ['organizations', 'organization_members', 'credential_templates', 'credentials', 'credential_events', 'audit_log'];

beforeAll(async () => {
  db = await TestDb.create();
  admin = await platformAdmin(db);
  a = await tenant(db, admin, 'alpha');
  b = await tenant(db, admin, 'beta');
  outsider = await db.user('outsider');
  FIRST_COLUMN = Object.fromEntries((await db.admin<{ t: string; c: string }>("select table_name as t, column_name as c from information_schema.columns where table_schema = 'public' and ordinal_position = 2")).map(r => [r.t, r.c]));
  [credA] = await issue(db, a, [row('Alex Santos', { recipientEmail: 'alex@example.test' })]);
  [credB] = await issue(db, b, [row('Nina Reyes', { recipientEmail: 'nina@example.test' })]);
});
afterAll(() => db.close());

describe('anonymous callers', () => {
  it.each(TABLES)('cannot read or write table %s', async table => {
    for (const sql of [`select * from public.${table} limit 1`, `delete from public.${table}`, `update public.${table} set ${FIRST_COLUMN[table]} = ${FIRST_COLUMN[table]}`]) {
      await expect(db.as(null, sql)).rejects.toThrow(/permission denied/);
    }
  });
  it('can execute only the two public functions', async () => {
    const callable = await db.admin<{ name: string }>(`select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and has_function_privilege('anon', p.oid, 'execute') order by 1`);
    expect(callable.map(f => f.name)).toEqual(['exchange_delivery', 'verify_credential']);
  });
  it('is refused by member operations it could reach only by a grant mistake', async () => {
    await expect(db.rpc(null, 'my_memberships')).rejects.toThrow(/permission denied/);
    await expect(db.rpc(null, 'list_credentials', { p_org: a.org })).rejects.toThrow(/permission denied/);
  });
  it('cannot use internal helpers', async () => {
    await expect(db.as(null, 'select app.is_member($1)', [a.org])).rejects.toThrow(/permission denied/);
    await expect(db.as(a.owner, 'select app.random_token(16)')).rejects.toThrow(/permission denied/);
    await expect(db.as(a.owner, "select app.audit($1, 'forged', 'x', null, 'x')", [a.org])).rejects.toThrow(/permission denied/);
  });
});

describe('authenticated callers and base tables', () => {
  it.each(TABLES)('cannot insert, update or delete in %s', async table => {
    await expect(db.as(a.owner, `delete from public.${table}`)).rejects.toThrow(/permission denied/);
    await expect(db.as(a.owner, `insert into public.${table} default values`)).rejects.toThrow(/permission denied/);
  });
  it.each(TABLES.filter(t => !MEMBER_READABLE.includes(t)))('cannot read private table %s', async table => {
    await expect(db.as(a.owner, `select * from public.${table} limit 1`)).rejects.toThrow(/permission denied/);
  });
  it('cannot read private columns of readable tables', async () => {
    await expect(db.as(a.owner, 'select recipient_email from public.credentials')).rejects.toThrow(/permission denied/);
    await expect(db.as(a.owner, 'select snapshot_digest from public.credentials')).rejects.toThrow(/permission denied/);
    await expect(db.as(a.owner, 'select reason from public.credential_events')).rejects.toThrow(/permission denied/);
    await expect(db.as(a.owner, 'select actor_id from public.audit_log')).rejects.toThrow(/permission denied/);
  });
  it('row level security limits readable tables to the caller\'s organizations', async () => {
    for (const member of [a.owner, a.issuer, a.viewer]) {
      expect((await db.as<{ organization_id: string }>(member, 'select organization_id from public.credentials')).map(r => r.organization_id)).toEqual([a.org]);
      expect((await db.as<{ id: string }>(member, 'select id from public.organizations')).map(r => r.id)).toEqual([a.org]);
      expect(await db.as(member, 'select 1 from public.organization_members where organization_id = $1', [b.org])).toEqual([]);
      expect(await db.as(member, 'select 1 from public.credential_templates where organization_id = $1', [b.org])).toEqual([]);
      expect(await db.as(member, 'select 1 from public.credential_events where organization_id = $1', [b.org])).toEqual([]);
      expect(await db.as(member, 'select 1 from public.audit_log where organization_id = $1', [b.org])).toEqual([]);
    }
    for (const table of MEMBER_READABLE) expect(await db.as(outsider, `select 1 from public.${table}`)).toEqual([]);
  });
  it('every table has row level security enabled', async () => {
    const rows = await db.admin<{ relname: string }>(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows).toEqual([]);
  });
  it('every exposed function is security definer with an empty search_path', async () => {
    const rows = await db.admin<{ proname: string }>(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and (not p.prosecdef or not coalesce(p.proconfig, '{}') @> array['search_path=""'])`);
    expect(rows).toEqual([]);
  });
});

describe('cross-tenant requests are indistinguishable from missing records', () => {
  const key = () => uuid();
  it.each([
    ['get_organization', () => ({ p_org: b.org })],
    ['rename_organization', () => ({ p_org: b.org, p_display_name: 'Taken over', p_expected_revision: 2 })],
    ['list_members', () => ({ p_org: b.org })],
    ['set_member_role', () => ({ p_org: b.org, p_user: a.owner, p_role: 'owner' })],
    ['remove_member', () => ({ p_org: b.org, p_user: b.viewer })],
    ['list_invites', () => ({ p_org: b.org })],
    ['create_invite', () => ({ p_org: b.org, p_email: 'alpha-owner@example.test', p_role: 'issuer' })],
    ['list_templates', () => ({ p_org: b.org })],
    ['save_template', () => ({ p_org: b.org, p_id: b.template, p_name: 'x', p_config: {}, p_expected_revision: 1 })],
    ['archive_template', () => ({ p_org: b.org, p_id: b.template })],
    ['create_batch', () => ({ p_org: b.org, p_template: b.template, p_source: 'single', p_rows: [row('Forged')] })],
    ['list_credentials', () => ({ p_org: b.org })],
    ['get_credential', () => ({ p_org: b.org, p_credential: credB.id })],
    ['revoke_credential', () => ({ p_org: b.org, p_credential: credB.id, p_reason: 'forged', p_key: key() })],
    ['replace_credential', () => ({ p_org: b.org, p_credential: credB.id, p_reason: 'forged', p_replacement: row('Forged'), p_key: key() })],
    ['create_delivery_link', () => ({ p_org: b.org, p_credential: credB.id })],
    ['list_audit', () => ({ p_org: b.org })],
    ['get_metrics', () => ({ p_org: b.org })],
  ])('%s on another organization is NOT_FOUND for owner, issuer, viewer and outsider', async (name, args) => {
    for (const actor of [a.owner, a.issuer, a.viewer, outsider]) expect((await db.fails(db.rpc(actor, name, args()))).code).toBe('NOT_FOUND');
  });
  it('own organization id with another organization\'s record id is NOT_FOUND and changes nothing', async () => {
    expect((await db.fails(db.rpc(a.owner, 'get_credential', { p_org: a.org, p_credential: credB.id }))).code).toBe('NOT_FOUND');
    expect((await db.fails(db.rpc(a.owner, 'revoke_credential', { p_org: a.org, p_credential: credB.id, p_reason: 'forged', p_key: key() }))).code).toBe('NOT_FOUND');
    expect((await db.fails(db.rpc(a.owner, 'create_delivery_link', { p_org: a.org, p_credential: credB.id }))).code).toBe('NOT_FOUND');
    expect((await db.fails(db.rpc(a.owner, 'create_batch', { p_org: a.org, p_template: b.template, p_source: 'single', p_rows: [row('Forged')] }))).code).toBe('NOT_FOUND');
    expect((await db.fails(db.rpc(a.owner, 'save_template', { p_org: a.org, p_id: b.template, p_name: 'x', p_config: { heading: 'h', bodyPrefix: 'b', signatoryName: 's', signatoryTitle: 't', accent: 'ink', orientation: 'portrait' }, p_expected_revision: 1 }))).code).toBe('NOT_FOUND');
    expect(await db.admin('select revoked_at from public.credentials where id = $1', [credB.id])).toEqual([{ revoked_at: null }]);
    expect(await db.admin('select count(*)::int as n from public.delivery_capabilities where credential_id = $1', [credB.id])).toEqual([{ n: 0 }]);
  });
});

describe('role limits inside an organization', () => {
  it('viewer cannot perform any write', async () => {
    const calls: [string, Record<string, unknown>][] = [
      ['rename_organization', { p_org: a.org, p_display_name: 'x', p_expected_revision: 2 }],
      ['set_member_role', { p_org: a.org, p_user: a.viewer, p_role: 'owner' }],
      ['remove_member', { p_org: a.org, p_user: a.issuer }],
      ['list_invites', { p_org: a.org }],
      ['create_invite', { p_org: a.org, p_email: 'friend@example.test', p_role: 'issuer' }],
      ['save_template', { p_org: a.org, p_id: null, p_name: 'x', p_config: {}, p_expected_revision: null }],
      ['archive_template', { p_org: a.org, p_id: a.template }],
      ['create_batch', { p_org: a.org, p_template: a.template, p_source: 'single', p_rows: [row('Forged')] }],
      ['revoke_credential', { p_org: a.org, p_credential: credA.id, p_reason: 'x', p_key: uuid() }],
      ['replace_credential', { p_org: a.org, p_credential: credA.id, p_reason: 'x', p_replacement: row('Forged'), p_key: uuid() }],
      ['create_delivery_link', { p_org: a.org, p_credential: credA.id }],
    ];
    const before = await db.admin('select count(*)::int as n from public.audit_log where organization_id = $1', [a.org]);
    for (const [name, args] of calls) expect((await db.fails(db.rpc(a.viewer, name, args))).code, name).toBe('FORBIDDEN');
    expect(await db.admin('select count(*)::int as n from public.audit_log where organization_id = $1', [a.org])).toEqual(before);
  });
  it('issuer cannot manage members, invites or the organization name', async () => {
    for (const [name, args] of [
      ['rename_organization', { p_org: a.org, p_display_name: 'x', p_expected_revision: 2 }],
      ['set_member_role', { p_org: a.org, p_user: a.issuer, p_role: 'owner' }],
      ['remove_member', { p_org: a.org, p_user: a.viewer }],
      ['create_invite', { p_org: a.org, p_email: 'friend@example.test', p_role: 'issuer' }],
      ['list_invites', { p_org: a.org }],
    ] as const) expect((await db.fails(db.rpc(a.issuer, name, args))).code, name).toBe('FORBIDDEN');
  });
  it('viewer reads records but never the private contact or reasons', async () => {
    const detail = await db.rpc<{ recipientEmail: string | null; recipientDisplayName: string }>(a.viewer, 'get_credential', { p_org: a.org, p_credential: credA.id });
    expect(detail.recipientDisplayName).toBe('Alex Santos');
    expect(detail.recipientEmail).toBeNull();
    expect((await db.rpc<{ recipientEmail: string }>(a.issuer, 'get_credential', { p_org: a.org, p_credential: credA.id })).recipientEmail).toBe('alex@example.test');
    const list = await db.rpc<{ items: Record<string, unknown>[] }>(a.viewer, 'list_credentials', { p_org: a.org });
    expect(JSON.stringify(list)).not.toContain('alex@example.test');
  });
  it('a removed member loses access immediately', async () => {
    const temp = await db.user('alpha-temp');
    const invite = await db.rpc<{ token: string }>(a.owner, 'create_invite', { p_org: a.org, p_email: 'alpha-temp@example.test', p_role: 'issuer' });
    await db.rpc(temp, 'accept_invite', { p_token: invite.token });
    expect((await db.rpc<{ items: unknown[] }>(temp, 'list_credentials', { p_org: a.org })).items.length).toBe(1);
    await db.rpc(a.owner, 'remove_member', { p_org: a.org, p_user: temp });
    expect((await db.fails(db.rpc(temp, 'list_credentials', { p_org: a.org }))).code).toBe('NOT_FOUND');
    expect((await db.fails(db.rpc(temp, 'create_batch', { p_org: a.org, p_template: a.template, p_source: 'single', p_rows: [row('Late')] }))).code).toBe('NOT_FOUND');
    expect(await db.as(temp, 'select 1 from public.credentials')).toEqual([]);
  });
  it('a caller without a session subject is unauthenticated even with the authenticated role', async () => {
    await db.pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role authenticated");
    try { await expect(db.pg.query('select public.my_memberships()')).rejects.toThrow('VM:UNAUTHENTICATED'); }
    finally { await db.pg.exec('reset role'); }
  });
});

describe('history cannot be rewritten, even by the database owner path used by functions', () => {
  it('issued content is immutable and records cannot be deleted', async () => {
    await expect(db.admin("update public.credentials set recipient_display_name = 'Changed' where id = $1", [credA.id])).rejects.toThrow('VM:INVALID_TRANSITION');
    await expect(db.admin("update public.credentials set expires_at = now() + interval '9 years' where id = $1", [credA.id])).rejects.toThrow('VM:INVALID_TRANSITION');
    await expect(db.admin("update public.credentials set public_id = 'AAAAAAAAAAAAAAAAAAAAAA' where id = $1", [credA.id])).rejects.toThrow('VM:INVALID_TRANSITION');
    await expect(db.admin('delete from public.credentials where id = $1', [credA.id])).rejects.toThrow('VM:INVALID_TRANSITION');
    await expect(db.admin('truncate public.credentials cascade')).rejects.toThrow('VM:INVALID_TRANSITION');
  });
  it.each(['credential_events', 'audit_log', 'issuer_reviews', 'batch_approvals'])('%s cannot be truncated', async table => {
    await expect(db.admin(`truncate public.${table} cascade`)).rejects.toThrow('VM:INVALID_TRANSITION');
  });
  it.each(['credential_events', 'audit_log', 'issuer_reviews', 'batch_approvals'])('%s is append-only', async table => {
    await expect(db.admin(`update public.${table} set organization_id = organization_id`)).rejects.toThrow('VM:INVALID_TRANSITION');
    await expect(db.admin(`delete from public.${table}`)).rejects.toThrow('VM:INVALID_TRANSITION');
  });
});

describe('objects added by a later migration', () => {
  it('are not reachable by clients until granted explicitly', async () => {
    await db.script(`create table public.future_table (id int primary key, secret text);
      insert into public.future_table values (1, 'x');
      create function public.future_probe() returns text language sql security definer set search_path = '' as $f$ select 'exposed' $f$;
      create function app.future_helper() returns text language sql as $f$ select 'exposed' $f$;`);
    for (const actor of [null, a.owner]) {
      await expect(db.as(actor, 'select public.future_probe()')).rejects.toThrow(/permission denied/);
      await expect(db.as(actor, 'select app.future_helper()')).rejects.toThrow(/permission denied/);
      await expect(db.as(actor, 'select * from public.future_table')).rejects.toThrow(/permission denied/);
    }
  });
});
