import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink, EmptyState, ErrorState, LoadingState, StatusPill } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import type { CredentialSummary, OrganizationMetrics } from '../../lib/api/types';
import { useWorkspace } from '../organizations/WorkspaceContext';
import { DemoNotice, PageIntro } from '../credentials/shared/components';
import { friendlyError, type FriendlyError } from '../credentials/shared/errors';
import { formatDate } from '../credentials/shared/format';

type Load = { state: 'loading' } | { state: 'error'; error: FriendlyError } | { state: 'ready'; metrics: OrganizationMetrics; recent: CredentialSummary[] };

const METRICS: Array<{ key: keyof OrganizationMetrics; label: string; description: string }> = [
  { key: 'issued', label: 'Records issued', description: 'All records ever issued, including replaced and revoked ones.' },
  { key: 'valid', label: 'Currently valid', description: 'Not revoked, replaced or past their expiry date.' },
  { key: 'expired', label: 'Expired', description: 'Past their expiry date.' },
  { key: 'revoked', label: 'Revoked', description: 'Withdrawn by your organization.' },
  { key: 'replaced', label: 'Replaced', description: 'Superseded by a corrected record.' },
  { key: 'verificationChecks', label: 'Verification checks', description: 'Public lookups of your records. Not a count of unique people.' },
];

export default function DashboardHome() {
  const api = useApi();
  const { organization, membership, canIssue } = useWorkspace();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchAll = useCallback(() => Promise.all([api.getMetrics(organization.id), api.listCredentials(organization.id, { limit: 5 })])
    .then(([metrics, page]) => setLoad({ state: 'ready', metrics, recent: page.items.slice(0, 5) }))
    .catch(error => setLoad({ state: 'error', error: friendlyError(error) })), [api, organization.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const review = organization.reviewState;
  return <section className="fsc-page">
    <PageIntro eyebrow={`${organization.displayName} · ${membership.role}`} title="Overview">
      <p>Your organization's records, their status and what to do next.</p>
    </PageIntro>
    <DemoNotice />

    {review === 'pending' && <div className="fsc-notice fsc-notice-warn" role="note">
      <h2>Your organization is awaiting review</h2>
      <p>VeriMark checks each organization's identity before it can issue credentials. {canIssue ? 'You can prepare templates now; issuing becomes available once the review is complete.' : 'Issuing becomes available once the review is complete.'} The review is an identity check, not an accreditation.</p>
    </div>}
    {review === 'suspended' && <div className="fsc-notice fsc-notice-error" role="note">
      <h2>Issuing is suspended</h2>
      <p>Your organization cannot issue new records at the moment. Existing records keep their own status. Contact VeriMark for details.</p>
    </div>}

    <div className="fsc-panel">
      <h2>Next steps</h2>
      <div className="fsc-actions">
        {canIssue && review === 'reviewed' && <ButtonLink to="/app/issue">Issue credentials</ButtonLink>}
        {canIssue && <ButtonLink to="/app/templates" variant="outline">{review === 'reviewed' ? 'Manage templates' : 'Prepare templates'}</ButtonLink>}
        <ButtonLink to="/app/credentials" variant="outline">View records</ButtonLink>
        <ButtonLink to="/app/activity" variant="ghost">Activity</ButtonLink>
        {membership.role === 'owner' && <ButtonLink to="/app/organization" variant="ghost">Members and organization</ButtonLink>}
      </div>
      {!canIssue && <p className="field-hint">You have read-only access to this organization.</p>}
    </div>

    {load.state === 'loading' && <LoadingState label="Loading overview…" />}
    {load.state === 'error' && <ErrorState title={load.error.title} onRetry={() => { setLoad({ state: 'loading' }); fetchAll(); }}>{load.error.message}</ErrorState>}
    {load.state === 'ready' && <>
      <div>
        <h2 style={{ fontSize: 24 }}>Record counts</h2>
        {api.mode === 'demo' && <p className="field-hint">Demonstration numbers. They are fictional and describe no real organization.</p>}
        <ul className="fsc-metrics">{METRICS.map(m => <li key={m.key} className="fsc-metric">
          <span>{m.label}</span><strong>{load.metrics[m.key].toLocaleString('en-GB')}</strong><p>{m.description}</p>
        </li>)}</ul>
      </div>
      <div className="fsc-panel">
        <h2>Recent records</h2>
        {load.recent.length === 0
          ? <EmptyState title="No records yet" action={canIssue && review === 'reviewed' ? <ButtonLink to="/app/issue">Issue your first credential</ButtonLink> : undefined}>Issued records will appear here.</EmptyState>
          : <ul className="fsc-list">{load.recent.map(r => <li key={r.id}>
            <div><Link to={`/app/credentials/${encodeURIComponent(r.id)}`}>{r.recipientDisplayName}</Link><small>{r.title} · issued {formatDate(r.issuedAt, '—')}</small></div>
            <StatusPill status={r.status} />
          </li>)}</ul>}
        {load.recent.length > 0 && <p style={{ marginTop: 12, marginBottom: 0 }}><Link to="/app/credentials">All records</Link></p>}
      </div>
    </>}
  </section>;
}
