import { ButtonLink, EmptyState } from '../../components/ui';

/** Unknown /app paths render inside the workspace shell instead of a second public layout. */
export default function AppNotFound() {
  return (
    <section className="org-page">
      <div className="org-heading"><p className="eyebrow">404 / NOT FOUND</p><h1>This page isn’t in your workspace</h1></div>
      <EmptyState title="Nothing here" action={<ButtonLink to="/app">Return to overview</ButtonLink>}>Check the address, or use the navigation to find what you need.</EmptyState>
    </section>
  );
}
