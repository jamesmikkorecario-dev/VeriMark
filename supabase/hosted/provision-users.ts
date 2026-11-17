// One-time, server-only creation of the six confirmed fictional test accounts for the disposable test project.
// Reads the secret key ONLY from .env.hosted-admin.local (git-ignored, never loaded by Vite, Vitest or Playwright) and
// writes the generated password, addresses and UUIDs to .env.hosted-test.local. Never prints the key or the password.
// Usage: node supabase/hosted/provision-users.ts            (create; refuses unless the project has zero Auth users)
//        node supabase/hosted/provision-users.ts --check    (read-only: verify the six accounts against the saved config)
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

export const PROTECTED_REF = 'otovaqtmodpqelwbrglj';
export const PERSONAS = [
  ['OWNER', 'vm-test-owner'], ['ISSUER', 'vm-test-issuer'], ['VIEWER', 'vm-test-viewer'],
  ['OTHER_OWNER', 'vm-test-other'], ['ADMIN', 'vm-test-admin'], ['INVITEE', 'vm-test-invitee'],
] as const;
const ADMIN_FILE = '.env.hosted-admin.local';
const TEST_FILE = '.env.hosted-test.local';
const EMAIL_DOMAIN = 'example.test'; // reserved test domain; createUser sends no e-mail

const readEnvFile = (path: string) => (existsSync(path) ? parseEnv(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) : {});

/** Pure target/credential validation; returns problems without network access. */
export function provisioningProblems(test: Record<string, string | undefined>, secret: string | undefined): string[] {
  const problems: string[] = [];
  const ref = (test.VM_TEST_PROJECT_REF ?? '').trim();
  const url = (test.VM_TEST_SUPABASE_URL ?? '').trim();
  if (!/^[a-z0-9]{20}$/.test(ref)) problems.push('VM_TEST_PROJECT_REF is not a project reference');
  if (ref === PROTECTED_REF || url.includes(PROTECTED_REF)) problems.push('protected development project refused');
  if (url !== `https://${ref}.supabase.co`) problems.push('VM_TEST_SUPABASE_URL does not match VM_TEST_PROJECT_REF');
  if (!secret || !secret.trim().startsWith('sb_secret_')) problems.push(`${ADMIN_FILE} must define VM_PROVISION_SECRET_KEY as an sb_secret_ key`);
  return problems;
}

async function main() {
  const check = process.argv.includes('--check');
  const test = readEnvFile(TEST_FILE);
  const secret = readEnvFile(ADMIN_FILE).VM_PROVISION_SECRET_KEY?.trim();
  const problems = provisioningProblems(test, secret);
  if (problems.length) throw new Error(`Provisioning refused: ${problems.join('; ')}`);
  const admin = createClient(test.VM_TEST_SUPABASE_URL!, secret!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (listed.error) throw new Error(`Could not list users (status ${listed.error.status ?? 'unknown'}). Check the key belongs to this project.`);
  const users = listed.data.users;

  if (check) {
    for (const [name] of PERSONAS) {
      const user = users.find(u => u.id === test[`VM_TEST_${name}_ID`]);
      if (!user || user.email?.toLowerCase() !== test[`VM_TEST_${name}_EMAIL`] || !user.email_confirmed_at) throw new Error(`Account ${name} does not match the saved configuration.`);
    }
    console.log(`Verified ${PERSONAS.length} confirmed fictional accounts; project has ${users.length} Auth users.`);
    return;
  }
  if (users.length !== 0) throw new Error(`Refusing to create accounts: the project already has ${users.length} Auth users. Run --check, do not re-provision.`);
  if (test.VM_TEST_PASSWORD) throw new Error(`${TEST_FILE} already holds a test password; refusing to overwrite.`);

  const password = randomBytes(24).toString('base64url');
  const lines: string[] = [];
  for (const [name, local] of PERSONAS) {
    const email = `${local}@${EMAIL_DOMAIN}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`Creating ${name} failed (status ${created.error?.status ?? 'unknown'}). ${lines.length / 2} accounts were created before the failure; do not re-run, inspect first.`);
    if (!created.data.user.email_confirmed_at) throw new Error(`${name} was created unconfirmed; stopping.`);
    lines.push(`VM_TEST_${name}_EMAIL=${email}`, `VM_TEST_${name}_ID=${created.data.user.id}`);
    console.log(`Created ${name}: ${created.data.user.id}`);
  }
  const kept = readFileSync(TEST_FILE, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  writeFileSync(TEST_FILE, `${kept}\nVM_TEST_PASSWORD=${password}\n${lines.join('\n')}\n`);
  console.log(`Saved six accounts to ${TEST_FILE}. The password was not printed.`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('supabase/hosted/provision-users.ts')) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Provisioning failed.'); process.exit(1); });
}
