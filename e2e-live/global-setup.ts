import type { FullConfig } from '@playwright/test';
import { DEMO_PUBLIC_IDS } from '../src/lib/api/demo/state';
import { ensureFixtures, MAIN_ORG, OTHER_ORG, PERSONAS, readHostedConfig, signOutAll } from '../supabase/hosted/fixtures';
import { readHostedEnvironment } from '../supabase/hosted/environment';
import type { LiveState } from './live';

// Hosted: provision or reuse the fixtures through the API, then hand each persona's session to the browser as a
// storage state, so fixture setup signs in six times instead of once per test (Supabase limits sign-ins per IP).
export default async function globalSetup(playwright: FullConfig) {
  const origin = playwright.projects[0].use.baseURL!;
  if (process.env.LIVE_TARGET !== 'hosted') {
    const state: LiveState = {
      target: 'demo', password: 'demo-password-1', mainOrg: 'Fieldwork Collective', otherOrg: 'Northgate Guild', storage: null,
      emails: { owner: 'owner@demo.verimark.test', issuer: 'issuer@demo.verimark.test', viewer: 'viewer@demo.verimark.test', otherOwner: 'north@demo.verimark.test', admin: 'admin@demo.verimark.test', invitee: 'admin@demo.verimark.test' },
      inviteeName: 'Ari Platform',
      seed: { id: 'cred_demo_valid', publicId: DEMO_PUBLIC_IDS.valid },
    };
    process.env.LIVE_STATE = JSON.stringify(state);
    return;
  }
  const { config, problems } = readHostedConfig(readHostedEnvironment());
  if (!config) throw new Error(`Hosted run is not configured:\n - ${problems.join('\n - ')}\nSee e2e-live/README.md.`);
  const fixtures = await ensureFixtures(config);
  const storage = Object.fromEntries(PERSONAS.map(persona => [persona, {
    cookies: [],
    origins: [{ origin, localStorage: [{ name: `sb-${config.projectRef}-auth-token`, value: JSON.stringify(fixtures.accounts[persona].session) }] }],
  }])) as NonNullable<LiveState['storage']>;
  const state: LiveState = { target: 'hosted', password: config.password, mainOrg: MAIN_ORG, otherOrg: OTHER_ORG, storage, emails: config.emails, seed: fixtures.seed, inviteeName: config.emails.invitee.split('@')[0] };
  // Passed to the test workers through the environment only: sessions are never written to disk.
  process.env.LIVE_STATE = JSON.stringify(state);
  return async () => { await signOutAll(fixtures); };
}
