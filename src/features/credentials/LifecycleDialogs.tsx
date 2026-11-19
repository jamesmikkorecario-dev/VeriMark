import { useRef, useState, type FormEvent } from 'react';
import { Button, FormField, TextInput } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import { ApiError, type CredentialDetail, type DraftRowInput, type IssuedCredentialRef } from '../../lib/api/types';
import { normalizeDraftRow, todayUtc, validateDraftRow } from '../../lib/csv';
import { ErrorSummary, Modal, TextArea } from './shared/components';
import { errorCode, fieldMessage, friendlyError, type FriendlyError } from './shared/errors';
import { newIdempotencyKey } from './shared/format';

const REASON_LIMIT = 1000;
const reasonError = (reason: string) => (!reason ? fieldMessage('reason', 'REQUIRED') : reason.length > REASON_LIMIT ? fieldMessage('reason', 'TOO_LONG') : undefined);

/**
 * Keeps one idempotency key per exact request payload: a retry of the same request reuses it, while
 * changed input gets a fresh key so the server never sees one key with two different payloads.
 */
function useIdempotencyKey() {
  const current = useRef<{ signature: string; key: string } | null>(null);
  return {
    keyFor(signature: string) {
      if (!current.current || current.current.signature !== signature) current.current = { signature, key: newIdempotencyKey() };
      return current.current.key;
    },
    reset() { current.current = null; },
  };
}

interface DialogProps { open: boolean; organizationId: string; credential: CredentialDetail; onClose: () => void; onInvalidTransition: () => void }

export function RevokeDialog({ open, organizationId, credential, onClose, onInvalidTransition, onRevoked }: DialogProps & { onRevoked: () => void }) {
  const api = useApi();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);
  const idempotency = useIdempotencyKey();
  const close = () => { setReason(''); setError(undefined); setFailure(null); onClose(); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const trimmed = reason.trim();
    const problem = reasonError(trimmed);
    setError(problem); setFailure(null);
    if (problem) { document.getElementById('revoke-reason')?.focus(); return; }
    setBusy(true);
    try {
      await api.revokeCredential(organizationId, credential.id, { reason: trimmed, idempotencyKey: idempotency.keyFor(trimmed) });
      idempotency.reset(); setReason('');
      onRevoked();
    } catch (caught) {
      const code = errorCode(caught);
      if (code === 'INVALID_TRANSITION') { idempotency.reset(); setReason(''); onInvalidTransition(); }
      else if (code === 'VALIDATION' && caught instanceof ApiError && caught.fields.some(f => f.field.endsWith('reason'))) setError(fieldMessage('reason', caught.fields.find(f => f.field.endsWith('reason'))!.code));
      else setFailure(friendlyError(caught));
    } finally { setBusy(false); }
  }

  return <Modal open={open} title="Revoke this record?" onClose={close} busy={busy} describedBy="revoke-consequence">
    <form className="fsc-form" onSubmit={submit} noValidate>
      <p id="revoke-consequence">Revoking withdraws <strong>{credential.title}</strong> for <strong>{credential.recipientDisplayName}</strong>. Anyone who checks this record will see it as revoked. <strong>This cannot be undone.</strong></p>
      <FormField id="revoke-reason" label="Reason for revoking" hint="Required, up to 1000 characters. Kept in your organization's history; it is not shown publicly." error={error}>
        <TextArea value={reason} onChange={e => setReason(e.target.value)} required />
      </FormField>
      {failure && <div className="fsc-notice fsc-notice-error" role="alert"><h3>{failure.title}</h3><p>{failure.message} Trying again is safe.</p></div>}
      <div className="fsc-actions">
        <Button type="submit" disabled={busy}>{busy ? 'Revoking…' : 'Revoke record'}</Button>
        <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
      </div>
    </form>
  </Modal>;
}

type ReplacementValues = Required<Record<keyof DraftRowInput, string>>;
const REPLACE_IDS: Record<keyof DraftRowInput | 'reason', string> = { recipientDisplayName: 'replace-name', title: 'replace-title', achievement: 'replace-achievement', recipientEmail: 'replace-email', expiresOn: 'replace-expires', reason: 'replace-reason' };
const initialValues = (c: CredentialDetail): ReplacementValues => ({
  recipientDisplayName: c.recipientDisplayName, title: c.title, achievement: c.achievement,
  recipientEmail: c.recipientEmail ?? '', expiresOn: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
});

export function ReplaceDialog({ open, organizationId, credential, onClose, onInvalidTransition, onReplaced }: DialogProps & { onReplaced: (ref: IssuedCredentialRef) => void }) {
  const api = useApi();
  const [values, setValues] = useState<ReplacementValues>(() => initialValues(credential));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof DraftRowInput | 'reason', string>>>({});
  const [failure, setFailure] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const idempotency = useIdempotencyKey();
  const close = () => { setValues(initialValues(credential)); setReason(''); setErrors({}); setFailure(null); onClose(); };
  const set = (field: keyof DraftRowInput, value: string) => setValues(current => ({ ...current, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const replacement = normalizeDraftRow(values);
    const trimmedReason = reason.trim();
    const found: typeof errors = {};
    validateDraftRow(replacement, todayUtc()).forEach(issue => { found[issue.field] ??= fieldMessage(issue.field, issue.code); });
    const reasonProblem = reasonError(trimmedReason);
    if (reasonProblem) found.reason = reasonProblem;
    setErrors(found); setFailure(null);
    if (Object.keys(found).length) { requestAnimationFrame(() => summaryRef.current?.focus()); return; }
    setBusy(true);
    try {
      const signature = JSON.stringify([trimmedReason, replacement]);
      const ref = await api.replaceCredential(organizationId, credential.id, { reason: trimmedReason, replacement, idempotencyKey: idempotency.keyFor(signature) });
      idempotency.reset();
      onReplaced(ref);
    } catch (caught) {
      const code = errorCode(caught);
      if (code === 'INVALID_TRANSITION') { idempotency.reset(); onInvalidTransition(); }
      else if (code === 'VALIDATION' && caught instanceof ApiError && caught.fields.length) {
        const mapped: typeof errors = {};
        caught.fields.forEach(f => {
          const base = (f.field.split(/[.[\]]/).filter(Boolean).pop() ?? f.field) as keyof typeof REPLACE_IDS;
          if (REPLACE_IDS[base]) mapped[base] = fieldMessage(base, f.code);
        });
        if (Object.keys(mapped).length) { setErrors(mapped); requestAnimationFrame(() => summaryRef.current?.focus()); }
        else setFailure(friendlyError(caught));
      } else setFailure(friendlyError(caught));
    } finally { setBusy(false); }
  }

  const summary = (Object.keys(REPLACE_IDS) as Array<keyof typeof REPLACE_IDS>).filter(f => errors[f]).map(f => ({ id: REPLACE_IDS[f], message: errors[f] as string }));
  return <Modal open={open} title="Replace this record" onClose={close} busy={busy} describedBy="replace-consequence">
    <form className="fsc-form" onSubmit={submit} noValidate>
      <p id="replace-consequence">A replacement is a new record with a new public ID. The current record stays visible and is marked as replaced, with a link to the new one. Issued records are never edited.</p>
      <ErrorSummary items={summary} summaryRef={summaryRef} />
      <FormField id="replace-name" label="Recipient name" error={errors.recipientDisplayName}><TextInput value={values.recipientDisplayName} onChange={e => set('recipientDisplayName', e.target.value)} /></FormField>
      <FormField id="replace-title" label="Title" error={errors.title}><TextInput value={values.title} onChange={e => set('title', e.target.value)} /></FormField>
      <FormField id="replace-achievement" label="Achievement" error={errors.achievement}><TextArea value={values.achievement} onChange={e => set('achievement', e.target.value)} /></FormField>
      <FormField id="replace-email" label="Recipient e-mail (optional)" hint="Private." error={errors.recipientEmail}><TextInput type="email" value={values.recipientEmail} onChange={e => set('recipientEmail', e.target.value)} /></FormField>
      <FormField id="replace-expires" label="Expiry date (optional)" hint="Must be after today." error={errors.expiresOn}><TextInput type="date" value={values.expiresOn} onChange={e => set('expiresOn', e.target.value)} /></FormField>
      <FormField id="replace-reason" label="Reason for replacing" hint="Required, up to 1000 characters. Not shown publicly." error={errors.reason}><TextArea value={reason} onChange={e => setReason(e.target.value)} required /></FormField>
      {failure && <div className="fsc-notice fsc-notice-error" role="alert"><h3>{failure.title}</h3><p>{failure.message}</p></div>}
      <div className="fsc-actions">
        <Button type="submit" disabled={busy}>{busy ? 'Issuing replacement…' : 'Issue replacement'}</Button>
        <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
      </div>
    </form>
  </Modal>;
}
