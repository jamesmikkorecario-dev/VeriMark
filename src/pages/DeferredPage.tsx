import { useLocation, useParams } from 'react-router-dom';
import { ButtonLink, SectionLabel } from '../components/ui';
import { IssuerWorkspaceLayout, PublicLayout } from '../components/layout/Layouts';
import './pages.css';
export default function DeferredPage() {
 const {section}=useParams(); const location=useLocation(); const workspace=location.pathname.startsWith('/workspace/');
 const title=(section || 'Feature').replace(/[-_]/g,' ');
 const content=<section className="deferred-page experience-container"><SectionLabel>M1 / FEATURE PREVIEW</SectionLabel><h1>{title}</h1><p>This feature is unavailable in M1. This preview does not authenticate, issue, retrieve or verify credentials, and no data is saved.</p><p>Only the landing page and fictional issuer overview are implemented.</p><div className="hero-actions"><ButtonLink to={workspace?'/workspace':'/'}>Return to {workspace?'overview':'home'}</ButtonLink><ButtonLink variant="outline" to={workspace?'/':'/workspace'}>{workspace?'Public website':'Demo workspace'}</ButtonLink></div></section>;
 return workspace?<IssuerWorkspaceLayout section={title}>{content}</IssuerWorkspaceLayout>:<PublicLayout>{content}</PublicLayout>;
}
