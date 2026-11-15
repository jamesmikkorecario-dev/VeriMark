import { ButtonLink, SectionLabel } from '../components/ui';
import { PublicLayout } from '../components/layout/Layouts';
import './pages.css';
export default function NotFoundPage() { return <PublicLayout><section className="deferred-page experience-container"><SectionLabel>404 / NOT FOUND</SectionLabel><h1>This page isn’t<br /><em>on the record.</em></h1><p>The requested page does not exist.</p><ButtonLink to="/">Return home</ButtonLink></section></PublicLayout>; }
