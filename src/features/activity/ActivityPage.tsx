import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import type { AuditEntry } from '../../lib/api/types';
import { useWorkspace } from '../organizations/WorkspaceContext';
import { DemoNotice, PageIntro } from '../credentials/shared/components';
import { friendlyError, type FriendlyError } from '../credentials/shared/errors';
import { describeAction, formatDateTime } from '../credentials/shared/format';

const PAGE_SIZE = 25;
type Load = { state: 'loading' } | { state: 'error'; error: FriendlyError } | { state: 'ready'; items: AuditEntry[]; nextCursor: string | null };

export default function ActivityPage() {
  const api = useApi();
  const { organization } = useWorkspace();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [more, setMore] = useState<'idle' | 'loading' | 'error'>('idle');
  const request = useRef(0);

  const fetchFirst = useCallback(() => {
    const id = ++request.current;
    return api.listAudit(organization.id, { limit: PAGE_SIZE })
      .then(page => { if (id === request.current) setLoad({ state: 'ready', items: page.items, nextCursor: page.nextCursor }); })
      .catch(error => { if (id === request.current) setLoad({ state: 'error', error: friendlyError(error) }); });
  }, [api, organization.id]);

  useEffect(() => { fetchFirst(); }, [fetchFirst]);

  async function loadMore() {
    if (load.state !== 'ready' || !load.nextCursor || more === 'loading') return;
    setMore('loading');
    try {
      const page = await api.listAudit(organization.id, { cursor: load.nextCursor, limit: PAGE_SIZE });
      setLoad(current => current.state === 'ready' ? { state: 'ready', items: [...current.items, ...page.items.filter(i => !current.items.some(e => e.id === i.id))], nextCursor: page.nextCursor } : current);
      setMore('idle');
    } catch { setMore('error'); }
  }

  return <section className="fsc-page">
    <PageIntro eyebrow={organization.displayName} title="Activity">
      <p>A record of who did what in your organization, newest first. Entries cannot be edited.</p>
    </PageIntro>
    <DemoNotice />
    {load.state === 'loading' && <LoadingState label="Loading activity…" />}
    {load.state === 'error' && <ErrorState title={load.error.title} onRetry={() => { setLoad({ state: 'loading' }); fetchFirst(); }}>{load.error.message}</ErrorState>}
    {load.state === 'ready' && load.items.length === 0 && <EmptyState title="No activity yet">Actions such as creating templates and issuing records will appear here.</EmptyState>}
    {load.state === 'ready' && load.items.length > 0 && <>
      <div className="fsc-scroll">
        <table className="fsc-table fsc-cards">
          <caption className="sr-only">Activity history</caption>
          <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Target</th></tr></thead>
          <tbody>{load.items.map(entry => <tr key={entry.id}>
            <td data-label="When"><time dateTime={entry.at}>{formatDateTime(entry.at)}</time></td>
            <td data-label="Who">{entry.actorDisplayName}</td>
            <td data-label="Action">{describeAction(entry.action)}</td>
            <td data-label="Target">{entry.targetLabel || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {more === 'error' && <p className="fsc-notice fsc-notice-error" role="alert">More activity could not be loaded. Try again.</p>}
      {load.nextCursor && <div className="fsc-actions"><Button variant="outline" onClick={loadMore} disabled={more === 'loading'}>{more === 'loading' ? 'Loading…' : 'Load more'}</Button></div>}
    </>}
  </section>;
}
