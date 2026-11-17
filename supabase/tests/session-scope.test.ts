import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createSupabaseApi } from '../../src/lib/api/supabaseAdapter';
import type { VeriMarkApi } from '../../src/lib/api/types';
import { checkSignOutScope } from '../hosted/session-scope';

// Validates the hosted sign-out check locally (no network): a fake Supabase Auth server with GoTrue's session semantics
// (logout scopes, session-bound access tokens, refresh rotation). The check must pass for the app's adapter and must
// detect a global sign-out.
const USER = { id: '00000000-0000-4000-8000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'vm-test-viewer@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const PASSWORD = 'fictional-password-0123456789';

function fakeAuth() {
  const sessions = new Map<string, { refresh: string }>();
  let n = 0;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = (sid: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, session_id: sid, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' })}.sig`;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const issue = (sid: string) => {
    const refresh = `refresh-${++n}`; sessions.set(sid, { refresh });
    return json(200, { access_token: token(sid), refresh_token: refresh, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER });
  };
  const bearerSession = (req: Request) => {
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
    try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).session_id as string; } catch { return null; }
  };
  const handler: typeof fetch = async (resource, init) => {
    const req = new Request(resource, init);
    const url = new URL(req.url);
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const body = await req.json() as { password: string };
      return body.password === PASSWORD ? issue(`session-${++n}`) : json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const { refresh_token } = await req.json() as { refresh_token: string };
      const found = [...sessions].find(([, s]) => s.refresh === refresh_token);
      return found ? issue(found[0]) : json(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
    }
    if (url.pathname === '/auth/v1/user') {
      const sid = bearerSession(req);
      return sid && sessions.has(sid) ? json(200, USER) : json(403, { error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' });
    }
    if (url.pathname === '/auth/v1/logout') {
      const sid = bearerSession(req);
      if (!sid || !sessions.has(sid)) return json(403, { error_code: 'session_not_found', msg: 'Session not found' });
      const scope = url.searchParams.get('scope') ?? 'global';
      for (const other of [...sessions.keys()]) if (scope === 'global' || (scope === 'local' ? other === sid : other !== sid)) sessions.delete(other);
      return new Response(null, { status: 204 });
    }
    return json(404, { msg: 'unexpected request' });
  };
  return { handler, sessions };
}

const input = (handler: typeof fetch) => ({ url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_test', email: USER.email, password: PASSWORD, userId: USER.id, fetch: handler });
const globalSignOut = (client: SupabaseClient): VeriMarkApi => ({ ...createSupabaseApi('https://abcdefghijklmnopqrst.supabase.co', 'sb_publishable_test', client), signOut: async () => { await client.auth.signOut(); } });

describe('hosted sign-out scope check (fake Auth server)', () => {
  it('passes for the app adapter: A ends, B stays signed in and refreshes, nothing is left behind', async () => {
    const auth = fakeAuth();
    const result = await checkSignOutScope(input(auth.handler));
    expect(result).toEqual({
      distinctSessions: true, logoutScopes: ['local'], aClearedLocally: true, aAccessAfter: 'AuthSessionMissingError', aRefreshAfter: 'refresh_token_not_found',
      bUserAfter: 'ok', bRefreshed: true, bSameSessionAfterRefresh: true, bUserAfterRefresh: 'ok', bCleanedUp: true,
    });
    expect(auth.sessions.size).toBe(0);
  });

  it('detects a global sign-out: session B is ended too', async () => {
    const auth = fakeAuth();
    const result = await checkSignOutScope({ ...input(auth.handler), adapter: globalSignOut });
    expect(result.logoutScopes).toEqual(['global']);
    expect(result.bUserAfter).toBe('AuthSessionMissingError');
    expect(result.bRefreshed).toBe(false);
    expect(auth.sessions.size).toBe(0);
  });

  it('refuses the protected development project before any request', async () => {
    let calls = 0;
    await expect(checkSignOutScope({ ...input(async () => { calls++; return new Response(null); }), url: 'https://otovaqtmodpqelwbrglj.supabase.co' })).rejects.toThrow(/protected/);
    expect(calls).toBe(0);
  });
});
