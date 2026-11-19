import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink, EmptyState, ErrorState, LoadingState, StatusPill } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import type { CredentialSummary, OrganizationMetrics, Role } from '../../lib/api/types';
import { useWorkspace } from '../organizations/WorkspaceContext';
import { DemoNotice, PageIntro } from '../credentials/shared/components';
import { friendlyError, type FriendlyError } from '../credentials/shared/errors';
import { formatDate } from '../credentials/shared/format';
import { DemoResetControl } from '../auth/DemoAccountsPanel';

type Load = { state: 'loading' } | { state: 'error'; error: FriendlyError } | { state: 'ready'; metrics: OrganizationMetrics; recent: CredentialSummary[] };

const METRICS: Array<{ key: keyof OrganizationMetrics; label: string; description: string }> = [
  { key: 'issued', label: 'Records issued', description: 'All records ever issued, including replaced and revoked ones.' },
  { key: 'valid', label: 'Currently valid', description: 'Not revoked, replaced or past their expiry date.' },
  { key: 'expired', label: 'Expired', description: 'Past their expiry date.' },
  { key: 'revoked', label: 'Revoked', description: 'Withdrawn by your organization.' },
  { key: 'replaced', label: 'Replaced', description: 'Superseded by a corrected record.' },
  { key: 'verificationChecks', label: 'Verification checks', description: 'Public lookups of your records. Not a count of unique people.' },
];

interface GuideStep { title: string; text: string; links: Array<{ to: string; label: string }>; needsAccess?: boolean }

/** Demo mode only: a short tour of what the working product can do, each step one click from the right screen. */
function DemoGuide({ role, canTry, recent }: { role: Role; canTry: boolean; recent: CredentialSummary[] }) {
  const recordPath = (record?: CredentialSummary) => (record ? `/app/credentials/${encodeURIComponent(record.id)}` : '/app/credentials');
  const valid = recent.filter(record => record.status === 'valid');
  const steps: GuideStep[] = [
    { title: 'Issue a credential', text: 'Create a record for a fictional recipient, review it, then approve it.', needsAccess: true, links: [{ to: '/app/issue', label: 'Open the issue form' }] },
    { title: 'Open a record and verify it publicly', text: 'See a record in full, then check what anyone holding its link would see.', links: [
      { to: recordPath(recent[0]), label: 'Open a record' },
      ...(recent[0] ? [{ to: `/verify/${encodeURIComponent(recent[0].publicId)}`, label: 'View its public page' }] : []),
    ] },
    { title: 'Replace a record', text: 'Correct a mistake with a tracked replacement. The original stays visible as replaced.', needsAccess: true, links: [{ to: recordPath(valid[0]), label: 'Choose a record to replace' }] },
    { title: 'Revoke a record', text: 'Withdraw a record with a reason. Public checks then report it as revoked.', needsAccess: true, links: [{ to: recordPath(valid[1] ?? valid[0]), label: 'Choose a record to revoke' }] },
    { title: 'Create a recipient link', text: 'Make a private link a recipient can use to download their certificate, with no account.', needsAccess: true, links: [{ to: recordPath(valid[0]), label: 'Open a record to share' }] },
    { title: 'See the activity', text: 'Every issue, replacement and revocation is written to the organization history.', links: [{ to: '/app/activity', label: 'Open the activity log' }] },
    { title: 'Switch role', text: 'See the same workspace as someone with fewer or different permissions.', links: [
      { to: '/demo?as=viewer', label: 'As a viewer (read only)' },
      { to: '/demo?as=admin', label: 'As the platform reviewer' },
      ...(role === 'owner' ? [] : [{ to: '/demo', label: 'Back to the owner' }]),
    ] },
  ];
  return <section className="fsc-panel demo-guide" aria-labelledby="demo-guide-title">
    <h2 id="demo-guide-title">Explore the demo</h2>
    <p className="field-hint">A suggested tour. Everything here is fictional and stays in this browser tab.</p>
    <ol className="demo-guide-steps">
      {steps.map(step => <li key={step.title}>
        <strong>{step.title}</strong>
        <span>{step.text}</span>
        {step.needsAccess && !canTry
          ? <small>Needs an owner or issuer in a reviewed organization. Switch role below.</small>
          : <span className="demo-guide-links">{step.links.map(link => <Link key={link.to + link.label} to={link.to}>{link.label}</Link>)}</span>}
      </li>)}
      <li>
        <strong>Start over</strong>
        <span>Restore the original fictional records and begin again.</span>
        <span className="demo-guide-links"><DemoResetControl /></span>
      </li>
    </ol>
  </section>;
}

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
    {api.mode === 'demo' && <DemoGuide role={membership.role} canTry={canIssue && review === 'reviewed'} recent={load.state === 'ready' ? load.recent : []} />}

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
