import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHostedEnvironment } from '../hosted/environment';
import { CONSENT, ensureFixtures, PERSONAS, readHostedConfig } from '../hosted/fixtures';

const state = vi.hoisted(() => ({ clients: new Map<string, unknown>(), memberships: new Map<string, { organizationId: string; organizationName: string; role: string }[]>(), writes: 0, creates: 0, authentications: 0 }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => {
  state.creates++;
  let selectedEmail = '';
  return { getEmail: () => selectedEmail, auth: { signInWithPassword: async ({ email }: { email: string }) => { state.authentications++; selectedEmail = email; return state.clients.get(email); } } };
} }));
vi.mock('../../src/lib/api/supabaseAdapter', () => ({ createSupabaseApi: (_url: string, _key: string, client: { getEmail(): string }) => ({
  listMemberships: async () => state.memberships.get(client.getEmail()) ?? [],
  isPlatformAdmin: async () => client.getEmail().startsWith('vm-test-admin@'),
  createOrganization: () => { state.writes++; throw new Error('UNEXPECTED WRITE'); },
}) }));

const names = ['OWNER', 'ISSUER', 'VIEWER', 'OTHER_OWNER', 'ADMIN', 'INVITEE'];
const parts = ['owner', 'issuer', 'viewer', 'other', 'admin', 'invitee'];
function environment() {
  const env: Record<string, string> = { VM_TEST_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', VM_TEST_PUBLISHABLE_KEY: 'sb_publishable_fictional', VM_TEST_PROJECT_REF: 'abcdefghijklmnopqrst', VM_HOSTED_TESTS: CONSENT, VM_TEST_PASSWORD: 'fictional-password-only' };
  names.forEach((name, i) => { env[`VM_TEST_${name}_EMAIL`] = `vm-test-${parts[i]}@example.test`; env[`VM_TEST_${name}_ID`] = `00000000-0000-4000-8000-00000000000${i + 1}`; });
  return env;
}

beforeEach(() => { state.clients.clear(); state.memberships.clear(); state.writes = 0; state.creates = 0; state.authentications = 0; });
describe('hosted execution guards (no network)', () => {
  it.each([
    ['VM_HOSTED_TESTS', ''], ['VM_TEST_PROJECT_REF', 'different-project'], ['VM_TEST_PROJECT_REF', ''], ['VM_TEST_PROJECT_REF', 'YOUR_TEST_PROJECT_REF'],
    ['VM_TEST_PROJECT_REF', 'otovaqtmodpqelwbrglj'], ['VM_TEST_SUPABASE_URL', 'https://otovaqtmodpqelwbrglj.supabase.co'],
    ['VM_TEST_PUBLISHABLE_KEY', 'sb_secret_forbidden'],
    ['VM_TEST_OWNER_EMAIL', 'personal@example.test'], ['VM_TEST_OWNER_ID', ''],
    ['VM_TEST_MAIN_ORG_ID', 'not-an-approved-uuid'],
  ])('refuses unsafe configuration %s before authentication', (key, value) => {
    const env = environment(); env[key] = value;
    const result = readHostedConfig(env);
    expect(result.config).toBeNull(); expect(result.problems.length).toBeGreaterThan(0);
    expect(result.problems.join(' ')).not.toContain(env.VM_TEST_PASSWORD);
  });
  it('rejects the protected project even when URL and reference agree', async () => {
    const env = environment(); env.VM_TEST_PROJECT_REF = 'otovaqtmodpqelwbrglj'; env.VM_TEST_SUPABASE_URL = 'https://otovaqtmodpqelwbrglj.supabase.co';
    expect(readHostedConfig(env).config).toBeNull();
    const config = readHostedConfig(environment()).config!;
    await expect(ensureFixtures({ ...config, projectRef: env.VM_TEST_PROJECT_REF, url: env.VM_TEST_SUPABASE_URL })).rejects.toThrow('protected hosted test target');
    expect(state.creates).toBe(0); expect(state.authentications).toBe(0); expect(state.writes).toBe(0);
  });
  it('never falls back to application environment files or ambient VITE credentials', () => {
    const directory = mkdtempSync(join(tmpdir(), 'verimark-environment-'));
    try {
      const url = 'https://otovaqtmodpqelwbrglj.supabase.co';
      writeFileSync(join(directory, '.env.local'), `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fictional\n`);
      const ambient = { ...environment(), VM_TEST_SUPABASE_URL: undefined, VM_TEST_PUBLISHABLE_KEY: undefined, VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictional' };
      expect(readHostedConfig(readHostedEnvironment(directory, ambient)).config).toBeNull();
      writeFileSync(join(directory, '.env.hosted-test.local'), 'VM_TEST_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co\nVM_TEST_PUBLISHABLE_KEY=sb_publishable_fictional\n');
      const { VM_TEST_SUPABASE_URL: unusedUrl, VM_TEST_PUBLISHABLE_KEY: unusedKey, ...withoutTestCredentials } = ambient;
      void unusedUrl; void unusedKey;
      expect(readHostedConfig(readHostedEnvironment(directory, withoutTestCredentials)).config?.projectRef).toBe('abcdefghijklmnopqrst');
      expect(state.creates).toBe(0); expect(state.authentications).toBe(0); expect(state.writes).toBe(0);
    } finally { rmSync(directory, { recursive: true }); }
  });

  it('refuses a signed-in identity whose UUID differs from the approved account', async () => {
    const config = readHostedConfig(environment()).config!;
    for (const persona of PERSONAS) state.clients.set(config.emails[persona], { data: { session: { user: { id: persona === 'owner' ? 'wrong-account' : config.userIds[persona], email: config.emails[persona], email_confirmed_at: '2026-01-01' } } }, error: null });
    await expect(ensureFixtures(config)).rejects.toThrow('approved confirmed UUID');
  });

  it('refuses duplicate UUIDs even with six different fictional addresses', () => {
    const env = environment(); env.VM_TEST_VIEWER_ID = env.VM_TEST_OWNER_ID;
    expect(readHostedConfig(env).config).toBeNull();
  });
  it('rejects a same-named but unapproved organization before any application write', async () => {
    const config = readHostedConfig(environment()).config!;
    for (const persona of PERSONAS) state.clients.set(config.emails[persona], { data: { session: { user: { id: config.userIds[persona], email: config.emails[persona], email_confirmed_at: '2026-01-01' } } }, error: null });
    state.memberships.set(config.emails.owner, [{ organizationId: 'unapproved', organizationName: 'VM Test Main (automated)', role: 'owner' }]);
    await expect(ensureFixtures(config)).rejects.toThrow('unapproved membership');
    expect(state.writes).toBe(0);
  });
  it('refuses an unexpected issuer role before repairing any missing fixture', async () => {
    const env = environment(); env.VM_TEST_MAIN_ORG_ID = '00000000-0000-4000-8000-000000000099';
    const config = readHostedConfig(env).config!;
    for (const persona of PERSONAS) state.clients.set(config.emails[persona], { data: { session: { user: { id: config.userIds[persona], email: config.emails[persona], email_confirmed_at: '2026-01-01' } } }, error: null });
    state.memberships.set(config.emails.owner, [{ organizationId: config.mainOrgId!, organizationName: 'VM Test Main (automated)', role: 'owner' }]);
    state.memberships.set(config.emails.issuer, [{ organizationId: config.mainOrgId!, organizationName: 'VM Test Main (automated)', role: 'owner' }]);
    await expect(ensureFixtures(config)).rejects.toThrow('unapproved membership');
    expect(state.writes).toBe(0);
  });
});

