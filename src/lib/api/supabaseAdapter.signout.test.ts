import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createSupabaseApi } from './supabaseAdapter';

// Sign-out runs through the real Supabase client; only the network is replaced, so the test sees the exact Auth
// request the browser would send.
const URL_BASE = 'https://example-ref.supabase.co';
const STORAGE_KEY = 'sb-test-auth-token';

function signedInApi(logoutStatus: number) {
  const store = new Map<string, string>();
  const session = {
    access_token: 'access-token-for-test', refresh_token: 'refresh-token-for-test', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'viewer@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
  store.set(STORAGE_KEY, JSON.stringify(session));
  const requests: URL[] = [];
  const fetchStub: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    if (url.pathname === '/auth/v1/logout') {
      return logoutStatus === 204 ? new Response(null, { status: 204 }) : new Response(JSON.stringify({ code: logoutStatus, error_code: 'session_not_found', msg: 'Session not found' }), { status: logoutStatus, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'unexpected request' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  };
  const client = createClient(URL_BASE, 'sb_publishable_test', {
    auth: {
      storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); }, removeItem: key => { store.delete(key); } },
    },
    global: { fetch: fetchStub },
  });
  return { api: createSupabaseApi(URL_BASE, 'sb_publishable_test', client), requests, store };
}

describe('Supabase adapter sign-out', () => {
  it('ends only the current session: logout is sent with local scope and this browser forgets the session', async () => {
    const { api, requests, store } = signedInApi(204);
    await api.signOut();
    const logouts = requests.filter(url => url.pathname === '/auth/v1/logout');
    expect(logouts).toHaveLength(1);
    expect(logouts[0].searchParams.get('scope')).toBe('local');
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it('still signs this browser out when the session was already ended elsewhere', async () => {
    const { api, store } = signedInApi(403);
    await expect(api.signOut()).resolves.toBeUndefined();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});
