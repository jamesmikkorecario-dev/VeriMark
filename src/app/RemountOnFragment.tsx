import { Fragment, useEffect, useState, type ReactNode } from 'react';

/**
 * Pages that take a secret from the URL fragment read it once when they mount. Opening a second such link in the same
 * tab changes only the fragment, which does not reload the page; without this the new secret would be ignored and left
 * visible in the address bar. Remounting the page makes it read and remove the new fragment like a first visit.
 */
export default function RemountOnFragment({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const onHashChange = () => { if (window.location.hash.length > 1) setGeneration(n => n + 1); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return <Fragment key={generation}>{children}</Fragment>;
}
