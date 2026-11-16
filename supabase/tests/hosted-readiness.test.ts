import { afterAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseApi } from '../../src/lib/api/supabaseAdapter';
import { ApiError } from '../../src/lib/api/types';
import { platformAdmin, tenant, TestDb } from './harness';

// Conditions a real Supabase project can have that a fresh in-memory database does not.
const open: TestDb[] = [];
afterAll(async () => { for (const db of open) await db.close(); });
const make = async (before = '') => { const db = await TestDb.create(before); open.push(db); return db; };

describe('applying the migration to a project that is already in use', () => {
  it('gives accounts that existed before the migration a profile, so they can use the application', async () => {
    const early = '00000000-0000-4000-8000-00000000e001'; const nameless = '00000000-0000-4000-8000-00000000e002';
    const db = await make(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
      ('${early}', 'early.bird@example.test', now(), '{"display_name":"Early Bird"}'),
      ('${nameless}', 'nameless@example.test', now(), '{}');`);
    expect(await db.admin('select id, display_name from public.profiles order by id')).toEqual([
      { id: early, display_name: 'Early Bird' }, { id: nameless, display_name: 'nameless' }]);
    const org = await db.rpc<{ id: string }>(early, 'create_organization', { p_display_name: 'Founded Before Migration' });
    expect(await db.rpc(early, 'my_memberships')).toEqual([{ organizationId: org.id, organizationName: 'Founded Before Migration', role: 'owner', reviewState: 'pending' }]);
  });

  it('works when the API roles start with no access to the public schema at all', async () => {
    const db = await make();
    const admin = await platformAdmin(db); const t = await tenant(db, admin, 'strict');
    expect((await db.rpc<unknown[]>(t.viewer, 'list_members', { p_org: t.org })).length).toBe(3);
    expect(await db.rpc(null, 'verify_credential', { p_public_id: 'A'.repeat(22) })).toBeNull();
    expect((await db.as<{ id: string }>(t.owner, 'select id from public.organizations')).map(r => r.id)).toEqual([t.org]);
  });

  it('is unaffected by row level security having been switched on automatically beforehand', async () => {
    // Stand-in for the project option that enables RLS on every new table in public as it is created.
    const db = await make(`create function public.auto_rls() returns event_trigger language plpgsql as $f$
      declare r record; begin
        for r in select * from pg_event_trigger_ddl_commands() where command_tag = 'CREATE TABLE' and schema_name = 'public' loop
          execute format('alter table %s enable row level security', r.object_identity);
        end loop;
      end $f$;
      create event trigger auto_rls on ddl_command_end when tag in ('CREATE TABLE') execute function public.auto_rls();`);
    const admin = await platformAdmin(db); const t = await tenant(db, admin, 'autorls');
    expect((await db.rpc<{ items: unknown[] }>(t.viewer, 'list_credentials', { p_org: t.org })).items).toEqual([]);
    expect(await db.admin("select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")).toEqual([{ n: 0 }]);
  });
});

describe('identifiers that are not UUIDs', () => {
  it('are reported as not found, not as a temporary outage', async () => {
    const db = await make(); const admin = await platformAdmin(db); const t = await tenant(db, admin, 'ids');
    const api = createSupabaseApi('http://localhost', 'k', { rpc: async (name: string, args: Record<string, unknown>) => {
      try { return { data: await db.rpc(t.owner, name, args), error: null }; }
      catch (error) { const e = error as { message: string; detail?: string; code?: string }; return { data: null, error: { message: e.message, details: e.detail ?? null, code: e.code } }; }
    } } as unknown as SupabaseClient);
    for (const run of [api.getCredential(t.org, 'not-a-uuid'), api.getCredential('org_demo_fieldwork', crypto.randomUUID()), api.listCredentials('../../etc')]) {
      const error = await run.then(() => null, e => e as unknown);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('NOT_FOUND');
      expect((error as ApiError).retryable).toBe(false);
    }
  });
});
