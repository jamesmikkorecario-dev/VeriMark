import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Minimal stand-in for the parts of a Supabase project the migrations rely on: the API roles, the auth schema,
// auth.uid(), and Supabase's default privileges (which grant new public tables and functions to the API roles,
// so the migration's explicit revokes are really exercised).
const SUPABASE_SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create schema auth;
create table auth.users (id uuid primary key, email text unique, email_confirmed_at timestamptz, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
export type Actor = string | null;
export interface VmError { code: string; detail: string; raw: string }

export class TestDb {
  private constructor(readonly pg: PGlite) {}
  private n = 0;

  static async create(): Promise<TestDb> {
    const pg = new PGlite({ extensions: { pgcrypto } });
    await pg.exec(SUPABASE_SHIM);
    for (const file of readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql')).sort()) await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    return new TestDb(pg);
  }
  close() { return this.pg.close(); }

  /** Runs as the database owner (bypasses RLS). Test setup and assertions only. */
  /** Several statements as the database owner. */
  async script(sql: string): Promise<void> {
    await this.pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false)");
    await this.pg.exec(sql);
  }
  async admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false)");
    return (await this.pg.query<T>(sql, params)).rows;
  }
  /** Runs one statement as the API would: role authenticated with that user's JWT subject, or role anon for null. */
  async as<T = Record<string, unknown>>(actor: Actor, sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${actor ?? ''}', false); set role ${actor ? 'authenticated' : 'anon'}`);
    try { return (await this.pg.query<T>(sql, params)).rows; }
    finally { await this.pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false)"); }
  }
  /** Calls a public function with named arguments like PostgREST's /rpc endpoint and returns its single value. */
  async rpc<T = unknown>(actor: Actor, name: string, args: Record<string, unknown> = {}): Promise<T> {
    const keys = Object.keys(args);
    const list = keys.map((key, index) => `${key} => $${index + 1}`).join(', ');
    const rows = await this.as<{ result: T }>(actor, `select public.${name}(${list}) as result`, keys.map(key => {
      const value = args[key];
      return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
    }));
    return rows[0].result;
  }
  /** Resolves with the VM error a call fails with; rejects if the call succeeds. */
  async fails(run: Promise<unknown>): Promise<VmError> {
    try { await run; } catch (error) {
      const e = error as { message?: string; detail?: string };
      const match = /^VM:([A-Z_]+)$/.exec(e.message ?? '');
      return { code: match ? match[1] : 'DATABASE', detail: e.detail ?? '', raw: e.message ?? String(error) };
    }
    throw new Error('expected the call to fail, but it succeeded');
  }
  async user(name: string, options: { confirmed?: boolean } = {}): Promise<string> {
    const id = `00000000-0000-4000-8000-${String(++this.n).padStart(12, '0')}`;
    await this.admin('insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3, $4)',
      [id, `${name}@example.test`, options.confirmed === false ? null : new Date().toISOString(), JSON.stringify({ display_name: name })]);
    return id;
  }
}

export const TEMPLATE_CONFIG = { heading: 'Certificate of Completion', bodyPrefix: 'This certifies that', signatoryName: 'Mika Chen', signatoryTitle: 'Programme Lead', accent: 'forest', orientation: 'landscape' };
export const row = (name: string, extra: Record<string, unknown> = {}) => ({ recipientDisplayName: name, title: 'Community Research Workshop', achievement: 'Completed all sessions', ...extra });
export const uuid = () => crypto.randomUUID();

export interface Tenant { org: string; owner: string; issuer: string; viewer: string; template: string }
/** A reviewed organization with one member of each role and one template. */
export async function tenant(db: TestDb, admin: string, label: string, reviewed = true): Promise<Tenant> {
  const [owner, issuer, viewer] = [await db.user(`${label}-owner`), await db.user(`${label}-issuer`), await db.user(`${label}-viewer`)];
  const org = (await db.rpc<{ id: string }>(owner, 'create_organization', { p_display_name: `${label} Collective` })).id;
  for (const [user, role] of [[issuer, 'issuer'], [viewer, 'viewer']] as const) {
    const invite = await db.rpc<{ token: string }>(owner, 'create_invite', { p_org: org, p_email: `${label}-${role}@example.test`, p_role: role });
    await db.rpc(user, 'accept_invite', { p_token: invite.token });
  }
  if (reviewed) await db.rpc(admin, 'record_issuer_review', { p_org: org, p_outcome: 'reviewed', p_reason: 'Synthetic fixture review', p_expected_revision: 1 });
  const template = (await db.rpc<{ id: string }>(owner, 'save_template', { p_org: org, p_id: null, p_name: 'Standard', p_config: TEMPLATE_CONFIG, p_expected_revision: null })).id;
  return { org, owner, issuer, viewer, template };
}
export async function platformAdmin(db: TestDb): Promise<string> {
  const id = await db.user('platform-admin');
  await db.admin('insert into public.platform_admins (user_id) values ($1)', [id]);
  return id;
}
export interface Issued { id: string; publicId: string; sourceRow: number }
/** Full pipeline: draft, preview, approve, issue. */
export async function issue(db: TestDb, t: Tenant, rows: unknown[], actor = t.issuer): Promise<Issued[]> {
  const batch = await db.rpc<{ batchId: string; revision: number }>(actor, 'create_batch', { p_org: t.org, p_template: t.template, p_source: rows.length === 1 ? 'single' : 'csv', p_rows: rows });
  const preview = await db.rpc<{ previewDigest: string }>(actor, 'preview_batch', { p_org: t.org, p_batch: batch.batchId });
  const approval = await db.rpc<{ approvalId: string }>(actor, 'approve_batch', { p_org: t.org, p_batch: batch.batchId, p_expected_revision: batch.revision, p_preview_digest: preview.previewDigest });
  return (await db.rpc<{ credentials: Issued[] }>(actor, 'issue_batch', { p_org: t.org, p_batch: batch.batchId, p_approval: approval.approvalId, p_key: uuid() })).credentials;
}
