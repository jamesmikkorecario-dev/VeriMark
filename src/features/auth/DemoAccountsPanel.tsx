import { DEMO_ACCOUNTS } from '../../lib/api/demoAdapter';
import { useApi } from '../../lib/api/context';
import { Button } from '../../components/ui';

/** Shown only in demo mode. Every account is fictional and exists only in this browser session. */
export function DemoAccountsPanel({ onUse }: { onUse?: (email: string, password: string) => void }) {
  const api = useApi();
  if (api.mode !== 'demo') return null;
  return (
    <aside className="demo-accounts" aria-labelledby="demo-accounts-title">
      <p className="eyebrow">DEMONSTRATION · FICTIONAL DATA</p>
      <h2 id="demo-accounts-title">Demo accounts</h2>
      <p>This is a local demonstration with fictional data. Nothing is sent to a server and no email is delivered. Anything you create or change stays only in this browser tab and is gone when you close it. Every account below uses the password <code>{DEMO_ACCOUNTS[0].password}</code>.</p>
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
