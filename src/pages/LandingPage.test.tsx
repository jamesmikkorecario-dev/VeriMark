import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentContext, type Environment } from '../components/layout/environment';
import { DEMO_PUBLIC_IDS } from '../lib/api/demo/state';
import LandingPage from './LandingPage';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false, addListener() {}, removeListener() {} }));
});
afterEach(() => { vi.unstubAllGlobals(); });

const view = (mode: Environment) => render(
  <MemoryRouter><EnvironmentContext.Provider value={mode}><LandingPage /></EnvironmentContext.Provider></MemoryRouter>,
);
const main = () => within(screen.getByRole('main'));

describe('landing page in the demonstration build', () => {
  it('leads with the live demo and offers verification second', () => {
    view('demo');
    expect(main().getByRole('link', { name: 'Open the live demo' })).toHaveAttribute('href', '/demo');
    expect(main().getByRole('link', { name: 'Verify a credential' })).toHaveAttribute('href', '/verify');
    expect(main().getByRole('link', { name: 'Explore the live demo' })).toHaveAttribute('href', '/demo');
    expect(main().getByRole('link', { name: 'See how it works' })).toHaveAttribute('href', '/#method');
  });

  it('links the example record to the real seeded verification page and describes the demo honestly', () => {
    view('demo');
    expect(main().getByRole('link', { name: 'Explore a sample record' })).toHaveAttribute('href', `/verify/${DEMO_PUBLIC_IDS.valid}`);
    expect(main().getAllByText(/browser tab/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('main')).toHaveTextContent(`RECORD NO. ${DEMO_PUBLIC_IDS.valid}`);
  });

  it('keeps no wording or links from the retired prototype', () => {
    const { container } = view('demo');
    expect(container).not.toHaveTextContent(/\bM1\b/);
    expect(container).not.toHaveTextContent('Explore demo workspace');
    const targets = Array.from(container.querySelectorAll('a')).map(link => link.getAttribute('href'));
    expect(targets.filter(target => /^\/(workspace|preview)/.test(target ?? ''))).toEqual([]);
  });
});

describe('landing page with a real backend', () => {
  it('has no demo links: issuers are sent to sign-in', () => {
    const { container } = view('supabase');
    expect(main().getByRole('link', { name: 'Sign in to your workspace' })).toHaveAttribute('href', '/sign-in');
    expect(main().getByRole('link', { name: 'Verify a credential' })).toHaveAttribute('href', '/verify');
    expect(main().getByRole('link', { name: 'Check a record' })).toHaveAttribute('href', '/verify');
    expect(Array.from(container.querySelectorAll('a')).map(link => link.getAttribute('href'))).not.toContain('/demo');
    expect(container).not.toHaveTextContent(/live demo/i);
  });
});
