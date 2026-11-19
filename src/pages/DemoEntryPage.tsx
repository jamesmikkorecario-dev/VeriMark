import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ui';
import { useApi } from '../lib/api/context';
import { DEMO_ACCOUNTS } from '../lib/api/demo/state';
import '../features/auth/auth.css';

/** `/demo?as=<persona>`: which seeded account the one-click entry signs in as, and where it lands. */
const PERSONAS = {
  owner: { email: 'owner@demo.verimark.test', landing: '/app' },
  issuer: { email: 'issuer@demo.verimark.test', landing: '/app' },
  viewer: { email: 'viewer@demo.verimark.test', landing: '/app' },
  // The reviewer belongs to no organization, so the overview would only redirect to onboarding.
  admin: { email: 'admin@demo.verimark.test', landing: '/app/review' },
  north: { email: 'north@demo.verimark.test', landing: '/app' },
} as const;
type Persona = keyof typeof PERSONAS;
const isPersona = (value: string | null): value is Persona => value !== null && Object.hasOwn(PERSONAS, value);

/**
 * One-click entry to the fictional interactive demo: signs in as a seeded account and opens the workspace.
 * Meaningful only on the local demo adapter; with a real backend there are no demo accounts, so it sends visitors to sign in.
 */
export default function DemoEntryPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get('as');
  const persona = isPersona(requested) ? requested : 'owner';
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const demo = api.mode === 'demo';

  useEffect(() => {
    if (!demo) return;
    let active = true;
    const account = DEMO_ACCOUNTS.find(item => item.email === PERSONAS[persona].email)!;
    api.signIn(account.email, account.password).then(
      () => { if (active) navigate(PERSONAS[persona].landing, { replace: true }); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [api, demo, persona, navigate, attempt]);

  const retry = useCallback(() => { setFailed(false); setAttempt(count => count + 1); }, []);

  if (!demo) return <Navigate to="/sign-in" replace />;
  return (
    <main id="main" tabIndex={-1} className="auth-gate">
      <h1 className="sr-only">Opening the live demo</h1>
      {failed
        ? <ErrorState title="We could not open the demo" onRetry={retry}>The demonstration runs in this browser tab. Try again, or <Link to="/sign-in">sign in with a demo account</Link>.</ErrorState>
        : <LoadingState label="Opening the fictional demo workspace…" />}
    </main>
  );
}
