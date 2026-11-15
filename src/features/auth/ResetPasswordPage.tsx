import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/api/context';
import { Button, FormField, TextInput } from '../../components/ui';
import { AuthPageLayout } from './AuthPageLayout';
import { ErrorSummary } from './forms';
import { errorCode } from './errors';
import { isEmailAddress } from './session';

/** Transport failures can be retried; every other outcome shows the same neutral confirmation. */
const RETRYABLE = new Set(['RATE_LIMITED', 'TEMPORARILY_UNAVAILABLE', 'INTERNAL_ERROR']);

export default function ResetPasswordPage() {
  const api = useApi();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const value = email.trim();
    const problem = !value ? 'Enter your email address.' : !isEmailAddress(value) ? 'Enter an email address in the format name@example.com.' : undefined;
    setError(problem);
    setFailure(undefined);
    if (problem) return;
    inFlight.current = true;
    setPending(true);
    try {
      await api.requestPasswordReset(value);
      setSent(true);
    } catch (caught) {
      const code = errorCode(caught);
      if (code && !RETRYABLE.has(code)) setSent(true);
      else setFailure(code === 'RATE_LIMITED' ? 'Too many requests. Wait a moment and try again.' : 'We could not send the request right now. Please try again.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <AuthPageLayout label="ACCOUNT RECOVERY" title={<>Reset your <em>password.</em></>}
      intro={<p>Enter the email address you use for VeriMark. If it belongs to an account, we will send a link to choose a new password.</p>}>
      {sent ? (
        <div className="auth-confirmation" role="status">
          <h2>Check your email</h2>
          <p>If an account exists for that address, a password reset link is on its way. It may take a few minutes to arrive; check your spam folder too.</p>
          {api.mode === 'demo' && <p className="demo-note">Demonstration: no email is sent. To try changing a password, sign in with a demo account and open <Link to="/update-password">Set a new password</Link>.</p>}
          <p className="auth-links"><Link to="/sign-in">Return to sign in</Link></p>
        </div>
      ) : (
        <form className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
          <ErrorSummary items={error ? [{ id: 'reset-email', message: error }] : []} message={failure} />
          <FormField id="reset-email" label="Email address" error={error}>
            <TextInput type="email" autoComplete="email" inputMode="email" spellCheck={false} value={email} onChange={e => { setEmail(e.target.value); setError(undefined); }} />
          </FormField>
          <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</Button>
          <p className="auth-links"><Link to="/sign-in">Return to sign in</Link></p>
        </form>
      )}
    </AuthPageLayout>
  );
}
