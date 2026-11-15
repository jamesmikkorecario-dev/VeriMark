import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/api/context';
import type { CreatedInvite, Invite, Member, Role } from '../../lib/api/types';
import { Button, EmptyState, ErrorState, FormField, LoadingState, Select, TextInput } from '../../components/ui';
import { ErrorSummary } from '../auth/forms';
import { errorCode, fieldErrors, fieldMessage, friendlyError } from '../auth/errors';
import { isEmailAddress } from '../auth/session';
import { useLoad } from '../auth/useLoad';
import { useWorkspace } from './WorkspaceContext';
import { ORGANIZATION_NAME_MAX, REVIEW_IS_NOT_ACCREDITATION, reviewExplanations, reviewLabels, roleLabels, validateOrganizationName } from './ShellContext';
import './organizations.css';

const LAST_OWNER = 'An organization must always have at least one owner. Make another member an owner first.';
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));


function NameSection() {
  const api = useApi();
  const { organization, membership, refresh } = useWorkspace();
  const isOwner = membership.role === 'owner';
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(organization.displayName);
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

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
      await api.renameOrganization(organization.id, { displayName: name.trim(), expectedRevision: organization.revision });
      await refresh();
      setEditing(false);
      setNotice('Organization name updated.');
    } catch (caught) {
      if (errorCode(caught) === 'REVISION_CONFLICT') {
        setFailure('Someone else changed this organization while you were editing. The latest details are now shown; check the name and save again.');
        await refresh().catch(() => undefined);
      } else if (fieldErrors(caught).length) setError('Enter a name of 1 to 120 characters.');
      else setFailure(friendlyError(caught));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section className="org-card" aria-labelledby="org-name-heading">
      <div className="org-card-head">
        <h2 id="org-name-heading">Organization details</h2>
        {isOwner && !editing && <Button size="sm" variant="outline" onClick={() => { setName(organization.displayName); setEditing(true); setNotice(undefined); }}>Rename</Button>}
      </div>
      <p role="status" className="org-notice">{notice}</p>
      {editing ? (
        <form className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
          <ErrorSummary items={error ? [{ id: 'rename-organization', message: error }] : []} message={failure} />
          <FormField id="rename-organization" label="Organization name" hint="Shown on every record your organization issues." error={error}>
            <TextInput value={name} maxLength={ORGANIZATION_NAME_MAX + 20} onChange={e => { setName(e.target.value); setError(undefined); }} />
          </FormField>
          <div className="org-actions">
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save name'}</Button>
            <Button variant="ghost" disabled={pending} onClick={() => { setEditing(false); setError(undefined); setFailure(undefined); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <dl className="org-facts">
          <div><dt>Name</dt><dd>{organization.displayName}</dd></div>
          <div><dt>Your role</dt><dd>{roleLabels[membership.role]}</dd></div>
          <div><dt>Created</dt><dd>{formatDate(organization.createdAt)}</dd></div>
        </dl>
      )}
      {!isOwner && <p className="org-muted">Only owners can rename the organization or manage members.</p>}
    </section>
  );
}

function ReviewSection() {
  const { organization } = useWorkspace();
  return (
    <section className="org-card" aria-labelledby="org-review-heading">
      <h2 id="org-review-heading">Identity review</h2>
      <p><span className={`review-badge review-${organization.reviewState}`}>{reviewLabels[organization.reviewState]}</span></p>
      <p>{reviewExplanations[organization.reviewState]}</p>
      <p className="org-muted">{REVIEW_IS_NOT_ACCREDITATION} VeriMark confirms who an organization is; it does not assess the quality of what it teaches or certifies.</p>
    </section>
  );
}

function MemberRow({ member, isOwner, isSelf, onChanged, onError }: { member: Member; isOwner: boolean; isSelf: boolean; onChanged(message: string, self: boolean): Promise<void>; onError(message: string): void }) {
  const api = useApi();
  const { organization } = useWorkspace();
  const [role, setRole] = useState<Role>(member.role);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const id = `member-role-${member.userId}`;

  async function run(action: () => Promise<void>, success: string) {
    setPending(true);
    try {
      await action();
      await onChanged(success, isSelf);
    } catch (caught) {
      setRole(member.role);
      onError(errorCode(caught) === 'INVALID_TRANSITION' ? LAST_OWNER : friendlyError(caught));
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <li className="member-row">
      <div className="member-who"><strong>{member.displayName}{isSelf && ' (you)'}</strong><small>Joined {formatDate(member.joinedAt)}</small></div>
      {isOwner ? (
        <div className="member-controls">
          <div className="member-role">
            <label htmlFor={id}>Role for {member.displayName}</label>
            <Select id={id} value={role} disabled={pending} onChange={e => setRole(e.target.value as Role)}>
              {(Object.keys(roleLabels) as Role[]).map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
            </Select>
          </div>
          <Button size="sm" variant="outline" disabled={pending || role === member.role}
            onClick={() => { void run(() => api.setMemberRole(organization.id, member.userId, role), `${member.displayName} is now ${roleLabels[role].toLowerCase()}.`); }}>Save role</Button>
          {confirming ? (
            <span className="member-confirm">
              <Button size="sm" disabled={pending} onClick={() => { void run(() => api.removeMember(organization.id, member.userId), `${member.displayName} was removed.`); }}>Confirm removal</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
            </span>
          ) : <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(true)} aria-label={`Remove ${member.displayName}`}>Remove</Button>}
        </div>
      ) : <span className="member-role-label">{roleLabels[member.role]}</span>}
    </li>
  );
}

function MembersSection() {
  const api = useApi();
  const { organization, membership, user, refresh } = useWorkspace();
  const isOwner = membership.role === 'owner';
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' }>();
  const { state, refresh: load, retry } = useLoad(useCallback(() => api.listMembers(organization.id), [api, organization.id]));

  const onChanged = async (text: string, self: boolean) => {
    setMessage({ text, tone: 'ok' });
    if (self) await refresh();
    else load();
  };

  return (
    <section className="org-card org-wide" aria-labelledby="org-members-heading">
      <div className="org-card-head"><h2 id="org-members-heading">Members</h2></div>
      <p className="org-muted">Owners manage members, invitations and the organization name. Issuers prepare templates and issue, revoke and replace records. Viewers can read.</p>
      <div role="status" className="org-notice">{message?.tone === 'ok' ? message.text : ''}</div>
      {message?.tone === 'error' && <p role="alert" className="field-error">{message.text}</p>}
      {state.status === 'loading' && <LoadingState label="Loading members…" />}
      {state.status === 'error' && <ErrorState title="Members could not be loaded" onRetry={retry}>{friendlyError(state.error)}</ErrorState>}
      {state.status === 'ready' && (state.data.length === 0
        ? <EmptyState title="No members to show" />
        : <ul className="member-list">{state.data.map(member => (
          <MemberRow key={`${member.userId}:${member.role}`} member={member} isOwner={isOwner} isSelf={member.userId === user.id}
            onChanged={onChanged} onError={text => setMessage({ text, tone: 'error' })} />
        ))}</ul>)}
    </section>
  );
}

function CreatedInvitePanel({ invite, onDone }: { invite: CreatedInvite; onDone(): void }) {
  const link = `${window.location.origin}/invite#${invite.token}`;
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopy('copied'); }
    catch { (document.getElementById('invite-link') as HTMLInputElement | null)?.select(); setCopy('failed'); }
  }
  return (
    <div className="invite-created" ref={panel} tabIndex={-1} aria-labelledby="invite-created-heading">
      <h3 id="invite-created-heading">Invitation link for {invite.email}</h3>
      <p className="invite-warning"><strong>Copy this link now. It will not be shown again.</strong> Share it with {invite.email} yourself; VeriMark does not send email. It works once, only for that address, until {formatDate(invite.expiresAt)}.</p>
      <FormField id="invite-link" label="Invitation link">
        <TextInput readOnly value={link} onFocus={e => e.currentTarget.select()} />
      </FormField>
      <div className="org-actions">
        <Button size="sm" onClick={() => { void copyLink(); }}>Copy link</Button>
        <Button size="sm" variant="outline" onClick={onDone}>I have saved the link</Button>
      </div>
      <p role="status" className="org-notice">{copy === 'copied' ? 'Link copied.' : copy === 'failed' ? 'Copying is not available here. The link is selected; copy it manually.' : ''}</p>
    </div>
  );
}

function InvitesSection() {
  const api = useApi();
  const { organization } = useWorkspace();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'issuer' | 'viewer'>('viewer');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<CreatedInvite>();
  const [revoking, setRevoking] = useState<string>();
  const [listMessage, setListMessage] = useState<string>();
  const inFlight = useRef(false);

  const { state, refresh: load, retry } = useLoad(useCallback(() => api.listInvites(organization.id), [api, organization.id]));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const value = email.trim();
    const problem = !value ? 'Enter the email address to invite.' : !isEmailAddress(value) ? 'Enter an email address in the format name@example.com.' : undefined;
    setError(problem);
    setFailure(undefined);
    if (problem) return;
    inFlight.current = true;
    setPending(true);
    try {
      const invite = await api.inviteMember(organization.id, { email: value, role });
      setCreated(invite);
      setEmail('');
      load();
    } catch (caught) {
      const field = fieldErrors(caught).find(f => f.field === 'email');
      if (field) setError(fieldMessage(field.code, 'Email address'));
      else setFailure(friendlyError(caught));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function revoke(invite: Invite) {
    setRevoking(invite.id);
    setListMessage(undefined);
    try {
      await api.revokeInvite(organization.id, invite.id);
      setListMessage(`Invitation for ${invite.email} withdrawn.`);
      load();
    } catch (caught) { setListMessage(friendlyError(caught)); }
    finally { setRevoking(undefined); }
  }

  return (
    <section className="org-card org-wide" aria-labelledby="org-invites-heading">
      <div className="org-card-head"><h2 id="org-invites-heading">Invitations</h2></div>
      <p className="org-muted">Invite someone by email address. You will get a one-time link to share with them; it expires after seven days.</p>
      {created ? <CreatedInvitePanel invite={created} onDone={() => setCreated(undefined)} /> : (
        <form className="invite-form" noValidate onSubmit={submit} aria-busy={pending}>
          <ErrorSummary items={error ? [{ id: 'invite-email', message: error }] : []} message={failure} />
          <div className="invite-fields">
            <FormField id="invite-email" label="Email address" error={error}>
              <TextInput type="email" autoComplete="off" spellCheck={false} value={email} onChange={e => { setEmail(e.target.value); setError(undefined); }} />
            </FormField>
            <FormField id="invite-role" label="Role">
              <Select value={role} onChange={e => setRole(e.target.value as 'issuer' | 'viewer')}>
                <option value="viewer">Viewer</option>
                <option value="issuer">Issuer</option>
              </Select>
            </FormField>
            <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create invitation'}</Button>
          </div>
        </form>
      )}
      <h3 className="invite-list-heading">Pending invitations</h3>
      <p role="status" className="org-notice">{listMessage}</p>
      {state.status === 'loading' && <LoadingState label="Loading invitations…" />}
      {state.status === 'error' && <ErrorState title="Invitations could not be loaded" onRetry={retry}>{friendlyError(state.error)}</ErrorState>}
      {state.status === 'ready' && (state.data.length === 0 ? <p className="org-muted">No pending invitations.</p> : (
        <ul className="member-list">{state.data.map(invite => (
          <li key={invite.id} className="member-row">
            <div className="member-who"><strong>{invite.email}</strong><small>{roleLabels[invite.role]} · expires {formatDate(invite.expiresAt)}</small></div>
            <Button size="sm" variant="ghost" disabled={revoking === invite.id} onClick={() => { void revoke(invite); }} aria-label={`Withdraw invitation for ${invite.email}`}>{revoking === invite.id ? 'Withdrawing…' : 'Withdraw'}</Button>
          </li>
        ))}</ul>
      ))}
    </section>
  );
}

export default function OrganizationPage() {
  const { membership, organization } = useWorkspace();
  return (
    <section className="org-page route-enter">
      <div className="org-heading">
        <p className="eyebrow">ORGANIZATION</p>
        <h1>{organization.displayName}</h1>
        <p>Details, identity review and the people who can work in this organization.</p>
      </div>
      <div className="org-grid">
        <NameSection key={`name:${organization.id}`} />
        <ReviewSection />
        <MembersSection key={`members:${organization.id}`} />
        {membership.role === 'owner' && <InvitesSection key={`invites:${organization.id}`} />}
      </div>
      <p className="org-footer-link"><Link to="/app/onboarding">Create another organization</Link></p>
    </section>
  );
}
