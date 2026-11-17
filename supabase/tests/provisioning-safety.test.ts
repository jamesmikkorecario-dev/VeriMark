import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readHostedEnvironment } from '../hosted/environment';
import { provisioningProblems } from '../hosted/provision-users';

const target = { VM_TEST_PROJECT_REF: 'abcdefghijklmnopqrst', VM_TEST_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' };

describe('test-account provisioning guards (no network)', () => {
  it('accepts only a matching disposable target with an sb_secret_ key', () => {
    expect(provisioningProblems(target, 'sb_secret_fictional')).toEqual([]);
    expect(provisioningProblems(target, 'sb_publishable_fictional')).not.toEqual([]);
    expect(provisioningProblems(target, undefined)).not.toEqual([]);
    expect(provisioningProblems({ ...target, VM_TEST_SUPABASE_URL: 'https://zyxwvutsrqponmlkjihg.supabase.co' }, 'sb_secret_fictional')).not.toEqual([]);
  });
  it('refuses the protected development project in either position', () => {
    expect(provisioningProblems({ VM_TEST_PROJECT_REF: 'otovaqtmodpqelwbrglj', VM_TEST_SUPABASE_URL: 'https://otovaqtmodpqelwbrglj.supabase.co' }, 'sb_secret_fictional').join(' ')).toContain('protected');
    expect(provisioningProblems({ ...target, VM_TEST_SUPABASE_URL: 'https://otovaqtmodpqelwbrglj.supabase.co' }, 'sb_secret_fictional').join(' ')).toContain('protected');
  });
  it('the test runner never loads the provisioning secret, from its file or the environment', () => {
    const directory = mkdtempSync(join(tmpdir(), 'verimark-provision-'));
    try {
      writeFileSync(join(directory, '.env.hosted-admin.local'), 'VM_PROVISION_SECRET_KEY=sb_secret_fictional\n');
      writeFileSync(join(directory, '.env.hosted-test.local'), 'VM_TEST_PROJECT_REF=abcdefghijklmnopqrst\n');
      const loaded = readHostedEnvironment(directory, { VM_PROVISION_SECRET_KEY: 'sb_secret_fictional' });
      expect(Object.values(loaded).some(value => value?.startsWith('sb_secret_'))).toBe(false);
      expect(loaded.VM_TEST_PROJECT_REF).toBe('abcdefghijklmnopqrst');
    } finally { rmSync(directory, { recursive: true }); }
  });
});
