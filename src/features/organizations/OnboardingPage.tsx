import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/api/context';
import { Button, FormField, TextInput } from '../../components/ui';
import { ErrorSummary } from '../auth/forms';
import { fieldErrors, friendlyError } from '../auth/errors';
import { ORGANIZATION_NAME_MAX, REVIEW_IS_NOT_ACCREDITATION, useAppShell, validateOrganizationName } from './ShellContext';
import './organizations.css';

export default function OnboardingPage() {
  const api = useApi();
  const shell = useAppShell();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const hasOrganizations = shell.memberships.length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const problem = validateOrganizationName(name);
    setError(problem);
    setFailure(undefined);
    if (problem) return;
    inFlight.current = true;
    setPending(true);
    try {
      const organization = await api.createOrganization(name.trim());
      await shell.reload(organization.id);
      navigate('/app');
    } catch (caught) {
      if (fieldErrors(caught).length) setError(validateOrganizationName(name) ?? 'Check the organization name.');
      else setFailure(friendlyError(caught));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section className="org-page route-enter">
      <div className="org-heading">
        <p className="eyebrow">{hasOrganizations ? 'ANOTHER ORGANIZATION' : 'GET STARTED'}</p>
        <h1>Create your organization</h1>
        <p>{hasOrganizations ? 'Set up a separate issuing organization. Its records, members and templates are kept apart from your other organizations.' : 'You are not a member of an organization yet. Create one to issue credentials, or ask an owner to invite you to theirs.'}</p>
      </div>
      <div className="org-grid">
        <form className="org-card auth-form" noValidate onSubmit={submit} aria-busy={pending}>
          <ErrorSummary items={error ? [{ id: 'organization-name', message: error }] : []} message={failure} />
          <FormField id="organization-name" label="Organization name" hint="The name recipients and verifiers will see on every record. Up to 120 characters." error={error}>
            <TextInput autoComplete="organization" value={name} maxLength={ORGANIZATION_NAME_MAX + 20} onChange={e => { setName(e.target.value); setError(undefined); }} />
          </FormField>
          <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create organization'}</Button>
        </form>
        <aside className="org-card org-note">
          <h2>What happens next</h2>
          <p>You become the organization’s owner. New organizations start in <strong>review pending</strong>: you can invite members and prepare templates, but issuing stays unavailable until VeriMark confirms the organization’s identity.</p>
          <p>{REVIEW_IS_NOT_ACCREDITATION}</p>
          {hasOrganizations && <p><Link to="/app">Back to your workspace</Link></p>}
          {shell.isPlatformAdmin && <p><Link to="/app/review">Go to platform review</Link></p>}
        </aside>
      </div>
    </section>
  );
}
