import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApi } from '../../lib/api/context';
import type { Membership } from '../../lib/api/types';
import { Button, ButtonLink, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { AuthPageLayout } from './AuthPageLayout';
import { useAuth } from './AuthContext';
import { DemoAccountsPanel } from './DemoAccountsPanel';
import { errorCode, friendlyError } from './errors';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { writeActiveOrganization } from './session';

const roleCopy = { owner: 'an owner', issuer: 'an issuer', viewer: 'a viewer' } as const;

const readToken = () => window.location.hash.replace(/^#/, '');
/** Removes the secret from the address bar and the current history entry. */
function scrubFragment() {
  if (window.location.hash) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
}

export default function InvitePage() {
  const api = useApi();
  const auth = useAuth();
  // Kept in component memory only: never written to storage or logs.
  const [token] = useState(readToken);
  useLayoutEffect(scrubFragment, []);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [status, setStatus] = useState<'idle' | 'pending' | 'accepted' | 'unavailable' | 'error'>('idle');
  const [membership, setMembership] = useState<Membership>();
  const [message, setMessage] = useState<string>();
  const [prefill, setPrefill] = useState<{ email: string; password: string; key: number }>();
  const [confirmationSent, setConfirmationSent] = useState(false);
  const inFlight = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (status === 'accepted' || status === 'unavailable') resultRef.current?.focus(); }, [status]);

  async function accept() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('pending');
    try {
      const joined = await api.acceptInvite(token);
      if (auth.user) writeActiveOrganization(auth.user.id, joined.organizationId);
      setMembership(joined);
      setStatus('accepted');
    } catch (error) {
      const code = errorCode(error);
      if (code === 'NOT_FOUND') setStatus('unavailable');
      else if (code === 'UNAUTHENTICATED') { setStatus('idle'); await auth.refresh(); }
      else { setMessage(friendlyError(error)); setStatus('error'); }
    } finally {
      inFlight.current = false;
    }
  }

  let body;
  if (!token) {
    body = <EmptyState title="This invitation link is incomplete" action={<ButtonLink to="/">Return home</ButtonLink>}>Open the full link that the organization owner shared with you. If it still does not work, ask them for a new invitation.</EmptyState>;
  } else if (status === 'accepted' && membership) {
    body = (
      <div className="auth-confirmation" role="status" tabIndex={-1} ref={resultRef}>
        <h2>You have joined {membership.organizationName}</h2>
        <p>You are now {roleCopy[membership.role]} in this organization.</p>
        <ButtonLink to="/app">Open the workspace</ButtonLink>
      </div>
    );
  } else if (auth.status === 'loading') {
    body = <LoadingState label="Checking your session…" />;
  } else if (auth.status === 'error') {
    body = <ErrorState title="We could not check your session" onRetry={() => { void auth.refresh(); }}>Check your connection and try again.</ErrorState>;
  } else if (auth.status === 'signedOut') {
    body = confirmationSent ? (
      <div role="status"><EmptyState title="Confirm your email address">Open the confirmation link we sent, then open this invitation link again to join.</EmptyState></div>
    ) : (
      <>
        <p className="auth-step">Sign in or create an account with the email address the invitation was sent to.</p>
        <div className="auth-switch" role="group" aria-label="Account">
          <Button size="sm" variant={mode === 'sign-in' ? 'primary' : 'outline'} aria-pressed={mode === 'sign-in'} onClick={() => setMode('sign-in')}>I have an account</Button>
          <Button size="sm" variant={mode === 'sign-up' ? 'primary' : 'outline'} aria-pressed={mode === 'sign-up'} onClick={() => setMode('sign-up')}>Create an account</Button>
        </div>
        {mode === 'sign-in'
          ? <SignInForm idPrefix="invite-sign-in" submitLabel="Sign in to continue" prefill={prefill} onSignedIn={() => auth.refresh()} />
          : <SignUpForm idPrefix="invite-sign-up" onSignedUp={async result => { if (result.needsEmailConfirmation) setConfirmationSent(true); else await auth.refresh(); }} />}
      </>
    );
  } else if (status === 'unavailable') {
    body = (
      <div className="ui-state ui-state-error" tabIndex={-1} ref={resultRef}>
        <div role="alert">
          <h2>This invitation is unavailable</h2>
          <p className="state-description">It may have expired, been used or been withdrawn, or it was sent to a different email address than <strong>{auth.user?.email}</strong>. Ask the organization owner for a new invitation.</p>
        </div>
        <Button variant="outline" onClick={() => { setStatus('idle'); void auth.signOut(); }}>Use a different account</Button>
      </div>
    );
  } else {
    body = (
      <div className="auth-accept">
        {status === 'error' && <ErrorState title="The invitation could not be accepted">{message}</ErrorState>}
        <p>You are signed in as <strong>{auth.user?.email}</strong>. Accepting adds you to the organization that invited this address.</p>
        <div className="hero-actions">
          <Button onClick={() => { void accept(); }} disabled={status === 'pending'}>{status === 'pending' ? 'Accepting…' : 'Accept invitation'}</Button>
          <Button variant="outline" onClick={() => { void auth.signOut(); }} disabled={status === 'pending'}>Use a different account</Button>
        </div>
      </div>
    );
  }

  return (
    <AuthPageLayout label="INVITATION" title={<>Join an <em>organization.</em></>}
      intro={<p>An organization owner invited you to their VeriMark workspace. The invitation works once, for the invited email address, for seven days.</p>}
      aside={token && auth.status === 'signedOut' ? <DemoAccountsPanel onUse={(email, password) => { setMode('sign-in'); setPrefill(p => ({ email, password, key: (p?.key ?? 0) + 1 })); }} /> : undefined}>
      {body}
    </AuthPageLayout>
  );
}
