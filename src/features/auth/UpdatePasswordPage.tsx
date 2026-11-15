import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/api/context';
import { Button, ButtonLink, EmptyState, ErrorState, FormField, LoadingState, TextInput } from '../../components/ui';
import { AuthPageLayout } from './AuthPageLayout';
import { useAuth } from './AuthContext';
import { ErrorSummary } from './forms';
import { errorCode } from './errors';
import { summaryItems, validatePasswordPair } from './validation';
import { MIN_PASSWORD_LENGTH } from './session';

const ids = { password: 'new-password', confirm: 'new-password-confirm' };

export default function UpdatePasswordPage() {
  const api = useApi();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const next = validatePasswordPair(password, confirm);
    setErrors(next);
    setFailure(undefined);
    if (Object.keys(next).length) return;
    inFlight.current = true;
    setPending(true);
    try {
      await api.updatePassword(password);
      setDone(true);
    } catch (error) {
      const code = errorCode(error);
      setFailure(code === 'UNAUTHENTICATED' ? 'Your reset link has expired. Request a new one.'
        : code === 'VALIDATION' ? `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`
          : 'We could not update your password right now. Please try again.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  let body;
  if (auth.status === 'loading') body = <LoadingState label="Checking your reset link…" />;
  else if (auth.status === 'error') body = <ErrorState title="We could not check your session" onRetry={() => { void auth.refresh(); }}>Check your connection and try again.</ErrorState>;
  else if (auth.status === 'signedOut') body = (
    <EmptyState title="Open your reset link first" action={<ButtonLink to="/reset-password">Request a reset link</ButtonLink>}>
      To choose a new password, open the link from your password reset email. It signs you in for this step only.
      {api.mode === 'demo' && <> In this demonstration, <Link to="/sign-in">sign in</Link> with a demo account first.</>}
    </EmptyState>
  );
  else if (done) body = (
    <div className="auth-confirmation" role="status">
      <h2>Password updated</h2>
      <p>Use your new password the next time you sign in.</p>
      <ButtonLink to="/app">Continue to your workspace</ButtonLink>
    </div>
  );
  else body = (
    <form className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
      <ErrorSummary items={summaryItems(errors, ids)} message={failure} />
      <p className="auth-signed-in">Signed in as <strong>{auth.user?.email}</strong></p>
      <FormField id={ids.password} label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} error={errors.password}>
        <TextInput type="password" autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); setErrors(x => ({ ...x, password: undefined })); }} />
      </FormField>
      <FormField id={ids.confirm} label="Confirm new password" error={errors.confirm}>
        <TextInput type="password" autoComplete="new-password" value={confirm} onChange={e => { setConfirm(e.target.value); setErrors(x => ({ ...x, confirm: undefined })); }} />
      </FormField>
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save new password'}</Button>
    </form>
  );

  return <AuthPageLayout label="ACCOUNT RECOVERY" title={<>Set a new <em>password.</em></>}>{body}</AuthPageLayout>;
}
