import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApi } from '../../lib/api/context';
import type { SessionUser } from '../../lib/api/types';
import { clearActiveOrganization } from './session';

export type AuthStatus = 'loading' | 'error' | 'signedOut' | 'signedIn';
export interface Auth {
  status: AuthStatus;
  user: SessionUser | null;
  /** Re-reads the session, for example after a sign-in or a failed initial check. */
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [state, setState] = useState<{ status: AuthStatus; user: SessionUser | null }>({ status: 'loading', user: null });

  const apply = useCallback((user: SessionUser | null) => {
    if (!user) clearActiveOrganization();
    setState({ status: user ? 'signedIn' : 'signedOut', user });
  }, []);

  const refresh = useCallback(async () => {
    try { apply(await api.getSession()); } catch { setState({ status: 'error', user: null }); }
  }, [api, apply]);

  useEffect(() => {
    let active = true;
    const stop = api.onAuthChange(user => { if (active) apply(user); });
    api.getSession().then(user => { if (active) apply(user); }, () => { if (active) setState({ status: 'error', user: null }); });
    return () => { active = false; stop(); };
  }, [api, apply]);

  const signOut = useCallback(async () => {
    await api.signOut();
    apply(null);
  }, [api, apply]);

  const value = useMemo<Auth>(() => ({ ...state, refresh, signOut }), [state, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth requires an AuthProvider');
  return auth;
}
