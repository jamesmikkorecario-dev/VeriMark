import { useRef, useState, type FormEvent } from 'react';
import { useApi } from '../../lib/api/context';
import type { SignUpResult } from '../../lib/api/types';
import { Button, FormField, TextInput } from '../../components/ui';
import { ErrorSummary } from './forms';
import { summaryItems, validateSignUp, type SignUpErrors, type SignUpField } from './validation';
import { fieldErrors, fieldMessage, friendlyError } from './errors';
import { MIN_PASSWORD_LENGTH } from './session';

type Field = SignUpField;
type Errors = SignUpErrors;
const labels: Record<Field, string> = { displayName: 'Your name', email: 'Email address', password: 'Password', confirm: 'Confirm password' };

export function SignUpForm({ onSignedUp, idPrefix = 'sign-up' }: { onSignedUp(result: SignUpResult, email: string): void | Promise<void>; idPrefix?: string }) {
  const api = useApi();
  const [values, setValues] = useState<Record<Field, string>>({ displayName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const ids = Object.fromEntries((Object.keys(labels) as Field[]).map(f => [f, `${idPrefix}-${f}`])) as Record<Field, string>;
  const set = (field: Field) => (value: string) => {
    setValues(v => ({ ...v, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const next = validateSignUp(values);
    setErrors(next);
    setFailure(undefined);
    if (Object.keys(next).length) return;
    inFlight.current = true;
    setPending(true);
    try {
      const email = values.email.trim();
      const result = await api.signUp({ email, password: values.password, displayName: values.displayName.trim() });
      await onSignedUp(result, email);
    } catch (error) {
      const fields = fieldErrors(error).filter(f => f.field in labels);
      if (fields.length) setErrors(Object.fromEntries(fields.map(f => [f.field, fieldMessage(f.code, labels[f.field as Field])])));
      else setFailure(friendlyError(error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
      <ErrorSummary items={summaryItems(errors, ids)} message={failure} />
      <FormField id={ids.displayName} label={labels.displayName} hint="Shown to other members of your organization." error={errors.displayName}>
        <TextInput autoComplete="name" value={values.displayName} onChange={e => set('displayName')(e.target.value)} />
      </FormField>
      <FormField id={ids.email} label={labels.email} error={errors.email}>
        <TextInput type="email" autoComplete="email" inputMode="email" spellCheck={false} value={values.email} onChange={e => set('email')(e.target.value)} />
      </FormField>
      <FormField id={ids.password} label={labels.password} hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} error={errors.password}>
        <TextInput type="password" autoComplete="new-password" value={values.password} onChange={e => set('password')(e.target.value)} />
      </FormField>
      <FormField id={ids.confirm} label={labels.confirm} error={errors.confirm}>
        <TextInput type="password" autoComplete="new-password" value={values.confirm} onChange={e => set('confirm')(e.target.value)} />
      </FormField>
      <Button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</Button>
    </form>
  );
}
