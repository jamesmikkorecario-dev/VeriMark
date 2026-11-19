import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEMO_ACCOUNTS } from '../../lib/api/demo/state';
import { resetDemoData } from '../../lib/api/demo/reset';
import { useApi } from '../../lib/api/context';
import { Button, ButtonLink } from '../../components/ui';
import { Modal } from '../credentials/shared/components';

/**
 * "Reset demo data" with a confirmation step. Demo mode only. The dialog is portalled to <body> so it never inherits
 * the small, letter-spaced type of the demonstration ribbon it can be opened from.
 */
export function DemoResetControl({ appearance = 'button' }: { appearance?: 'button' | 'ribbon' }) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const consequence = useId();
  if (api.mode !== 'demo') return null;
  const trigger = appearance === 'ribbon'
    ? <button type="button" className="demo-ribbon-action" onClick={() => setOpen(true)}>Reset demo data</button>
    : <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Reset demo data</Button>;
  return (
    <>
      {trigger}
      {createPortal(
        <Modal open={open} title="Reset the demo data?" onClose={() => setOpen(false)} describedBy={consequence}>
          <p id={consequence}>This removes everything you created or changed in this browser tab (records, templates, members, recipient links) and restores the original fictional records. You will be signed back in as the demo owner. Nothing is stored on a server, so nothing else is affected.</p>
          <div className="fsc-actions">
            <Button variant="ghost" onClick={() => setOpen(false)}>Keep my changes</Button>
            <Button onClick={() => resetDemoData()}>Yes, reset everything</Button>
          </div>
        </Modal>,
        document.body,
      )}
    </>
  );
}

/** Shown only in demo mode. Every account is fictional and exists only in this browser session. */
export function DemoAccountsPanel({ onUse }: { onUse?: (email: string, password: string) => void }) {
  const api = useApi();
  if (api.mode !== 'demo') return null;
  return (
    <aside className="demo-accounts" aria-labelledby="demo-accounts-title">
      <p className="eyebrow">DEMONSTRATION · FICTIONAL DATA</p>
      <h2 id="demo-accounts-title">Demo accounts</h2>
      <p>This is a local demonstration with fictional data. Nothing is sent to a server and no email is delivered. Anything you create or change stays only in this browser tab and is gone when you close it. Every account below uses the password <code>{DEMO_ACCOUNTS[0].password}</code>.</p>
      <div className="fsc-actions demo-accounts-actions">
        <ButtonLink to="/demo" size="sm">Open the live demo</ButtonLink>
        <DemoResetControl />
      </div>
      <ul>
        {DEMO_ACCOUNTS.map(account => (
          <li key={account.email}>
            <div><strong>{account.email}</strong><small>{account.description}</small></div>
            {onUse && <Button size="sm" variant="outline" onClick={() => onUse(account.email, account.password)} aria-label={`Use ${account.email}`}>Use</Button>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
