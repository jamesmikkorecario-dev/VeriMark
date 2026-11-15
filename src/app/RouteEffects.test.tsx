import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import RouteEffects from './RouteEffects';
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); vi.stubGlobal('scrollY', 0); Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }); });
function History() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Back</button>; }
function Fixture({ path = '/' }: { path?: string }) { return <MemoryRouter initialEntries={[path]}><RouteEffects /><Link to="/workspace">Workspace</Link><Link to="/#details">Details</Link><History /><Routes><Route path="*" element={<main><h1>Content</h1><section id="details">Details target</section></main>} /></Routes></MemoryRouter>; }
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
  expect(document.getElementById('details')!.scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant' });
});
