import { useEffect, useRef } from 'react';

import type { SummaryItem } from './validation';

/** Linked error summary. Receives focus when it appears so keyboard and screen-reader users land on it. */
export function ErrorSummary({ title = 'There is a problem', items, message }: { title?: string; items: SummaryItem[]; message?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = items.length > 0 || Boolean(message);
  const signature = `${message ?? ''}|${items.map(i => `${i.id}:${i.message}`).join(',')}`;
  useEffect(() => { if (visible) ref.current?.focus(); }, [visible, signature]);
  if (!visible) return null;
  return (
    <div ref={ref} className="error-summary" role="alert" tabIndex={-1} aria-labelledby="error-summary-title">
      <h2 id="error-summary-title">{title}</h2>
      {message && <p>{message}</p>}
      {items.length > 0 && <ul>{items.map(item => (
        <li key={item.id}><a href={`#${item.id}`} onClick={event => { event.preventDefault(); document.getElementById(item.id)?.focus(); }}>{item.message}</a></li>
      ))}</ul>}
    </div>
  );
}

