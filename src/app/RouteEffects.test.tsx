import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import RouteEffects from './RouteEffects';
let preference: EventTarget & { matches: boolean };
beforeEach(() => { preference = Object.assign(new EventTarget(), { matches: false }); vi.stubGlobal('matchMedia', () => preference); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); vi.stubGlobal('scrollY', 0); Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function History() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Back</button>; }
function Fixture({ path = '/' }: { path?: string }) { return <MemoryRouter initialEntries={[path]}><RouteEffects /><Link to="/workspace">Workspace</Link><Link to="/#details">Details</Link><Link to="/#details" state={{ sectionScroll: true }}>Section link</Link><header className="public-header" /><History /><Routes><Route path="*" element={<main><h1>Content</h1><section id="details">Details target</section></main>} /></Routes></MemoryRouter>; }
test.each([['/', 'Achievement, on the record'], ['/workspace', 'Demonstration workspace'], ['/workspace/records', 'Unavailable in M1'], ['/preview/verify', 'Unavailable in M1'], ['/missing', 'Page not found']])('direct route %s updates title and main focus', (path, title) => { render(<Fixture path={path} />); expect(document.title).toBe(title+' | VeriMark'); expect(screen.getByRole('main')).toHaveFocus(); });
test('link navigation and browser history restore title and focus', async () => { const user = userEvent.setup(); render(<Fixture />); await user.click(screen.getByRole('link', { name: 'Workspace' })); expect(document.title).toContain('Demonstration workspace'); expect(screen.getByRole('main')).toHaveFocus(); await user.click(screen.getByRole('button', { name: 'Back' })); expect(document.title).toContain('Achievement'); expect(screen.getByRole('main')).toHaveFocus(); });

test('new route resets scroll and POP restores the previous entry', async () => {
  const user = userEvent.setup(); render(<Fixture />);
  vi.stubGlobal('scrollY', 1800); fireEvent.scroll(window);
  await user.click(screen.getByRole('link', { name: 'Workspace' }));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 1800, behavior: 'instant' });
});
test('same-page hash scrolls to target without moving focus to main', async () => {
  const user = userEvent.setup(); render(<Fixture />);
  const details = screen.getByRole('link', { name: 'Details' });
  await user.click(details);
  expect(details).toHaveFocus();
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
});

function mockGeometry() {
  vi.spyOn(document.querySelector('.public-header')!, 'getBoundingClientRect').mockReturnValue({ height: 80 } as DOMRect);
  vi.spyOn(document.getElementById('details')!, 'getBoundingClientRect').mockReturnValue({ top: 500 } as DOMRect);
}

test.each([false, true])('explicit same-page anchor measures sticky offset and honors reduction=%s', async reduced => {
  preference.matches = reduced;
  const user = userEvent.setup(); render(<Fixture />); mockGeometry();
  await user.click(screen.getByRole('link', { name: 'Section link' }));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 404, behavior: reduced ? 'instant' : 'smooth' });
  expect(document.getElementById('details')).toHaveFocus();
});

test('cross-route section arrival never smooth-scrolls', async () => {
  const user = userEvent.setup(); render(<Fixture path="/workspace" />); mockGeometry();
  await user.click(screen.getByRole('link', { name: 'Section link' }));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 404, behavior: 'instant' });
  expect(document.getElementById('details')).toHaveFocus();
});

test('live reduction finishes only the active section scroll immediately', async () => {
  const user = userEvent.setup(); render(<Fixture />); mockGeometry();
  await user.click(screen.getByRole('link', { name: 'Section link' }));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 404, behavior: 'smooth' });
  preference.matches = true; preference.dispatchEvent(new Event('change'));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 404, behavior: 'instant' });
});

test.each(['wheel', 'scrollend'])('manual input or completed scroll clears intent (%s)', async event => {
  const user = userEvent.setup(); render(<Fixture />); mockGeometry();
  await user.click(screen.getByRole('link', { name: 'Section link' }));
  if (event === 'wheel') fireEvent.wheel(window);
  else fireEvent(document, new Event('scrollend'));
  vi.mocked(window.scrollTo).mockClear();
  preference.matches = true; preference.dispatchEvent(new Event('change'));
  expect(window.scrollTo).not.toHaveBeenCalled();
});
