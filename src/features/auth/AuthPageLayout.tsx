import type { ReactNode } from 'react';
import { PublicLayout } from '../../components/layout/Layouts';
import { SectionLabel } from '../../components/ui';
import './auth.css';

export function AuthPageLayout({ label, title, intro, children, aside }: { label: string; title: ReactNode; intro?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <PublicLayout>
      <section className="auth-page experience-container">
        <div className="auth-main route-enter">
          <SectionLabel>{label}</SectionLabel>
          <h1>{title}</h1>
          {intro && <div className="auth-intro">{intro}</div>}
          {children}
        </div>
        {aside && <div className="auth-aside">{aside}</div>}
      </section>
    </PublicLayout>
  );
}
