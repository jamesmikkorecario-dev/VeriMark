import { useEffect, useRef, type ReactNode } from 'react';

/** Enhancement only: copy remains readable before setup and without observers. */
export function PromotionalReveals({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const targets = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-reveal]') ?? []);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || typeof IntersectionObserver === 'undefined') {
      targets.forEach(target => { target.dataset.revealState = 'complete'; });
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).dataset.revealState = 'complete';
        observer?.unobserve(entry.target);
      });
    }, { threshold: 0.05 });
    targets.forEach(target => {
      target.dataset.revealState = 'pending';
      observer?.observe(target);
    });
    const finish = () => {
      observer.disconnect();
      targets.forEach(target => { target.dataset.revealState = 'complete'; });
    };
    // Finish this mount on reduction; disabling reduction must not replay it.
    const onPreferenceChange = () => { if (preference.matches) finish(); };
    preference.addEventListener('change', onPreferenceChange);
    return () => {
      observer?.disconnect();
      preference.removeEventListener('change', onPreferenceChange);
      targets.forEach(target => { delete target.dataset.revealState; });
    };
  }, []);
  return <div ref={root} className="promotional-reveals">{children}</div>;
}
