import { useEffect, useId, useRef, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { useApi } from '../../../lib/api/context';
import './app-pages.css';

/** Labels every screen as a demonstration when the local demo adapter is active. */
export function DemoNotice() {
  const api = useApi();
  if (api.mode !== 'demo') return null;
  return <p className="fsc-demo-note"><strong>Demonstration.</strong> All people, organizations, records and numbers here are fictional. Nothing is issued for real.</p>;
}

export function PageIntro({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return <header className="fsc-intro">
    <div>
      {eyebrow && <p className="fsc-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <div className="fsc-lede">{children}</div>}
    </div>
    {actions && <div className="fsc-intro-actions">{actions}</div>}
  </header>;
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`text-input fsc-textarea ${className}`.trim()} {...props} />;
}

export interface SummaryItem { id: string; message: string }
/** A focusable list of problems linking to each field. */
export function ErrorSummary({ title = 'There is a problem', items, summaryRef }: { title?: string; items: SummaryItem[]; summaryRef?: Ref<HTMLDivElement> }) {
  if (!items.length) return null;
  return <div className="fsc-error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
    <h2>{title}</h2>
    <ul>{items.map(item => <li key={item.id + item.message}><a href={`#${item.id}`} onClick={event => { event.preventDefault(); document.getElementById(item.id)?.focus(); }}>{item.message}</a></li>)}</ul>
  </div>;
}

/**
 * Accessible modal built on the native <dialog> element: showModal() makes the background inert,
 * Escape closes it (unless `busy`), and focus returns to the element that opened it.
 */
export function Modal({ open, title, onClose, busy = false, children, describedBy }: { open: boolean; title: string; onClose: () => void; busy?: boolean; children: ReactNode; describedBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      const first = dialog.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]');
      first?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      const target = returnFocus.current;
      returnFocus.current = null;
      if (target?.isConnected) target.focus();
    }
  }, [open]);
  useEffect(() => () => {
    const target = returnFocus.current;
    if (target?.isConnected) target.focus();
  }, []);
  const requestClose = () => { if (!busyRef.current) onClose(); };
  return <dialog ref={ref} className="fsc-dialog" aria-labelledby={titleId} aria-describedby={describedBy}
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose(); } }}>
    {open && <div className="fsc-dialog-body">
      <h2 id={titleId}>{title}</h2>
      {children}
    </div>}
  </dialog>;
}

/** Wide tables scroll inside a labelled, keyboard-focusable region instead of the page. */
export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div className="fsc-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
