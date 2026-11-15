import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../../components/ui';
import { AuthPageLayout } from './AuthPageLayout';
import { useAuth } from './AuthContext';
import { DemoAccountsPanel } from './DemoAccountsPanel';
import { SignInForm } from './SignInForm';
import { safeReturnPath } from './session';

export default function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const from = safeReturnPath((location.state as { from?: unknown } | null)?.from);
  const [prefill, setPrefill] = useState<{ email: string; password: string; key: number }>();
  if (auth.status === 'signedIn') return <Navigate to={from} replace />;
  return (
    <AuthPageLayout label="ISSUER WORKSPACE" title={<>Sign in to <em>VeriMark.</em></>}
      intro={<p>For members of issuing organizations. Recipients and verifiers never need an account.</p>}
      aside={<DemoAccountsPanel onUse={(email, password) => setPrefill(previous => ({ email, password, key: (previous?.key ?? 0) + 1 }))} />}>
      {auth.status === 'loading' ? <LoadingState label="Checking your session…" /> : (
        <>
          <SignInForm prefill={prefill} onSignedIn={() => auth.refresh()} />
          <p className="auth-links">
            <Link to="/reset-password">Forgot your password?</Link>
            <Link to="/sign-up" state={{ from }}>Create an account</Link>
          </p>
        </>
      )}
    </AuthPageLayout>
  );
}
