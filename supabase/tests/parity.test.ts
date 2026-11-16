import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDemoApi, DEMO_PASSWORD } from '../../src/lib/api/demoAdapter';
import { createSupabaseApi } from '../../src/lib/api/supabaseAdapter';
import { platformAdmin, tenant, TestDb, type Tenant } from './harness';
import { REQUIRED_OUTCOMES, scenario, type Persona, type World } from './scenario';

// The demonstration adapter claims to follow the database's rules. This runs one scenario through both and
// requires the same outcomes, so the demonstration cannot drift from the real backend unnoticed.
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
    catch (error) { const e = error as { message: string; detail?: string; code?: string }; return { data: null, error: { message: e.message, details: e.detail ?? null, code: e.code } }; }
  } } as unknown as SupabaseClient);
  return { org: main.org, otherOrg: other.org, viewerEmail: 'parity-viewer@example.test', as: async persona => apiFor(actors[persona]) };
}

async function demoWorld(): Promise<World> {
  const api = createDemoApi({ storage: null });
  const emails: Record<Exclude<Persona, 'anonymous'>, string> = { owner: 'owner@demo.verimark.test', issuer: 'issuer@demo.verimark.test', viewer: 'viewer@demo.verimark.test', otherOwner: 'north@demo.verimark.test' };
  await api.signIn(emails.owner, DEMO_PASSWORD); const org = (await api.listMemberships())[0].organizationId;
  await api.signIn(emails.otherOwner, DEMO_PASSWORD); const otherOrg = (await api.listMemberships())[0].organizationId;
  return { org, otherOrg, viewerEmail: emails.viewer, as: async persona => { await api.signOut(); if (persona !== 'anonymous') await api.signIn(emails[persona], DEMO_PASSWORD); return api; } };
}

describe('demonstration adapter and database agree', () => {
  it('on one end-to-end scenario of rules, refusals and shapes', async () => {
    const database = await scenario(await databaseWorld());
    const demo = await scenario(await demoWorld());
    expect(demo).toEqual(database);
    // Guard against both being wrong in the same way on the points that matter most.
    expect(database).toMatchObject(REQUIRED_OUTCOMES);
  });
});
