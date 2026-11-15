import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PromotionalReveals } from './PromotionalReveals';

afterEach(() => vi.unstubAllGlobals());
function environment(reduced = false) {
  const preference = new EventTarget();
  Object.assign(preference, { matches: reduced });
  vi.stubGlobal('matchMedia', () => preference);
  let notify: IntersectionObserverCallback;
  const disconnect = vi.fn();
  const unobserve = vi.fn();
  const observe = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe = observe;
    unobserve = unobserve;
    disconnect = disconnect;
  });
  return { preference, disconnect, unobserve, observe,
    intersect: (target: Element) => act(() => notify([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)) };
}
const content = <article data-reveal="">Promotional copy</article>;
it('reveals once and does not reset on rerender, then cleans up', () => {
  const env = environment();
  const view = render(<StrictMode><PromotionalReveals>{content}</PromotionalReveals></StrictMode>);
  const target = screen.getByText('Promotional copy');
  expect(target).toHaveAttribute('data-reveal-state', 'pending');
  env.intersect(target);
  expect(target).toHaveAttribute('data-reveal-state', 'complete');
  expect(env.unobserve).toHaveBeenCalledWith(target);
  view.rerender(<StrictMode><PromotionalReveals>{content}</PromotionalReveals></StrictMode>);
  expect(target).toHaveAttribute('data-reveal-state', 'complete');
  view.unmount();
  expect(env.disconnect).toHaveBeenCalled();
});
it('completes pending content on live reduction without replay when disabled', () => {
  const env = environment();
  const view = render(<PromotionalReveals>{content}</PromotionalReveals>);
  act(() => { Object.assign(env.preference, { matches: true }); env.preference.dispatchEvent(new Event('change')); });
  expect(screen.getByText('Promotional copy')).toHaveAttribute('data-reveal-state', 'complete');
  act(() => { Object.assign(env.preference, { matches: false }); env.preference.dispatchEvent(new Event('change')); });
  expect(screen.getByText('Promotional copy')).toHaveAttribute('data-reveal-state', 'complete');
  const remove = vi.spyOn(env.preference, 'removeEventListener');
  view.unmount();
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
});
it.each([true, false])('keeps content available without enhancement (reduced=%s)', reduced => {
  const env = environment(reduced);
  if (!reduced) vi.stubGlobal('IntersectionObserver', undefined);
  render(<PromotionalReveals>{content}</PromotionalReveals>);
  expect(screen.getByText('Promotional copy')).toHaveAttribute('data-reveal-state', 'complete');
  expect(env.observe).not.toHaveBeenCalled();
});
it('rearms only on a deliberate new mount', () => {
  const env = environment();
  const first = render(<PromotionalReveals>{content}</PromotionalReveals>);
  env.intersect(screen.getByText('Promotional copy'));
  first.unmount();
  render(<PromotionalReveals>{content}</PromotionalReveals>);
  expect(screen.getByText('Promotional copy')).toHaveAttribute('data-reveal-state', 'pending');
});
