import { type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Brand, ButtonLink, Icon } from '../ui';
import { PublicNavigation, WorkspaceDrawer } from './Navigation';
import { useEnvironment } from './environment';

const publicLinks = (
  <>
    <Link to="/#method" state={{ sectionScroll: true }}>How it works</Link>
    <Link to="/verify">Verify a record</Link>
    <Link to="/preview/about">About</Link>
    <Link to="/workspace">Demo workspace</Link>
    <Link to="/sign-in">Sign in</Link>
  </>
);

export function PublicLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const demo = useEnvironment() === 'demo';
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      {demo && <div className="demo-ribbon">DEMONSTRATION / FICTIONAL DATA · NOTHING HERE IS REAL</div>}
      <header className="public-header">
        <div className="experience-container header-row">
          <Brand />
          <nav className="nav-desktop" aria-label="Main navigation">{publicLinks}</nav>
          <div className="header-end">
            <ButtonLink className="desktop-action" to="/verify" size="sm">
              Verify credential <Icon name="arrow" />
            </ButtonLink>
            <div className="mobile-navigation">
              <PublicNavigation key={location.key}>
                <nav aria-label="Mobile navigation">{publicLinks}</nav>
              </PublicNavigation>
            </div>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="public-footer">
        <div className="experience-container">
          <div className="footer-top">
            <div><Brand inverse /><p>Meaningful achievements deserve<br />records people can understand.</p></div>
            <nav aria-label="Footer navigation">{publicLinks}</nav>
          </div>
          <div className="footer-bottom">
            <span>© 2026 VeriMark{demo ? ' · Demonstration' : ''}</span>
            <span>{demo ? 'Fictional data. Nothing here is a real record.' : 'Review is an identity check, not accreditation.'}</span>
          </div>
        </div>
      </footer>
    </>
  );
}

const workspaceItems = [
  ['', 'Overview', 'grid'],
  ['records', 'Credentials', 'records'],
  ['issue', 'Issue credential', 'plus'],
  ['templates', 'Templates', 'template'],
  ['activity', 'Activity', 'activity'],
  ['settings', 'Organization', 'settings'],
] as const;

function WorkspaceNavigation() {
  return (
    <nav className="side-nav" aria-label="Workspace">
      {workspaceItems.map(([path, label, icon]) => (
        <NavLink end key={path} to={`/workspace${path ? `/${path}` : ''}`}>
          <Icon name={icon} /><span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function WorkspaceIdentity() {
  return (
    <>
      <div className="sidebar-top"><Brand inverse /><p>ISSUER WORKSPACE / DEMO</p></div>
      <div className="organization-context">
        <span>F</span>
        <div><strong>Fieldwork Collective</strong><small>Fictional organization workspace</small></div>
      </div>
      <WorkspaceNavigation />
      <div className="sidebar-footer">
        <strong>Mika Chen</strong><span>Fictional administrator</span>
        <Link to="/">Public website <Icon name="arrow" /></Link>
      </div>
    </>
  );
}

export function IssuerWorkspaceLayout({ children, section = 'Overview' }: { children: ReactNode; section?: string }) {
  const location = useLocation();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar"><WorkspaceIdentity /></aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <div className="workspace-mobile-brand"><Brand /></div>
          <div className="mobile-navigation">
            <WorkspaceDrawer key={location.key}><WorkspaceIdentity /></WorkspaceDrawer>
          </div>
          <div className="workspace-breadcrumb"><span>FIELDWORK COLLECTIVE / </span><strong>{section}</strong></div>
          <span className="demo-bubble">DEMO ENVIRONMENT</span>
        </header>
        <main id="main" tabIndex={-1} className="workspace-main">{children}</main>
        <footer className="workspace-footer">
          <span>VeriMark / Issuer preview</span><span>Fictional data · No real records created</span>
        </footer>
      </div>
    </div>
  );
}
