import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useApi } from '../../lib/api/context';
import type { ReviewQueueItem, ReviewState } from '../../lib/api/types';
import { Button, ButtonLink, EmptyState, ErrorState, FormField, LoadingState, Select } from '../../components/ui';
import { ErrorSummary } from '../auth/forms';
import { summaryItems } from '../auth/validation';
import { errorCode, friendlyError } from '../auth/errors';
import { useLoad } from '../auth/useLoad';
import { REVIEW_IS_NOT_ACCREDITATION, reviewLabels, useAppShell } from '../organizations/ShellContext';
import '../organizations/organizations.css';

const REASON_MAX = 1000;
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function ReviewItem({ item, onRecorded }: { item: ReviewQueueItem; onRecorded(message: string): Promise<void> }) {
  const api = useApi();
  const [outcome, setOutcome] = useState<ReviewState>(item.reviewState === 'reviewed' ? 'suspended' : 'reviewed');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ reason?: string }>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const ids = { reason: `review-reason-${item.organizationId}` };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const text = reason.trim();
    const next = { reason: !text ? 'Enter a private reason for this decision.' : text.length > REASON_MAX ? `Reason must be ${REASON_MAX} characters or fewer.` : undefined };
    setErrors(next);
    setFailure(undefined);
    if (next.reason) return;
    inFlight.current = true;
    setPending(true);
    try {
      await api.recordIssuerReview({ organizationId: item.organizationId, outcome, reason: text, expectedRevision: item.revision });
      setReason('');
      await onRecorded(`${item.displayName}: ${reviewLabels[outcome].toLowerCase()} recorded.`);
    } catch (caught) {
      if (errorCode(caught) === 'REVISION_CONFLICT') {
        setFailure('This organization changed since the list was loaded. The list has been refreshed; check it and record the decision again.');
        await onRecorded('').catch(() => undefined);
      } else setFailure(friendlyError(caught));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <li className="review-item">
      <div className="review-item-head">
        <div>
          <h3>{item.displayName}</h3>
          <small>Created {dateFormat.format(new Date(item.createdAt))} · {item.lastReviewAt ? `last reviewed ${dateFormat.format(new Date(item.lastReviewAt))}` : 'never reviewed'}</small>
        </div>
        <span className={`review-badge review-${item.reviewState}`}>{reviewLabels[item.reviewState]}</span>
      </div>
      <form className="review-form" noValidate onSubmit={submit} aria-busy={pending} aria-label={`Record review for ${item.displayName}`}>
        <ErrorSummary items={summaryItems(errors, ids)} message={failure} />
        <FormField id={`review-outcome-${item.organizationId}`} label="Outcome">
          <Select value={outcome} onChange={e => setOutcome(e.target.value as ReviewState)}>
            <option value="reviewed">Reviewed — may issue</option>
            <option value="suspended">Suspended — may not issue</option>
            <option value="pending">Pending — return to queue</option>
          </Select>
        </FormField>
        <FormField id={ids.reason} label="Private reason" hint="Kept in the review record. It is never shown publicly or to the organization." error={errors.reason}>
          <textarea className="text-area" value={reason} maxLength={REASON_MAX + 50} onChange={e => { setReason(e.target.value); setErrors({}); }} />
        </FormField>
        <div className="org-actions"><Button type="submit" disabled={pending}>{pending ? 'Recording…' : 'Record decision'}</Button></div>
      </form>
    </li>
  );
}

export default function ReviewPage() {
  const api = useApi();
  const shell = useAppShell();
  const [notice, setNotice] = useState<string>();
  const admin = shell.isPlatformAdmin;
  const { state, refresh: load, retry } = useLoad(useCallback(async () => (admin ? api.listReviewQueue() : []), [api, admin]));
  const denied = !admin || (state.status === 'error' && errorCode(state.error) === 'FORBIDDEN');

  const onRecorded = async (message: string) => {
    if (message) setNotice(message);
    load();
    // The reviewer may also belong to a reviewed organization; refresh its banner.
    await shell.reload().catch(() => undefined);
  };

  let body;
  if (denied) {
    body = <EmptyState title="Platform review is restricted" action={<ButtonLink to="/app">Return to the workspace</ButtonLink>}>Only VeriMark platform reviewers can see organizations awaiting review.</EmptyState>;
  } else if (state.status === 'loading') body = <LoadingState label="Loading the review queue…" />;
  else if (state.status === 'error') body = <ErrorState title="The review queue could not be loaded" onRetry={retry}>{friendlyError(state.error)}</ErrorState>;
  else {
    const waiting = state.data.filter(i => i.reviewState === 'pending');
    const others = state.data.filter(i => i.reviewState !== 'pending');
    body = (
      <>
        <p role="status" className="org-notice">{notice}</p>
        <h2 className="review-section-heading">Awaiting review ({waiting.length})</h2>
        {waiting.length === 0 ? <EmptyState title="Nothing is waiting">Every organization has a recorded decision.</EmptyState>
          : <ul className="review-queue">{waiting.map(item => <ReviewItem key={item.organizationId} item={item} onRecorded={onRecorded} />)}</ul>}
        {others.length > 0 && <>
          <h2 className="review-section-heading">Reviewed and suspended ({others.length})</h2>
          <ul className="review-queue">{others.map(item => <ReviewItem key={item.organizationId} item={item} onRecorded={onRecorded} />)}</ul>
        </>}
      </>
    );
  }

  return (
    <section className="org-page route-enter">
      <div className="org-heading">
        <p className="eyebrow">PLATFORM REVIEW</p>
        <h1>Organization review</h1>
        <p>Confirm that each organization is who it says it is before it can issue. {REVIEW_IS_NOT_ACCREDITATION}</p>
      </div>
      {body}
    </section>
  );
}
