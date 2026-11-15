import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, ErrorState, FormField, LoadingState, Select, StatusPill, TextInput } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import type { CredentialStatus, CredentialSummary } from '../../lib/api/types';
import { useWorkspace } from '../organizations/WorkspaceContext';
import { DemoNotice, PageIntro } from './shared/components';
import { friendlyError, type FriendlyError } from './shared/errors';
import { formatDate } from './shared/format';

export const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;
type StatusFilter = CredentialStatus | 'all';
const STATUSES: StatusFilter[] = ['all', 'valid', 'expired', 'revoked', 'replaced'];
const STATUS_LABELS: Record<StatusFilter, string> = { all: 'All statuses', valid: 'Valid', expired: 'Expired', revoked: 'Revoked', replaced: 'Replaced' };

type ListState = { state: 'loading' } | { state: 'error'; error: FriendlyError } | { state: 'ready'; items: CredentialSummary[]; nextCursor: string | null };

export default function CredentialsPage() {
  const api = useApi();
  const { organization, canIssue } = useWorkspace();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(() => params.get('search') ?? '');
  const [query, setQuery] = useState(search.trim());
  const [status, setStatus] = useState<StatusFilter>(() => { const s = params.get('status') as StatusFilter | null; return s && STATUSES.includes(s) ? s : 'all'; });
  const [list, setList] = useState<ListState>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [moreState, setMoreState] = useState<'idle' | 'loading' | 'error'>('idle');
  const request = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const id = ++request.current;
    api.listCredentials(organization.id, { search: query || undefined, status, limit: PAGE_SIZE })
      .then(page => { if (id === request.current) { setList({ state: 'ready', items: page.items, nextCursor: page.nextCursor }); setMoreState('idle'); } })
      .catch(error => { if (id === request.current) setList({ state: 'error', error: friendlyError(error) }); });
  }, [api, organization.id, query, status, attempt]);

  async function loadMore() {
    if (list.state !== 'ready' || !list.nextCursor || moreState === 'loading') return;
    const id = request.current;
    setMoreState('loading');
    try {
      const page = await api.listCredentials(organization.id, { search: query || undefined, status, cursor: list.nextCursor, limit: PAGE_SIZE });
      if (id !== request.current) return;
      setList(current => current.state === 'ready' ? { state: 'ready', items: [...current.items, ...page.items.filter(item => !current.items.some(existing => existing.id === item.id))], nextCursor: page.nextCursor } : current);
      setMoreState('idle');
    } catch { if (id === request.current) setMoreState('error'); }
  }

  const filtered = query !== '' || status !== 'all';
  const clear = () => { setSearch(''); setQuery(''); setStatus('all'); };
  const restart = () => { setList({ state: 'loading' }); setAttempt(a => a + 1); };

  return <section className="fsc-page">
    <PageIntro eyebrow={organization.displayName} title="Records" actions={canIssue ? <ButtonLink to="/app/issue">Issue credentials</ButtonLink> : undefined}>
      <p>Every credential your organization has issued, with its current status.</p>
    </PageIntro>
    <DemoNotice />
    <form className="fsc-form-grid" role="search" aria-label="Filter records" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); }}>
      <FormField id="records-search" label="Search records" hint="Recipient name, title or public ID.">
        <TextInput type="search" value={search} onChange={e => { setSearch(e.target.value); }} autoComplete="off" />
      </FormField>
      <FormField id="records-status" label="Status">
        <Select value={status} onChange={e => { setStatus(e.target.value as StatusFilter); setList({ state: 'loading' }); }}>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </Select>
      </FormField>
    </form>

    {list.state === 'loading' && <LoadingState label="Loading records…" />}
    {list.state === 'error' && <ErrorState title={list.error.title} onRetry={restart}>{list.error.message}</ErrorState>}
    {list.state === 'ready' && list.items.length === 0 && (filtered
      ? <EmptyState title="No matching records" action={<Button variant="outline" onClick={clear}>Clear filters</Button>}>Try another name, title, public ID or status.</EmptyState>
      : <EmptyState title="No records yet" action={canIssue ? <ButtonLink to="/app/issue">Issue your first credential</ButtonLink> : undefined}>
        {canIssue ? 'Records appear here once they are issued.' : 'Records appear here once an owner or issuer issues them.'}
      </EmptyState>)}
    {list.state === 'ready' && list.items.length > 0 && <>
      <p className="fsc-lede" role="status">{list.items.length} {list.items.length === 1 ? 'record' : 'records'} shown{list.nextCursor ? '; more available' : ''}.</p>
      <div className="fsc-scroll">
        <table className="fsc-table fsc-cards">
          <caption className="sr-only">Records</caption>
          <thead><tr><th scope="col">Recipient</th><th scope="col">Title</th><th scope="col">Issued</th><th scope="col">Expires</th><th scope="col">Status</th></tr></thead>
          <tbody>{list.items.map(item => <tr key={item.id}>
            <td data-label="Recipient"><Link to={`/app/credentials/${encodeURIComponent(item.id)}`}>{item.recipientDisplayName}</Link><small className="fsc-mono">{item.publicId}</small></td>
            <td data-label="Title">{item.title}{item.versionNumber > 1 && <small>Version {item.versionNumber}</small>}</td>
            <td data-label="Issued">{formatDate(item.issuedAt, '—')}</td>
            <td data-label="Expires">{formatDate(item.expiresAt)}</td>
            <td data-label="Status"><StatusPill status={item.status} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      {moreState === 'error' && <p className="fsc-notice fsc-notice-error" role="alert">More records could not be loaded. Try again.</p>}
      {list.nextCursor && <div className="fsc-actions"><Button variant="outline" onClick={loadMore} disabled={moreState === 'loading'}>{moreState === 'loading' ? 'Loading…' : 'Load more'}</Button></div>}
    </>}
  </section>;
}
