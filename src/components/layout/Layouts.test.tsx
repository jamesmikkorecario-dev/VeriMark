import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IssuerWorkspaceLayout, PublicLayout } from './Layouts';

let desktop: EventTarget & { matches: boolean; addListener: () => void; removeListener: () => void };
beforeEach(() => {
  desktop = Object.assign(new EventTarget(), { matches: false, addListener() {}, removeListener() {} });
  vi.stubGlobal('matchMedia', () => desktop);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // jsdom does not implement the browser top layer; containment is browser-tested.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function NavigateAway() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/workspace/records')}>Change route</button>;
}

describe('public anchored navigation', () => {
  it('maintains a valid controlled element, exposes links, and restores focus with Escape', () => {
    render(<MemoryRouter><PublicLayout><p>Page</p></PublicLayout></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)).toHaveAttribute('hidden');
    fireEvent.click(trigger);
    const panel = document.getElementById('public-navigation')!;
    expect(within(panel).getByRole('link', { name: 'How it works' })).toHaveFocus();
    within(panel).getByRole('link', { name: 'About' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel).toHaveAttribute('hidden');
    expect(trigger).toHaveFocus();
  });

  it('dismisses on outside pointer, desktop transition and destination', () => {
    render(<MemoryRouter><PublicLayout><button>Outside</button></PublicLayout></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    desktop.matches = true;
    act(() => { desktop.dispatchEvent(new Event('change')); });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.click(within(document.getElementById('public-navigation')!).getByRole('link', { name: 'About' }));
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('workspace modal lifecycle', () => {
  it('focuses close, locks scroll, and restores prior inline styles and scroll on Escape', () => {
    document.body.style.overflow = 'clip';
    document.body.style.top = '2px';
    render(<MemoryRouter initialEntries={['/workspace']}><IssuerWorkspaceLayout><p>Page</p></IssuerWorkspaceLayout></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Open workspace navigation' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Workspace navigation' });
    expect(within(dialog).getByRole('button', { name: 'Close workspace navigation' })).toHaveFocus();
    expect(document.body.style.position).toBe('fixed');
    const last = within(dialog).getByRole('link', { name: 'Public website' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: 'Close workspace navigation' })).toHaveFocus();
    expect(within(dialog).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog).not.toHaveAttribute('open');
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.top).toBe('2px');
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
    document.body.removeAttribute('style');
  });

  it.each([
    'padding-right:3px;overflow-x:clip;--unrelated: keep-me;',
    'padding: 1px 3px !important; overflow-x: clip !important; overflow-y: scroll; position: relative !important; color: red;',
  ])('restores the same inline declarations including overflow longhands and priorities: %s', style => {
    document.body.setAttribute('style', style);
    render(<MemoryRouter initialEntries={['/workspace']}><IssuerWorkspaceLayout><p>Page</p></IssuerWorkspaceLayout></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open workspace navigation' }));
    expect(document.body.style.position).toBe('fixed');
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    // Restored through CSSOM (CSP-safe), so compare declarations as the browser serializes them, not the source text.
    const reference = document.createElement('div');
    reference.style.cssText = style;
    expect(document.body.style.cssText).toBe(reference.style.cssText);
    expect(document.body.style.overflowX).toBe('clip');
    expect(document.body.style.getPropertyPriority('overflow-x')).toBe(style.includes('overflow-x: clip !important') ? 'important' : '');
    // Explicit guards, independent of how jsdom serializes the reference.
    if (style.includes('--unrelated')) expect(document.body.style.getPropertyValue('--unrelated').trim()).toBe('keep-me');
    if (style.includes('position: relative !important')) {
      expect(document.body.style.position).toBe('relative');
      expect(document.body.style.getPropertyPriority('position')).toBe('important');
      expect(document.body.style.getPropertyPriority('padding-right')).toBe('important');
    }
    document.body.removeAttribute('style');
  });

  it('cleans modal and scroll lock on desktop resize, route change, and unmount', () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/workspace']}><IssuerWorkspaceLayout><NavigateAway /></IssuerWorkspaceLayout></MemoryRouter>);
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Open workspace navigation' }));
    open();
    desktop.matches = true;
    act(() => { desktop.dispatchEvent(new Event('change')); });
    expect(document.body.style.position).toBe('');
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Change route' }));
    expect(document.body.style.position).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    unmount();
    expect(document.body.style.position).toBe('');
  });
});
