import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brand, ButtonLink, Icon } from '../ui';
import { PublicNavigation } from './Navigation';
import { useEnvironment } from './environment';

/** The interactive demo exists only on the local demonstration adapter; with a real backend there is nothing to open. */
function PublicLinks({ demo }: { demo: boolean }) {
  return (
    <>
      <Link to="/#method" state={{ sectionScroll: true }}>How it works</Link>
      <Link to="/verify">Verify</Link>
      {demo && <Link to="/demo">Live demo</Link>}
      <Link to="/sign-in">Sign in</Link>
    </>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const demo = useEnvironment() === 'demo';
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      {demo && <div className="demo-ribbon" role="region" aria-label="Demonstration">DEMONSTRATION / FICTIONAL DATA · NOTHING HERE IS REAL</div>}
      <header className="public-header">
        <div className="experience-container header-row">
          <Brand />
          <nav className="nav-desktop" aria-label="Main navigation"><PublicLinks demo={demo} /></nav>
          <div className="header-end">
            <ButtonLink className="desktop-action" to="/verify" size="sm">
              Verify a record <Icon name="arrow" />
            </ButtonLink>
            <div className="mobile-navigation">
              <PublicNavigation key={location.key}>
                <nav aria-label="Mobile navigation"><PublicLinks demo={demo} /></nav>
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
            <nav aria-label="Footer navigation"><PublicLinks demo={demo} /></nav>
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
