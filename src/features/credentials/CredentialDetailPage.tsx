import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, ErrorState, FormField, LoadingState, StatusPill, TextInput } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import type { CredentialDetail, CredentialEventType, DeliveryLink } from '../../lib/api/types';
import { renderCertificatePdf, verificationUrl } from '../../lib/certificate';
import { useWorkspace } from '../organizations/WorkspaceContext';
import { ReplaceDialog, RevokeDialog } from './LifecycleDialogs';
import { DemoNotice, Modal, PageIntro } from './shared/components';
import { errorCode, friendlyError, type FriendlyError } from './shared/errors';
import { downloadFile, formatDate, formatDateTime } from './shared/format';

type Load = { state: 'loading' } | { state: 'unavailable' } | { state: 'error'; error: FriendlyError } | { state: 'ready'; credential: CredentialDetail };
const EVENT_WORDS: Record<CredentialEventType, string> = { issued: 'Issued', revoked: 'Revoked', replaced: 'Replaced' };
type OpenDialog = null | 'revoke' | 'replace' | 'link';

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
  await navigator.clipboard.writeText(text);
}

export default function CredentialDetailPage() {
  const { credentialId = '' } = useParams();
  return <CredentialRecord key={credentialId} credentialId={credentialId} />;
}

function CredentialRecord({ credentialId }: { credentialId: string }) {
  const api = useApi();
  const { organization, canIssue } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [notice, setNotice] = useState<string>(() => (location.state as { notice?: string } | null)?.notice ?? '');
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'error'>('idle');
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<FriendlyError | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);

  const fetchRecord = useCallback(() => api.getCredential(organization.id, credentialId)
    .then(credential => setLoad({ state: 'ready', credential }))
    .catch(error => {
      const code = errorCode(error);
      setLoad(code === 'NOT_FOUND' || code === 'FORBIDDEN' ? { state: 'unavailable' } : { state: 'error', error: friendlyError(error) });
    }), [api, organization.id, credentialId]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  const announce = (message: string) => { setNotice(message); requestAnimationFrame(() => noticeRef.current?.focus()); };
  const afterChange = async (message: string) => { setDialog(null); await fetchRecord(); announce(message); };

  if (load.state === 'loading') return <section className="fsc-page"><PageIntro title="Record" /><LoadingState label="Loading record…" /></section>;
  if (load.state === 'unavailable') {
    return <section className="fsc-page">
      <PageIntro title="Record unavailable" />
      <EmptyState title="This record is unavailable" action={<ButtonLink to="/app/credentials" variant="outline">Back to records</ButtonLink>}>
        It may not exist, or it may not belong to your organization.
      </EmptyState>
    </section>;
  }
  if (load.state === 'error') {
    return <section className="fsc-page"><PageIntro title="Record" />
      <ErrorState title={load.error.title} onRetry={() => { setLoad({ state: 'loading' }); fetchRecord(); }}>{load.error.message}</ErrorState>
    </section>;
  }

  const c = load.credential;
  const verifyUrl = verificationUrl(c.publicId);
  const active = c.status === 'valid' || c.status === 'expired';
  const showActions = canIssue && active;

  async function copy(text: string, label: string) {
    try { await copyText(text); setCopyStatus(`${label} copied.`); }
    catch { setCopyStatus(`Could not copy automatically. Select the ${label.toLowerCase()} and copy it.`); }
  }

  async function downloadPdf() {
    if (pdfState === 'working') return;
    setPdfState('working');
    try {
      const bytes = await renderCertificatePdf({
        publicId: c.publicId, issuerDisplayName: c.issuerDisplayName, recipientDisplayName: c.recipientDisplayName, title: c.title,
        achievement: c.achievement, issuedAt: c.issuedAt, expiresAt: c.expiresAt, template: c.template, verifyUrl,
      });
      downloadFile(new Uint8Array(bytes), `verimark-${c.publicId}.pdf`, 'application/pdf');
      setPdfState('idle');
    } catch { setPdfState('error'); }
  }

  async function createLink() {
    if (linkBusy) return;
    setLinkBusy(true); setLinkError(null);
    try {
      const created: DeliveryLink = await api.createDeliveryLink(organization.id, c.id);
      setLink({ url: `${window.location.origin}/receive#${created.token}`, expiresAt: created.expiresAt });
      setCopyStatus('');
      setDialog(null);
      requestAnimationFrame(() => linkRef.current?.focus());
    } catch (error) {
      if (errorCode(error) === 'INVALID_TRANSITION') { setDialog(null); await afterChange('This record can no longer be shared. The latest version is shown.'); }
      else setLinkError(friendlyError(error));
    } finally { setLinkBusy(false); }
  }

  const invalidTransition = () => { void afterChange('The record status had already changed. The latest version is shown.'); };

  return <section className="fsc-page">
    <PageIntro eyebrow={`Record ${c.publicId}`} title={c.recipientDisplayName} actions={<ButtonLink to="/app/credentials" variant="ghost">All records</ButtonLink>}>
      <p>{c.title}</p>
    </PageIntro>
    <DemoNotice />
    {notice && <p className="fsc-status-line" role="status" tabIndex={-1} ref={noticeRef}>{notice}</p>}

    <div className="fsc-two">
      <div className="fsc-panel">
        <h2>Record details</h2>
        <dl className="fsc-dl">
          <dt>Status</dt><dd><StatusPill status={c.status} /></dd>
          <dt>Recipient</dt><dd>{c.recipientDisplayName}</dd>
          <dt>Title</dt><dd>{c.title}</dd>
          <dt>Achievement</dt><dd>{c.achievement}</dd>
          <dt>Issuer</dt><dd>{c.issuerDisplayName}</dd>
          <dt>Issued</dt><dd>{formatDateTime(c.issuedAt)}</dd>
          <dt>Expires</dt><dd>{formatDate(c.expiresAt)}</dd>
          <dt>Public ID</dt><dd className="fsc-mono">{c.publicId}</dd>
          <dt>Version</dt><dd>{c.versionNumber}</dd>
          <dt>Template heading</dt><dd>{c.template.heading}</dd>
          {canIssue && <><dt>Recipient e-mail</dt><dd>{c.recipientEmail ?? 'Not provided'}</dd></>}
          {c.replacesPublicId && <><dt>Replaces</dt><dd><Link to={`/app/credentials?search=${encodeURIComponent(c.replacesPublicId)}`}>Earlier record {c.replacesPublicId}</Link></dd></>}
          {c.replacedByPublicId && <><dt>Replaced by</dt><dd><Link to={`/app/credentials?search=${encodeURIComponent(c.replacedByPublicId)}`}>Newer record {c.replacedByPublicId}</Link></dd></>}
        </dl>
      </div>

      <div className="fsc-form">
        <div className="fsc-panel fsc-form">
          <h2>Public verification</h2>
          <p className="fsc-lede">Anyone with this address can check the record. It shows only the public details, never the e-mail or internal history.</p>
          <FormField id="verify-url" label="Verification link"><TextInput readOnly value={verifyUrl} onFocus={e => e.currentTarget.select()} /></FormField>
          <div className="fsc-actions">
            <Button size="sm" variant="outline" onClick={() => copy(verifyUrl, 'Verification link')}>Copy link</Button>
            {/* Demonstration data lives in this tab's session storage; a new tab would start from the seed. */}
            {api.mode === 'demo'
              ? <Link className="button button-ghost button-sm" to={`/verify/${c.publicId}`}>Open public page</Link>
              : <a className="button button-ghost button-sm" href={verifyUrl} target="_blank" rel="noopener noreferrer">Open public page<span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
        </div>

        {showActions && <div className="fsc-panel fsc-form">
          <h2>Actions</h2>
          <div className="fsc-actions">
            <Button variant="outline" onClick={downloadPdf} disabled={pdfState === 'working'}>{pdfState === 'working' ? 'Preparing PDF…' : 'Download certificate (PDF)'}</Button>
            <Button variant="outline" onClick={() => { setLinkError(null); setDialog('link'); }}>{link ? 'Create a new recipient link' : 'Create recipient link'}</Button>
          </div>
          {pdfState === 'error' && <p className="fsc-notice fsc-notice-error" role="alert">The certificate PDF could not be prepared. The online record is unaffected. Try again.</p>}
          <div className="fsc-actions">
            <Button variant="ghost" onClick={() => setDialog('replace')}>Replace</Button>
            <Button variant="ghost" onClick={() => setDialog('revoke')}>Revoke</Button>
          </div>
        </div>}
        {canIssue && !active && <p className="fsc-notice">This record is {c.status}. It can no longer be revoked, replaced or shared.</p>}

        {link && <div className="fsc-secret" ref={linkRef} tabIndex={-1} aria-labelledby="link-title">
          <h2 id="link-title" style={{ fontSize: 22, margin: 0 }}>Recipient link</h2>
          <p><strong>This link is shown only once.</strong> Copy it now and send it to the recipient yourself; VeriMark does not send e-mail. Creating a new link disables this one.</p>
          <FormField id="recipient-link" label="Private recipient link" hint={api.mode === 'demo' ? `Expires ${formatDateTime(link.expiresAt)}. Demonstration: this link only works in this browser tab, because demonstration data is not stored on a server.` : `Expires ${formatDateTime(link.expiresAt)}.`}>
            <TextInput readOnly value={link.url} onFocus={e => e.currentTarget.select()} />
          </FormField>
          <div className="fsc-actions"><Button size="sm" onClick={() => copy(link.url, 'Recipient link')}>Copy recipient link</Button></div>
        </div>}
        {copyStatus && <p role="status" className="field-hint">{copyStatus}</p>}
      </div>
    </div>

    <div className="fsc-panel">
      <h2>History</h2>
      {c.events.length === 0 ? <p className="fsc-lede">No lifecycle events recorded.</p> : <ol className="fsc-list">
        {[...c.events].sort((a, b) => a.at.localeCompare(b.at)).map(event => <li key={event.id}>
          <div><strong>{EVENT_WORDS[event.type] ?? event.type}</strong> by {event.actorDisplayName}{event.reason && <small>Reason: {event.reason}</small>}</div>
          <time dateTime={event.at}>{formatDateTime(event.at)}</time>
        </li>)}
      </ol>}
    </div>

    {showActions && <>
      <RevokeDialog open={dialog === 'revoke'} organizationId={organization.id} credential={c} onClose={() => setDialog(null)} onInvalidTransition={invalidTransition} onRevoked={() => afterChange('Record revoked. Verification now shows it as revoked.')} />
      <ReplaceDialog open={dialog === 'replace'} organizationId={organization.id} credential={c} onClose={() => setDialog(null)} onInvalidTransition={invalidTransition}
        onReplaced={ref => { setDialog(null); navigate(`/app/credentials/${encodeURIComponent(ref.id)}`, { state: { notice: `Replacement issued as ${ref.publicId}. The earlier record is now marked as replaced.` } }); }} />
      <Modal open={dialog === 'link'} title={link ? 'Create a new recipient link?' : 'Create a recipient link?'} onClose={() => setDialog(null)} busy={linkBusy}>
        <p>The recipient can use this private link to view and download their certificate without an account.</p>
        <p><strong>Creating a link disables any earlier link for this record.</strong> The new link is shown only once.</p>
        {linkError && <div className="fsc-notice fsc-notice-error" role="alert"><h3>{linkError.title}</h3><p>{linkError.message}</p></div>}
        <div className="fsc-actions">
          <Button onClick={createLink} disabled={linkBusy}>{linkBusy ? 'Creating…' : 'Create link'}</Button>
          <Button variant="ghost" onClick={() => setDialog(null)} disabled={linkBusy}>Cancel</Button>
        </div>
      </Modal>
    </>}
  </section>;
}
