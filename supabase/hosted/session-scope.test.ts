import { describe, expect, it } from 'vitest';
import { readHostedConfig } from './fixtures';
import { checkSignOutScope } from './session-scope';

// Hosted: the app's Sign out ends only the current session. Uses the existing fictional viewer account; creates and ends
// two Auth sessions and writes no application records. Run on its own:
//   npx vitest run --config vitest.hosted.config.ts supabase/hosted/session-scope.test.ts
const { config, problems } = readHostedConfig();
if (!config) throw new Error(`Hosted execution refused: ${problems.join('; ')}`);

describe('hosted sign-out scope', () => {
  it('ends session A only; session B stays signed in and can refresh', async () => {
    const result = await checkSignOutScope({ url: config!.url, key: config!.key, email: config!.emails.viewer, password: config!.password, userId: config!.userIds.viewer });
    // Non-secret observations only (no tokens, ids or addresses).
    console.log(`session-scope result: ${JSON.stringify(result)}`);
    expect(result.distinctSessions).toBe(true);
    expect(result.logoutScopes).toEqual(['local']);
    expect(result.aClearedLocally).toBe(true);
    expect(result.aAccessAfter).not.toBe('ok');
    expect(result.aRefreshAfter).not.toBe('ok');
    expect(result.bUserAfter).toBe('ok');
    expect(result.bRefreshed).toBe(true);
    expect(result.bSameSessionAfterRefresh).toBe(true);
    expect(result.bUserAfterRefresh).toBe('ok');
    expect(result.bCleanedUp).toBe(true);
  });
});
