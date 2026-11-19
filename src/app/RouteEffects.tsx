import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { sectionTitle } from '../features/organizations/ShellContext';

const publicTitles: Record<string, string> = {
  '/sign-in': 'Sign in', '/sign-up': 'Create an account', '/reset-password': 'Reset your password',
  '/update-password': 'Set a new password', '/invite': 'Join an organization', '/verify': 'Verify a credential', '/receive': 'Your credential',
  '/demo': 'Live demo',
};

/** Titles never include URL fragments, so delivery and invitation secrets cannot leak into history or tab titles. */
function titleFor(path: string) {
  if (path === '/') return 'Achievement, on the record | VeriMark';
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (publicTitles[normalized]) return `${publicTitles[normalized]} | VeriMark`;
  if (/^\/verify\/[^/]+$/.test(normalized)) return 'Verification result | VeriMark';
  if (normalized === '/app' || normalized.startsWith('/app/')) {
    const section = sectionTitle(normalized);
    if (section !== 'Workspace' || normalized === '/app') return `${section} | VeriMark workspace`;
  }
  return 'Page not found | VeriMark';
}

/** Measure the current header, not a guessed breakpoint or announcement offset. */
function sectionTop(target: HTMLElement) {
  const header = document.querySelector<HTMLElement>('.public-header');
  const headerHeight = header?.getBoundingClientRect().height ?? 0;
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--section-scroll-gap')) || 16;
  return Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerHeight - gap);
}

export default function RouteEffects() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const previous = useRef<typeof location | null>(null);
  const activeSection = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const original = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = original; };
  }, []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => {
      const target = activeSection.current;
      activeSection.current = null;
      if (target?.isConnected) window.scrollTo({ top: sectionTop(target), behavior: 'instant' });
    };
    const reduce = () => { if (preference.matches) finish(); };
    const clear = () => { activeSection.current = null; };
    preference.addEventListener('change', reduce);
    document.addEventListener('scrollend', clear);
    // Native wheel, touch and keyboard scrolling remain browser-controlled.
    window.addEventListener('wheel', clear, { passive: true });
    window.addEventListener('touchstart', clear, { passive: true });
    window.addEventListener('pointerdown', clear, { passive: true });
    window.addEventListener('keydown', clear);
    window.addEventListener('resize', finish);
    return () => {
      preference.removeEventListener('change', reduce);
      document.removeEventListener('scrollend', clear);
      window.removeEventListener('wheel', clear);
      window.removeEventListener('touchstart', clear);
      window.removeEventListener('pointerdown', clear);
      window.removeEventListener('keydown', clear);
      window.removeEventListener('resize', finish);
    };
  }, []);

  useLayoutEffect(() => {
    activeSection.current = null;
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
    // Only an explicit same-page section link opts into native smooth scrolling.
    // Route arrivals, initial hashes and POP restoration remain immediate.
    const saved = positions.current.get(location.key);
    if (navigationType === 'POP' && saved !== undefined) {
      window.scrollTo({ top: saved, behavior: 'instant' });
    } else if (location.hash) {
      let id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* Treat malformed fragments as literal IDs. */ }
      const target = document.getElementById(id);
      if (target) {
        const sectionIntent = (location.state as { sectionScroll?: boolean } | null)?.sectionScroll === true;
        const smooth = samePage && navigationType !== 'POP' && sectionIntent &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (sectionIntent || target.hasAttribute('data-section-target')) {
          if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
        if (smooth) activeSection.current = target;
        window.scrollTo({ top: sectionTop(target), behavior: smooth ? 'smooth' : 'instant' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    const save = () => { positions.current.set(location.key, window.scrollY); };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [location, navigationType]);
  return null;
}
