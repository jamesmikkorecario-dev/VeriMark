import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseApi } from '../../src/lib/api/supabaseAdapter';
import type { VeriMarkApi } from '../../src/lib/api/types';

// Shared set-up for every test that talks to a real Supabase project (API-level and browser).
// It only ever signs in as the six dedicated fictional test accounts and only ever writes inside the two test
// organizations those accounts own. It never prints a key, password or token.

export type TestPersona = 'owner' | 'issuer' | 'viewer' | 'otherOwner' | 'admin' | 'invitee';
export const PERSONAS: readonly TestPersona[] = ['owner', 'issuer', 'viewer', 'otherOwner', 'admin', 'invitee'];
export const CONSENT = 'I-understand-this-writes-test-data';
export const MAIN_ORG = 'VM Test Main (automated)';
export const OTHER_ORG = 'VM Test Other (automated)';
export const TEMPLATE_NAME = 'VM Test Certificate';
export const SEED_RECIPIENT = 'VM Seed Fictional';
const TEMPLATE = { heading: 'Certificate of Completion', bodyPrefix: 'This certifies that', signatoryName: 'Test Signatory', signatoryTitle: 'Automated test (fictional)', accent: 'forest', orientation: 'landscape' } as const;
/** Each test address must start with this exact local part, so a real person's account can never be configured by mistake. */
const LOCAL_PART: Record<TestPersona, string> = { owner: 'vm-test-owner', issuer: 'vm-test-issuer', viewer: 'vm-test-viewer', otherOwner: 'vm-test-other', admin: 'vm-test-admin', invitee: 'vm-test-invitee' };
const ENV_NAME: Record<TestPersona, string> = { owner: 'VM_TEST_OWNER_EMAIL', issuer: 'VM_TEST_ISSUER_EMAIL', viewer: 'VM_TEST_VIEWER_EMAIL', otherOwner: 'VM_TEST_OTHER_OWNER_EMAIL', admin: 'VM_TEST_ADMIN_EMAIL', invitee: 'VM_TEST_INVITEE_EMAIL' };

export interface HostedConfig { url: string; key: string; projectRef: string; password: string; emails: Record<TestPersona, string>; userIds: Record<TestPersona, string>; mainOrgId?: string; otherOrgId?: string }

/** Reads and validates configuration without network access; explicit hosted runners fail on these safe diagnostics. */
export function readHostedConfig(env: Record<string, string | undefined> = process.env): { config: HostedConfig | null; problems: string[] } {
  const problems: string[] = [];
  const url = (env.VM_TEST_SUPABASE_URL ?? '').trim(); const key = (env.VM_TEST_PUBLISHABLE_KEY ?? '').trim();
  const password = env.VM_TEST_PASSWORD ?? ''; const expectedRef = (env.VM_TEST_PROJECT_REF ?? '').trim();
  const projectRef = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(url)?.[1] ?? '';
  if (env.VM_HOSTED_TESTS !== CONSENT) problems.push(`VM_HOSTED_TESTS must be "${CONSENT}"`);
  if (!projectRef) problems.push('VM_TEST_SUPABASE_URL is missing or not a Supabase project URL');
  if (projectRef === 'otovaqtmodpqelwbrglj' || expectedRef === 'otovaqtmodpqelwbrglj') problems.push('The development project is protected; hosted testing requires a separate disposable project');
  if (!key.startsWith('sb_publishable_')) problems.push('VM_TEST_PUBLISHABLE_KEY must be a publishable key (never a secret or service-role key)');
  if (!/^[a-z0-9]{20}$/.test(expectedRef)) problems.push('VM_TEST_PROJECT_REF must be the approved disposable project reference'); else if (expectedRef !== projectRef) problems.push('VM_TEST_PROJECT_REF does not match VM_TEST_SUPABASE_URL');
  if (password.length < 16) problems.push('VM_TEST_PASSWORD must be at least 16 characters');
  const emails = {} as Record<TestPersona, string>;
  const userIds = {} as Record<TestPersona, string>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const persona of PERSONAS) {
    const email = (env[ENV_NAME[persona]] ?? '').trim().toLowerCase(); emails[persona] = email;
    if (!email.startsWith(`${LOCAL_PART[persona]}@`) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push(`${ENV_NAME[persona]} must be an address beginning ${LOCAL_PART[persona]}@`);
    const idName = ENV_NAME[persona].replace('_EMAIL', '_ID');
    userIds[persona] = (env[idName] ?? '').trim();
    if (!uuid.test(userIds[persona])) problems.push(`${idName} must be the approved fictional account UUID`);
  }
  if (new Set(Object.values(emails)).size !== PERSONAS.length) problems.push('the six test addresses must be different');
  if (new Set(Object.values(userIds)).size !== PERSONAS.length) problems.push('the six test account UUIDs must be different');
  const mainOrgId = env.VM_TEST_MAIN_ORG_ID?.trim() || undefined;
  const otherOrgId = env.VM_TEST_OTHER_ORG_ID?.trim() || undefined;
  if ((mainOrgId && !uuid.test(mainOrgId)) || (otherOrgId && !uuid.test(otherOrgId)) || (mainOrgId && mainOrgId === otherOrgId)) problems.push('Test organization UUIDs must be valid and distinct when set');
  return { config: problems.length ? null : { url, key, projectRef, password, emails, userIds, mainOrgId, otherOrgId }, problems };
}

export interface Account { persona: TestPersona; client: SupabaseClient; api: VeriMarkApi; session: Session; userId: string }
export interface Fixtures {
  config: HostedConfig; accounts: Record<TestPersona, Account>; anonymous: VeriMarkApi;
  main: string; otherOrg: string;
  /** A valid record in the main organization that tests may read but must never revoke or replace. */
  seed: { id: string; publicId: string };
}
export const newClient = (config: HostedConfig) => {
  if (config.projectRef === 'otovaqtmodpqelwbrglj' || config.url !== `https://${config.projectRef}.supabase.co` || !/^[a-z0-9]{20}$/.test(config.projectRef)) throw new Error('Refusing an invalid or protected hosted test target.');
  return createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
};

async function signIn(config: HostedConfig, persona: TestPersona): Promise<Account> {
  const client = newClient(config);
  const { data, error } = await client.auth.signInWithPassword({ email: config.emails[persona], password: config.password });
  if (error || !data.session) throw new Error(`Test account "${persona}" could not sign in (status ${error?.status ?? 'unknown'}). Check that it exists, is confirmed and uses VM_TEST_PASSWORD.`);
  if (data.session.user.email?.toLowerCase() !== config.emails[persona]) throw new Error(`Signed in as an unexpected account for "${persona}".`);
  if (data.session.user.id !== config.userIds[persona] || !data.session.user.email_confirmed_at) throw new Error(`Test account "${persona}" does not match its approved confirmed UUID.`);
  return { persona, client, api: createSupabaseApi(config.url, config.key, client), session: data.session, userId: data.session.user.id };
}

/**
 * Signs the six test accounts in and makes sure the two test organizations, memberships, review state, template and
 * seed record exist. Safe to repeat: everything is reused on later runs. Stops before writing anything if a test
 * account belongs to an organization that is not one of the two test organizations.
 */
export async function ensureFixtures(config: HostedConfig): Promise<Fixtures> {
  const list = await Promise.all(PERSONAS.map(persona => signIn(config, persona)));
  const accounts = Object.fromEntries(list.map(account => [account.persona, account])) as Record<TestPersona, Account>;
  const { owner, issuer, viewer, otherOwner, admin, invitee } = accounts;

  // Validate every existing membership before the first application write. Names alone are not identities.
  const expected = { owner: [config.mainOrgId, 'owner'], issuer: [config.mainOrgId, 'issuer'], viewer: [config.mainOrgId, 'viewer'], otherOwner: [config.otherOrgId, 'owner'], admin: [undefined, undefined], invitee: [config.mainOrgId, 'viewer'] } as const;
  for (const account of list) {
    const memberships = await account.api.listMemberships();
    const [id, role] = expected[account.persona];
    if (memberships.length > 1 || memberships.some(m => !id || m.organizationId !== id || m.role !== role)) throw new Error(`Test account "${account.persona}" has an unapproved membership. Refusing to write.`);
    if (id && (account.persona === 'owner' || account.persona === 'otherOwner') && memberships.length !== 1) throw new Error(`Test account "${account.persona}" is missing its approved owner membership.`);
  }
  if (!(await admin.api.isPlatformAdmin())) throw new Error('The admin test account is not a platform administrator yet (see supabase/hosted/README.md).');
  for (const account of [owner, issuer, viewer, otherOwner, invitee]) {
    if (await account.api.isPlatformAdmin()) throw new Error(`Test account "${account.persona}" must not be a platform administrator.`);
  }
  if ((await admin.api.listMemberships()).length > 0) throw new Error('The admin test account must not belong to any organization.');

  for (const [account, id, name] of [[owner, config.mainOrgId, MAIN_ORG], [otherOwner, config.otherOrgId, OTHER_ORG]] as const) {
    if (!id) continue;
    const organization = await account.api.getOrganization(id);
    if (organization.displayName !== name) throw new Error('Approved test organization has an unexpected name.');
    const members = await account.api.listMembers(id);
    const allowed = id === config.mainOrgId ? [owner.userId, issuer.userId, viewer.userId, invitee.userId] : [otherOwner.userId];
    if (members.some(member => !allowed.includes(member.userId))) throw new Error('Approved test organization contains an account outside the fictional fixture set.');
    const templates = (await account.api.listTemplates(id)).filter(t => !t.archived && t.name === TEMPLATE_NAME);
    if (templates.some(t => Object.entries(TEMPLATE).some(([key, value]) => t.config[key as keyof typeof TEMPLATE] !== value))) throw new Error('Existing fixture template has unexpected content.');
  }
  if (config.otherOrgId && (await otherOwner.api.getOrganization(config.otherOrgId)).reviewState !== 'pending') throw new Error('The other test organization must stay pending.');
  const main = config.mainOrgId ?? (await owner.api.createOrganization(MAIN_ORG)).id;
  if (!config.mainOrgId) console.info(`Created test fixture: VM_TEST_MAIN_ORG_ID=${main}. Pin this UUID before resuming.`);
  const otherOrg = config.otherOrgId ?? (await otherOwner.api.createOrganization(OTHER_ORG)).id;
  if (!config.otherOrgId) console.info(`Created test fixture: VM_TEST_OTHER_ORG_ID=${otherOrg}. Pin this UUID before resuming.`);

  for (const [account, role] of [[issuer, 'issuer'], [viewer, 'viewer']] as const) {
    const current = (await account.api.listMemberships()).find(m => m.organizationId === main);
    if (current) { if (current.role !== role) throw new Error(`Test account "${account.persona}" has role ${current.role} in the main test organization; expected ${role}.`); continue; }
    const invite = await owner.api.inviteMember(main, { email: config.emails[account.persona], role });
    await account.api.acceptInvite(invite.token);
  }

  let organization = await owner.api.getOrganization(main);
  if (organization.reviewState !== 'reviewed') {
    await admin.api.recordIssuerReview({ organizationId: main, outcome: 'reviewed', reason: 'Automated test fixture (fictional organization)', expectedRevision: organization.revision });
    organization = await owner.api.getOrganization(main);
  }
  if (organization.reviewState !== 'reviewed') throw new Error('The main test organization could not be marked reviewed.');
  if ((await otherOwner.api.getOrganization(otherOrg)).reviewState !== 'pending') throw new Error('The other test organization must stay unreviewed; it is not pending.');

  for (const [account, org] of [[owner, main], [otherOwner, otherOrg]] as const) {
    const matches = (await account.api.listTemplates(org)).filter(t => !t.archived && t.name === TEMPLATE_NAME);
    if (!matches.length) await account.api.saveTemplate(org, { name: TEMPLATE_NAME, config: { ...TEMPLATE } });
  }

  const existing = (await issuer.api.listCredentials(main, { search: SEED_RECIPIENT, status: 'valid', limit: 100 })).items.find(c => c.recipientDisplayName === SEED_RECIPIENT && c.title === 'Automated Test Seed Record' && c.achievement === 'Fictional record used by automated tests.' && c.versionNumber === 1);
  let seed = existing ? { id: existing.id, publicId: existing.publicId } : null;
  if (!seed) {
    const template = (await issuer.api.listTemplates(main)).find(t => !t.archived && t.name === TEMPLATE_NAME)!;
    const draft = await issuer.api.createBatch(main, { templateId: template.id, source: 'single', rows: [{ recipientDisplayName: SEED_RECIPIENT, title: 'Automated Test Seed Record', achievement: 'Fictional record used by automated tests.', recipientEmail: 'seed.recipient@example.test' }] });
    const preview = await issuer.api.previewBatch(main, draft.batchId);
    const approval = await issuer.api.approveBatch(main, draft.batchId, { expectedRevision: preview.revision, previewDigest: preview.previewDigest });
    const issued = await issuer.api.issueBatch(main, draft.batchId, { approvalId: approval.approvalId, idempotencyKey: crypto.randomUUID() });
    seed = { id: issued.credentials[0].id, publicId: issued.credentials[0].publicId };
  }
  return { config, accounts, anonymous: createSupabaseApi(config.url, config.key, newClient(config)), main, otherOrg, seed };
}

export async function signOutAll(fixtures: Fixtures): Promise<void> {
  await Promise.all(Object.values(fixtures.accounts).map(account => account.client.auth.signOut({ scope: 'local' }).catch(() => undefined)));
}
