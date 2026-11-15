import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/api/context';
import type { Membership, Organization } from '../../lib/api/types';
import { Brand, ErrorState, Icon, LoadingState, Select } from '../../components/ui';
import { WorkspaceDrawer } from '../../components/layout/Navigation';
import { WorkspaceContext, type Workspace } from './WorkspaceContext';
import { AppShellContext, reviewExplanations, reviewLabels, roleLabels, sectionTitle, type AppShell } from './ShellContext';
import { useAuth } from '../auth/AuthContext';
import { errorCode } from '../auth/errors';
import { readActiveOrganization, writeActiveOrganization } from '../auth/session';
import '../../pages/pages.css';
import './organizations.css';

type Ready = { status: 'ready'; memberships: Membership[]; isAdmin: boolean; membership: Membership | null; organization: Organization | null };
type ShellState = { status: 'loading' } | { status: 'error' } | Ready;
type NavItem = { to: string; label: string; icon: Parameters<typeof Icon>[0]['name']; end?: boolean };

function navigationItems(state: Ready): NavItem[] {
  const items: NavItem[] = [];
  if (state.membership) {
    items.push({ to: '/app', label: 'Overview', icon: 'grid', end: true }, { to: '/app/credentials', label: 'Credentials', icon: 'records' });
    if (state.membership.role !== 'viewer') items.push({ to: '/app/issue', label: 'Issue credentials', icon: 'plus' });
    items.push({ to: '/app/templates', label: 'Templates', icon: 'template' }, { to: '/app/activity', label: 'Activity', icon: 'activity' }, { to: '/app/organization', label: 'Organization', icon: 'settings' });
  } else {
    items.push({ to: '/app/onboarding', label: 'Create organization', icon: 'plus' });
  }
  if (state.isAdmin) items.push({ to: '/app/review', label: 'Platform review', icon: 'check' });
  return items;
}

function Identity({ state, idPrefix, demo, onSwitch, onSignOut, signingOut }: {
  state: Ready; idPrefix: string; demo: boolean; onSwitch(id: string): void; onSignOut(): void; signingOut: boolean;
}) {
  const auth = useAuth();
  const { membership, organization } = state;
  return (
    <>
      <div className="sidebar-top"><Brand inverse /><p>ISSUER WORKSPACE{demo ? ' / DEMO' : ''}</p></div>
      {membership && organization ? (
        <div className="organization-context app-organization">
          <span aria-hidden="true">{organization.displayName.trim().charAt(0).toUpperCase() || 'O'}</span>
          <div>
            <strong>{organization.displayName}</strong>
            <small>{roleLabels[membership.role]} · <span className={`review-badge review-${organization.reviewState}`}>{reviewLabels[organization.reviewState]}</span></small>
          </div>
        </div>
      ) : <div className="organization-context app-organization"><div><strong>No organization yet</strong><small>Create one to start</small></div></div>}
      {state.memberships.length > 1 && membership && (
        <div className="org-switcher">
          <label htmlFor={`${idPrefix}-organization`}>Switch organization</label>
          <Select id={`${idPrefix}-organization`} value={membership.organizationId} onChange={event => onSwitch(event.target.value)}>
            {state.memberships.map(m => <option key={m.organizationId} value={m.organizationId}>{m.organizationName}</option>)}
          </Select>
        </div>
      )}
      <nav className="side-nav" aria-label="Workspace">
        {navigationItems(state).map(item => (
          <NavLink key={item.to} end={item.end} to={item.to}><Icon name={item.icon} /><span>{item.label}</span></NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <strong>{auth.user?.displayName}</strong><span className="app-user-email">{auth.user?.email}</span>
        <button type="button" className="app-sign-out" onClick={onSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
        <Link to="/">Public website <Icon name="arrow" /></Link>
      </div>
    </>
  );
}

/** Authenticated /app shell: sidebar, mobile drawer, header and WorkspaceContext, driven by real account data. */
export default function AppLayout() {
  const api = useApi();
  const auth = useAuth();
  const user = auth.user!;
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<ShellState>({ status: 'loading' });
  const [switching, setSwitching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const ready = state.status === 'ready';
  const mainRef = useRef<HTMLElement>(null);
  const demo = api.mode === 'demo';

  const fetchShell = useCallback(async (preferred?: string): Promise<Ready> => {
    const [memberships, isAdmin] = await Promise.all([api.listMemberships(), api.isPlatformAdmin()]);
    const wanted = preferred ?? readActiveOrganization(user.id);
    const membership = memberships.find(m => m.organizationId === wanted) ?? memberships[0] ?? null;
    const organization = membership ? await api.getOrganization(membership.organizationId) : null;
    if (membership) writeActiveOrganization(user.id, membership.organizationId);
    return { status: 'ready', memberships, isAdmin, membership, organization };
  }, [api, user.id]);
  const load = useCallback(async (preferred?: string) => { setState(await fetchShell(preferred)); }, [fetchShell]);

  const refreshAuth = auth.refresh;
  const handleFailure = useCallback((error: unknown) => {
    if (errorCode(error) === 'UNAUTHENTICATED') void refreshAuth();
    else setState(current => (current.status === 'ready' ? current : { status: 'error' }));
  }, [refreshAuth]);

  useEffect(() => {
    let active = true;
    fetchShell().then(next => { if (active) setState(next); }, error => { if (active) handleFailure(error); });
    return () => { active = false; };
  }, [fetchShell, handleFailure]);

  // The shell replaces the loading view's <main>; keep focus where route changes put it.
  useEffect(() => {
    if (ready && (document.activeElement === document.body || document.activeElement === null)) mainRef.current?.focus({ preventScroll: true });
  }, [ready]);

  const reload = useCallback(async (organizationId?: string) => {
    try { await load(organizationId); } catch (error) { handleFailure(error); throw error; }
  }, [load, handleFailure]);

  const selectOrganization = useCallback((organizationId: string) => {
    writeActiveOrganization(user.id, organizationId);
    setSwitching(true);
    navigate('/app');
    load(organizationId).catch(handleFailure).finally(() => setSwitching(false));
  }, [user.id, navigate, load, handleFailure]);

  const shell = useMemo<AppShell | null>(() => (state.status === 'ready'
    ? { memberships: state.memberships, isPlatformAdmin: state.isAdmin, selectOrganization, reload } : null), [state, selectOrganization, reload]);

  const workspace = useMemo<Workspace | null>(() => (state.status === 'ready' && state.membership && state.organization ? {
    user, membership: state.membership, organization: state.organization,
    canIssue: state.membership.role === 'owner' || state.membership.role === 'issuer',
    refresh: () => reload(state.membership!.organizationId),
  } : null), [state, user, reload]);

  async function signOut() {
    setSigningOut(true);
    setSignOutFailed(false);
    try { await auth.signOut(); } catch { setSignOutFailed(true); setSigningOut(false); }
  }

  if (state.status === 'loading') {
    return <main id="main" tabIndex={-1} className="auth-gate"><h1 className="sr-only">Loading your workspace</h1><LoadingState label="Loading your workspace…" /></main>;
  }
  if (state.status === 'error') {
    return (
      <main id="main" tabIndex={-1} className="auth-gate">
        <h1 className="sr-only">Workspace unavailable</h1>
        <ErrorState title="We could not load your workspace" onRetry={() => { setState({ status: 'loading' }); load().catch(handleFailure); }}>Check your connection and try again.</ErrorState>
      </main>
    );
  }

  const path = location.pathname;
  const allowedWithoutOrganization = path.startsWith('/app/onboarding') || (path.startsWith('/app/review') && state.isAdmin);
  if (!state.membership && !allowedWithoutOrganization) return <Navigate to="/app/onboarding" replace />;

  const section = sectionTitle(path);
  const organization = state.organization;
  const identity = (prefix: string) => <Identity state={state} idPrefix={prefix} demo={demo} onSwitch={selectOrganization} onSignOut={() => { void signOut(); }} signingOut={signingOut} />;

  return (
    <AppShellContext.Provider value={shell}>
      <div className="app-shell app-workspace">
        <a className="skip-link" href="#main">Skip to content</a>
        <aside className="sidebar">{identity('sidebar')}</aside>
        <div className="workspace-body">
          {demo && <div className="demo-ribbon app-demo-ribbon">DEMONSTRATION — FICTIONAL DATA · NOTHING HERE IS REAL</div>}
          <header className="workspace-header">
            <div className="workspace-mobile-brand"><Brand /></div>
            <div className="mobile-navigation">
              <WorkspaceDrawer key={location.key}>{identity('drawer')}</WorkspaceDrawer>
            </div>
            <div className="workspace-breadcrumb">{organization && <span>{organization.displayName} / </span>}<strong>{section}</strong></div>
            {demo && <span className="demo-bubble">DEMONSTRATION — FICTIONAL DATA</span>}
          </header>
          <main id="main" ref={mainRef} tabIndex={-1} className="workspace-main app-main">
            {signOutFailed && <ErrorState title="Sign-out did not complete" onRetry={() => { void signOut(); }}>Please try again.</ErrorState>}
            {organization && organization.reviewState !== 'reviewed' && !path.startsWith('/app/review') && (
              <p className={`review-banner review-banner-${organization.reviewState}`}>
                <strong>{organization.displayName}: {reviewLabels[organization.reviewState].toLowerCase()}.</strong> {reviewExplanations[organization.reviewState]}
              </p>
            )}
            {switching ? <LoadingState label="Switching organization…" /> : workspace ? (
              <WorkspaceContext.Provider value={workspace}><Outlet /></WorkspaceContext.Provider>
            ) : <Outlet />}
          </main>
          <footer className="workspace-footer">
            <span>VeriMark / Issuer workspace</span>
            <span>{demo ? 'Demonstration — fictional data. Nothing is sent or stored on a server.' : 'Review is an identity check, not accreditation.'}</span>
          </footer>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}
