import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link, Route, Routes, useNavigate } from 'react-router-dom';
import { expect, test } from 'vitest';
import RouteEffects from './RouteEffects';
function History() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Back</button>; }
function Fixture({ path = '/' }: { path?: string }) { return <MemoryRouter initialEntries={[path]}><RouteEffects /><Link to="/workspace">Workspace</Link><History /><Routes><Route path="*" element={<main><h1>Content</h1></main>} /></Routes></MemoryRouter>; }
test.each([['/', 'Achievement, on the record'], ['/workspace', 'Demonstration workspace'], ['/workspace/records', 'Unavailable in M1'], ['/preview/verify', 'Unavailable in M1'], ['/missing', 'Page not found']])('direct route %s updates title and main focus', (path, title) => { render(<Fixture path={path} />); expect(document.title).toBe(title+' | VeriMark'); expect(screen.getByRole('main')).toHaveFocus(); });
test('link navigation and browser history restore title and focus', async () => { const user = userEvent.setup(); render(<Fixture />); await user.click(screen.getByRole('link')); expect(document.title).toContain('Demonstration workspace'); expect(screen.getByRole('main')).toHaveFocus(); await user.click(screen.getByRole('button', { name: 'Back' })); expect(document.title).toContain('Achievement'); expect(screen.getByRole('main')).toHaveFocus(); });
