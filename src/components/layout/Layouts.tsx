import { useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Brand, Button, ButtonLink, Icon } from '../ui';

export function NavigationDisclosure({ id, label, children }: { id: string; label: string; children: ReactNode }) {
 const [open, setOpen] = useState(false);
 const trigger = useRef<HTMLButtonElement>(null);
 return <div className="navigation-disclosure" onKeyDown={event => { if (event.key === 'Escape' && open) { setOpen(false); trigger.current?.focus(); } }}>
  <Button aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} onFocus={event => { trigger.current = event.currentTarget; }}><Icon name={open ? 'close' : 'menu'} />{label}</Button>
  {open && <div id={id} className="disclosure-links" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>{children}</div>}
 </div>;
}
const publicLinks = <><Link to="/preview/how">How it works</Link><Link to="/preview/verify">Verify a record</Link><Link to="/preview/about">About</Link><Link to="/workspace">Demo workspace</Link></>;
export function PublicLayout({ children }: { children: ReactNode }) {
 return <><a className="skip-link" href="#main">Skip to content</a><div className="demo-ribbon">M1 PREVIEW / FICTIONAL DATA · NO LIVE VERIFICATION</div><header className="public-header"><div className="experience-container header-row"><Brand /><nav className="nav-desktop" aria-label="Main navigation">{publicLinks}</nav><div className="header-end"><ButtonLink className="desktop-action" to="/preview/verify" size="sm">Verify credential <Icon name="arrow" /></ButtonLink><div className="mobile-navigation"><NavigationDisclosure id="public-navigation" label="Menu"><nav aria-label="Mobile navigation">{publicLinks}</nav></NavigationDisclosure></div></div></div></header><main id="main" tabIndex={-1}>{children}</main><footer className="public-footer"><div className="experience-container"><div className="footer-top"><div><Brand inverse /><p>Meaningful achievements deserve<br />records people can understand.</p></div><nav aria-label="Footer navigation">{publicLinks}<Link to="/preview/recipient">Recipient view</Link></nav></div><div className="footer-bottom"><span>© 2026 VeriMark · M1 preview</span><span>Fictional data. No live credential verification.</span></div></div></footer></>;
}
const workspaceItems = [['','Overview','grid'],['records','Credentials','records'],['issue','Issue credential','plus'],['templates','Templates','template'],['activity','Activity','activity'],['settings','Organization','settings']] as const;
function WorkspaceNavigation() { return <nav className="side-nav" aria-label="Workspace">{workspaceItems.map(([path,label,icon]) => <NavLink end key={path} to={`/workspace${path ? `/${path}` : ''}`}><Icon name={icon} />{label}</NavLink>)}</nav>; }
export function IssuerWorkspaceLayout({ children, section = 'Overview' }: { children: ReactNode; section?: string }) {
 return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar"><div className="sidebar-top"><Brand inverse /><p>ISSUER WORKSPACE / DEMO</p></div><div className="organization-context"><span>F</span><div><strong>Fieldwork Collective</strong><small>Fictional organization workspace</small></div></div><WorkspaceNavigation /><div className="sidebar-footer"><strong>Mika Chen</strong><span>Fictional administrator</span><Link to="/">Public website <Icon name="arrow" /></Link></div></aside><div className="workspace-body"><header className="workspace-header"><div className="mobile-navigation"><NavigationDisclosure id="workspace-navigation" label="Workspace menu"><WorkspaceNavigation /><Link to="/">Public website</Link></NavigationDisclosure></div><div className="workspace-breadcrumb"><span>FIELDWORK COLLECTIVE / </span><strong>{section}</strong></div><span className="demo-bubble">DEMO ENVIRONMENT</span></header><main id="main" tabIndex={-1} className="workspace-main">{children}</main><footer className="workspace-footer"><span>VeriMark / Issuer preview</span><span>Fictional data · No real records created</span></footer></div></div>;
}

