import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseApi } from '../../src/lib/api/supabaseAdapter';
import type { VeriMarkApi } from '../../src/lib/api/types';

// Checks what the application's Sign out does to a user's other sessions, through real Auth sessions.
// Writes no application records: it only signs one existing fictional account in twice, signs one session out through the
// app's adapter, refreshes the other and finally signs that one out locally. Never prints tokens or the password.

export interface SessionScopeInput {
  url: string; key: string; email: string; password: string; userId: string;
  /** Network for every Auth call. Real fetch on the hosted project; a fake Auth server in local tests. */
  fetch?: typeof fetch;
  /** Builds the app API for session A. Defaults to the production adapter. */
  adapter?: (client: SupabaseClient) => VeriMarkApi;
}

export interface SessionScopeResult {
  /** A and B are different server-side sessions of the same account. */
  distinctSessions: boolean;
  /** `scope` of every /logout request made by the app's Sign out on session A. */
  logoutScopes: (string | null)[];
  aClearedLocally: boolean;
  /** `ok`, or the error Auth gives for session A's old access token after Sign out. auth-js reports GoTrue's
   * `session_not_found` as `AuthSessionMissingError`. */
  aAccessAfter: string;
  /** `ok`, or the error code Auth gives for session A's old refresh token after Sign out. */
  aRefreshAfter: string;
  bUserAfter: string;
  bRefreshed: boolean;
  bSameSessionAfterRefresh: boolean;
  bUserAfterRefresh: string | null;
  /** Session B was signed out locally at the end, leaving no session behind. */
  bCleanedUp: boolean;
}

const PROTECTED_REF = 'otovaqtmodpqelwbrglj';

/** Reads the `session_id` claim without verifying the signature (identity only, never trust). */
export function sessionIdOf(accessToken: string): string | null {
  try {
    const payload: unknown = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' && 'session_id' in payload && typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch { return null; }
}

export async function checkSignOutScope(input: SessionScopeInput): Promise<SessionScopeResult> {
  const ref = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(input.url)?.[1];
  if (!ref || ref === PROTECTED_REF) throw new Error('Refusing an invalid or protected hosted test target.');
  const baseFetch = input.fetch ?? fetch;
  const logoutScopes: (string | null)[] = [];
  let recordLogouts = false;
  const recordingFetch: typeof fetch = async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : String(resource));
    if (recordLogouts && url.pathname.endsWith('/auth/v1/logout')) logoutScopes.push(url.searchParams.get('scope'));
    return baseFetch(resource, init);
  };
  const client = (name: string) => {
    const store = new Map<string, string>();
    return createClient(input.url, input.key, {
      auth: {
        storageKey: `vm-scope-${name}`, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
        storage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); }, removeItem: k => { store.delete(k); } },
      },
      global: { fetch: recordingFetch },
    });
  };
  const signIn = async (c: SupabaseClient) => {
    const { data, error } = await c.auth.signInWithPassword({ email: input.email, password: input.password });
    if (error || !data.session) throw new Error(`Test account could not sign in (status ${error?.status ?? 'unknown'}).`);
    if (data.session.user.id !== input.userId) throw new Error('Signed in as an unexpected account.');
    return data.session;
  };
  const outcome = (error: { code?: string; name: string } | null) => (error ? error.code ?? error.name : 'ok');

  const a = client('a'); const b = client('b'); const probe = client('probe');
  try {
    const sessionA = await signIn(a);
    const sessionB = await signIn(b);
    const idA = sessionIdOf(sessionA.access_token); const idB = sessionIdOf(sessionB.access_token);

    recordLogouts = true;
    await (input.adapter ?? (c => createSupabaseApi(input.url, input.key, c)))(a).signOut();
    recordLogouts = false;
    const aClearedLocally = (await a.auth.getSession()).data.session === null;

    const aAccess = await probe.auth.getUser(sessionA.access_token);
    const aRefresh = await probe.auth.refreshSession({ refresh_token: sessionA.refresh_token });
    await probe.auth.signOut({ scope: 'local' }).catch(() => undefined);

    const bUser = await b.auth.getUser();
    const refreshed = await b.auth.refreshSession();
    const bRefreshed = !refreshed.error && !!refreshed.data.session;
    const bSameSessionAfterRefresh = bRefreshed && sessionIdOf(refreshed.data.session!.access_token) === idB;
    const bUserAfter = bRefreshed ? await b.auth.getUser() : null;

    const bOut = await b.auth.signOut({ scope: 'local' });
    const bCleanedUp = !bOut.error;
    return {
      distinctSessions: !!idA && !!idB && idA !== idB,
      logoutScopes,
      aClearedLocally,
      aAccessAfter: outcome(aAccess.error),
      aRefreshAfter: outcome(aRefresh.error),
      bUserAfter: outcome(bUser.error),
      bRefreshed,
      bSameSessionAfterRefresh,
      bUserAfterRefresh: bUserAfter ? outcome(bUserAfter.error) : null,
      bCleanedUp,
    };
  } finally {
    // Never leave a session behind, whatever failed above.
    for (const c of [a, b]) await c.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}
