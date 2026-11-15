import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

function titleFor(path: string) {
  if (path === '/') return 'Achievement, on the record | VeriMark';
  if (path === '/workspace') return 'Demonstration workspace | VeriMark';
  if (/^\/(workspace|preview)\/[^/]+$/.test(path)) return 'Unavailable in M1 | VeriMark';
  return 'Page not found | VeriMark';
}

export default function RouteEffects() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const previous = useRef<typeof location | null>(null);

  useEffect(() => {
    const original = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = original; };
  }, []);

  useLayoutEffect(() => {
    document.title = titleFor(location.pathname);
    const samePage = previous.current?.pathname === location.pathname && previous.current?.search === location.search;
    previous.current = location;
    if (!samePage) {
      const main = document.querySelector<HTMLElement>('main');
      if (main) {
        if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
        main.focus({ preventScroll: true });
      }
    }
    // POP restores the saved entry; PUSH/REPLACE starts at its hash or the top.
    const saved = positions.current.get(location.key);
    if (navigationType === 'POP' && saved !== undefined) {
      window.scrollTo({ top: saved, behavior: 'instant' });
    } else if (location.hash) {
      let id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* Treat malformed fragments as literal IDs. */ }
      document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    const save = () => { positions.current.set(location.key, window.scrollY); };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [location, navigationType]);
  return null;
}
