import { useRef, useState, type FormEvent } from 'react';
import { useApi } from '../../lib/api/context';
import type { SessionUser } from '../../lib/api/types';
import { Button, FormField, TextInput } from '../../components/ui';
import { ErrorSummary } from './forms';
import { errorCode } from './errors';
import { summaryItems, validateSignIn, type SignInErrors as Errors } from './validation';

export function SignInForm({ onSignedIn, idPrefix = 'sign-in', submitLabel = 'Sign in', prefill }: {
  onSignedIn(user: SessionUser): void | Promise<void>;
  idPrefix?: string;
  submitLabel?: string;
  prefill?: { email: string; password: string; key: number };
}) {
  const api = useApi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [lastPrefill, setLastPrefill] = useState(prefill?.key);
  if (prefill && prefill.key !== lastPrefill) {
    setLastPrefill(prefill.key);
    setEmail(prefill.email);
    setPassword(prefill.password);
    setErrors({});
    setFailure(undefined);
  }
  const ids = { email: `${idPrefix}-email`, password: `${idPrefix}-password` };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const next = validateSignIn(email, password);
    setErrors(next);
    setFailure(undefined);
    if (Object.keys(next).length) return;
    inFlight.current = true;
    setPending(true);
    try {
      const user = await api.signIn(email.trim(), password);
      await onSignedIn(user);
    } catch (error) {
      const code = errorCode(error);
      setPassword('');
      setFailure(code === 'RATE_LIMITED' ? 'Too many attempts. Wait a moment and try again.'
        : code === 'UNAUTHENTICATED' || code === 'VALIDATION' || code === 'NOT_FOUND' ? 'The email address or password is not correct.'
          : 'We could not sign you in right now. Please try again.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
      <ErrorSummary items={summaryItems(errors, ids)} message={failure} />
      <FormField id={ids.email} label="Email address" error={errors.email}>
        <TextInput type="email" autoComplete="email" inputMode="email" spellCheck={false} value={email}
          onChange={event => { setEmail(event.target.value); if (errors.email) setErrors(e => ({ ...e, email: undefined })); }} />
      </FormField>
      <FormField id={ids.password} label="Password" error={errors.password}>
        <TextInput type="password" autoComplete="current-password" value={password}
          onChange={event => { setPassword(event.target.value); if (errors.password) setErrors(e => ({ ...e, password: undefined })); }} />
      </FormField>
      <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : submitLabel}</Button>
    </form>
  );
}
