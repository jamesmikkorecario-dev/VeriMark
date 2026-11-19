import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../lib/api/context';
import { ApiError, type SessionUser, type VeriMarkApi } from '../lib/api/types';
import { DEMO_PUBLIC_IDS } from '../lib/api/demo/state';
import { createFakeApi, membership, organization, signedInApi, stubBrowser } from '../features/auth/testing/fakeApi';
import App from './App';

beforeEach(() => { stubBrowser(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Probe() {
  const location = useLocation();
  return <div hidden data-testid="location">{location.pathname}{location.search}{location.hash}</div>;
}
function mount(path: string, api: VeriMarkApi) {
  return render(<ApiProvider api={api}><MemoryRouter initialEntries={[path]}><App /><Probe /></MemoryRouter></ApiProvider>);
}
const where = () => screen.getByTestId('location').textContent;

/** A demo-mode fake whose session really changes on signIn, so the router sees what the browser would. */
function demoApi(overrides: Partial<VeriMarkApi> = {}) {
  let current: SessionUser | null = null;
  const listeners = new Set<(user: SessionUser | null) => void>();
  const signIn = vi.fn(async (email: string) => {
    current = { id: `u-${email}`, email, displayName: 'Demo Person' };
    listeners.forEach(listener => listener(current));
    return current;
  });
  const admin = () => current?.email.startsWith('admin@') === true;
  const api = createFakeApi({
    getSession: async () => current,
    onAuthChange: (listener: (user: SessionUser | null) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    signIn,
    listMemberships: async () => (admin() ? [] : [membership('owner')]),
    isPlatformAdmin: async () => admin(),
    getOrganization: async () => organization,
    getMetrics: async () => ({ issued: 1, valid: 1, expired: 0, revoked: 0, replaced: 0, verificationChecks: 0 }),
    listCredentials: async () => ({ items: [], nextCursor: null }),
    ...overrides,
  }, 'demo');
  return { api, signIn };
}

describe('/demo entry', () => {
  it('signs in as the seeded owner and lands on the workspace overview with the guide', async () => {
    const { api, signIn } = demoApi();
    mount('/demo', api);
    await waitFor(() => expect(where()).toBe('/app'));
    expect(signIn).toHaveBeenCalledExactlyOnceWith('owner@demo.verimark.test', 'demo-password-1');
    expect(await screen.findByRole('heading', { name: 'Explore the demo' })).toBeInTheDocument();
  });

  it.each([
    ['issuer', 'issuer@demo.verimark.test', '/app'], ['viewer', 'viewer@demo.verimark.test', '/app'],
    ['north', 'north@demo.verimark.test', '/app'], ['owner', 'owner@demo.verimark.test', '/app'],
    ['admin', 'admin@demo.verimark.test', '/app/review'],
    ['nobody', 'owner@demo.verimark.test', '/app'],
  ])('?as=%s signs in as %s and opens %s', async (persona, email, landing) => {
    const { api, signIn } = demoApi({ listReviewQueue: async () => [] });
    mount(`/demo?as=${persona}`, api);
    await waitFor(() => expect(where()).toBe(landing));
    expect(signIn).toHaveBeenCalledWith(email, 'demo-password-1');
  });

  it('shows a loading state while the sign-in is pending, then replaces the entry in history', async () => {
    let release!: () => void;
    const { api } = demoApi();
    const real = api.signIn;
    api.signIn = vi.fn(async (...args: Parameters<typeof real>) => { await new Promise<void>(resolve => { release = resolve; }); return real(...args); });
    mount('/demo', api);
    expect(await screen.findByRole('status')).toHaveTextContent('Opening the fictional demo workspace');
    expect(screen.getByRole('heading', { name: 'Opening the live demo' })).toBeInTheDocument();
    expect(where()).toBe('/demo');
    release();
    await waitFor(() => expect(where()).toBe('/app'));
  });

  it('offers a retry when sign-in fails', async () => {
    const { api } = demoApi();
    api.signIn = vi.fn().mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 'x'));
    mount('/demo', api);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not open the demo');
    expect(screen.getByRole('link', { name: 'sign in with a demo account' })).toHaveAttribute('href', '/sign-in');
  });

  it('redirects to sign-in with a real backend and never signs anyone in', async () => {
    const api = createFakeApi({}, 'supabase');
    mount('/demo?as=admin', api);
    await waitFor(() => expect(where()).toBe('/sign-in'));
    expect(api.signIn).not.toHaveBeenCalled();
    expect(screen.queryByText('Demo accounts')).toBeNull();
  });
});

describe('retired prototype routes', () => {
  it('/workspace opens the demo in demo mode', async () => {
    const { api, signIn } = demoApi();
    mount('/workspace', api);
    await waitFor(() => expect(where()).toBe('/app'));
    expect(signIn).toHaveBeenCalledWith('owner@demo.verimark.test', 'demo-password-1');
  });

  it('/workspace opens the application otherwise: the overview when signed in', async () => {
    mount('/workspace', signedInApi('owner', {
      getMetrics: async () => ({ issued: 0, valid: 0, expired: 0, revoked: 0, replaced: 0, verificationChecks: 0 }),
      listCredentials: async () => ({ items: [], nextCursor: null }),
    }));
    await waitFor(() => expect(where()).toBe('/app'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Explore the demo' })).toBeNull();
  });

  it('/workspace asks for sign-in when signed out with a real backend', async () => {
    mount('/workspace', createFakeApi({}, 'supabase'));
    await waitFor(() => expect(where()).toBe('/sign-in'));
  });

  it.each([
    ['records', '/app/credentials'], ['credentials', '/app/credentials'], ['issue', '/app/issue'], ['templates', '/app/templates'],
    ['activity', '/app/activity'], ['settings', '/app/organization'], ['organization', '/app/organization'],
    ['record', '/app'], ['anything-else', '/app'],
  ])('/workspace/%s leads to %s', async (section, target) => {
    mount(`/workspace/${section}`, signedInApi('owner', {}, 'demo'));
    await waitFor(() => expect(where()).toBe(target));
  });

  it('/preview/record shows the seeded public record in demo mode and the form otherwise', async () => {
    mount('/preview/record', createFakeApi({}, 'demo'));
    await waitFor(() => expect(where()).toBe(`/verify/${DEMO_PUBLIC_IDS.valid}`));
  });

  it('/preview/record shows the verification form with a real backend', async () => {
    mount('/preview/record', createFakeApi({}, 'supabase'));
    await waitFor(() => expect(where()).toBe('/verify'));
    expect(screen.getByRole('heading', { level: 1, name: 'Verify a record' })).toBeInTheDocument();
  });

  it.each([['/preview/verify', '/verify'], ['/preview/about', '/#method'], ['/preview/anything', '/'], ['/preview/a/b', '/'], ['/preview', '/']])('%s leads to %s', async (from, target) => {
    mount(from, createFakeApi({}, 'demo'));
    await waitFor(() => expect(where()).toBe(target));
  });

  it('unknown routes still show the not-found page', () => {
    mount('/workspace/a/b', createFakeApi({}, 'demo'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This page isn’t');
  });
});
