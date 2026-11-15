import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/ui';
import { useAuth } from './AuthContext';
import { safeReturnPath } from './session';
import './auth.css';

/** Private /app routes: wait for the session, then either render or send the visitor to sign in, remembering where they were going. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') {
    return <main id="main" tabIndex={-1} className="auth-gate"><h1 className="sr-only">Checking your session</h1><LoadingState label="Checking your session…" /></main>;
  }
  if (auth.status === 'error') {
    return <main id="main" tabIndex={-1} className="auth-gate"><h1 className="sr-only">Session unavailable</h1><ErrorState title="We could not check your session" onRetry={() => { void auth.refresh(); }}>Check your connection and try again.</ErrorState></main>;
  }
  if (auth.status === 'signedOut') {
    const from = safeReturnPath(`${location.pathname}${location.search}`, '/app');
    return <Navigate to="/sign-in" replace state={{ from }} />;
  }
  return <>{children}</>;
}
