import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { EmptyState, LoadingState } from '../../components/ui';
import { AuthPageLayout } from './AuthPageLayout';
import { useAuth } from './AuthContext';
import { DemoAccountsPanel } from './DemoAccountsPanel';
import { SignUpForm } from './SignUpForm';
import { safeReturnPath } from './session';

export default function SignUpPage() {
  const auth = useAuth();
  const location = useLocation();
  const from = safeReturnPath((location.state as { from?: unknown } | null)?.from);
  const [confirmationSent, setConfirmationSent] = useState(false);
  if (auth.status === 'signedIn') return <Navigate to={from} replace />;
  return (
    <AuthPageLayout label="ISSUER WORKSPACE" title={<>Create an <em>account.</em></>}
      intro={<p>Create an account to set up an issuing organization or to accept an invitation from one.</p>}
      aside={<DemoAccountsPanel />}>
      {auth.status === 'loading' ? <LoadingState label="Checking your session…" /> : confirmationSent ? (
        <div role="status"><EmptyState title="Confirm your email address">We have sent a confirmation link. Open it to finish creating your account, then sign in.</EmptyState></div>
      ) : (
        <>
          <SignUpForm onSignedUp={async result => { if (result.needsEmailConfirmation) setConfirmationSent(true); else await auth.refresh(); }} />
          <p className="auth-links"><Link to="/sign-in" state={{ from }}>Already have an account? Sign in</Link></p>
        </>
      )}
    </AuthPageLayout>
  );
}
