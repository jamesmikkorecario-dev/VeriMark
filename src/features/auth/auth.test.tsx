import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type SessionUser } from '../../lib/api/types';
import { createFakeApi, renderApp, signedInApi, stubBrowser, user } from './testing/fakeApi';
import { safeReturnPath } from './session';

beforeEach(() => { stubBrowser(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

const location = () => screen.getByTestId('location').textContent;

describe('safeReturnPath', () => {
  it.each([
    ['/app/organization', '/app/organization'], ['/app', '/app'], ['/app?x=1', '/app?x=1'],
    ['/application', '/app'], ['https://evil.example/app', '/app'], ['//evil.example', '/app'], ['/app//evil.example', '/app'],
    ['/app\\evil', '/app'], ['/sign-in', '/app'], ['/app/\nfoo', '/app'], [undefined, '/app'], [42, '/app'],
  ])('%s -> %s', (input, expected) => { expect(safeReturnPath(input)).toBe(expected); });
});

describe('sign in', () => {
  it('validates before calling the API and links the error summary to the fields', async () => {
    const api = createFakeApi();
    renderApp('/sign-in', api);
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Sign in' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole('link', { name: 'Enter your email address.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    await ui.type(screen.getByLabelText('Email address'), 'not-an-email');
    await ui.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getAllByText('Enter an email address in the format name@example.com.').length).toBeGreaterThan(0);
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it('shows one generic message for wrong credentials and never the server text', async () => {
    const api = createFakeApi({ signIn: async () => { throw new ApiError('UNAUTHENTICATED', 'user robin@example.test has no password row'); } });
    renderApp('/sign-in', api);
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Email address'), 'robin@example.test');
    await ui.type(screen.getByLabelText('Password'), 'wrong-password');
    await ui.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('The email address or password is not correct.')).toBeInTheDocument();
    expect(screen.queryByText(/password row/)).toBeNull();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('blocks a double submit while pending', async () => {
    let resolve!: (u: SessionUser) => void;
    const api = createFakeApi({ signIn: () => new Promise<SessionUser>(r => { resolve = r; }) });
    renderApp('/sign-in', api);
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Email address'), 'robin@example.test');
    await ui.type(screen.getByLabelText('Password'), 'long-password');
    await ui.click(screen.getByRole('button', { name: 'Sign in' }));
    const pending = screen.getByRole('button', { name: 'Signing in…' });
    expect(pending).toBeDisabled();
    await ui.click(pending);
    expect(api.signIn).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(user); });
  });

  it('fills credentials from the demo accounts panel only in demo mode', async () => {
    renderApp('/sign-in', createFakeApi());
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByRole('heading', { name: 'Demo accounts' })).toBeNull();
  });

  it('demo panel fills the form', async () => {
    renderApp('/sign-in', createFakeApi({}, 'demo'));
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Use viewer@demo.verimark.test' }));
    expect(screen.getByLabelText('Email address')).toHaveValue('viewer@demo.verimark.test');
    expect(screen.getByLabelText('Password')).toHaveValue('demo-password-1');
  });
});

describe('guard and return path', () => {
  it('redirects a signed-out visitor to sign in and returns to the intended /app path afterwards', async () => {
    let session: SessionUser | null = null;
    const api = signedInApi('owner', {
      getSession: async () => session,
      signIn: async () => { session = user; return user; },
      listMembers: async () => [], listInvites: async () => [],
    });
    renderApp('/app/organization', api);
    await waitFor(() => expect(location()).toBe('/sign-in'));
    const ui = userEvent.setup();
    await ui.type(screen.getByLabelText('Email address'), user.email);
    await ui.type(screen.getByLabelText('Password'), 'long-password');
    await ui.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(location()).toBe('/app/organization'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Example Learning Circle' })).toBeInTheDocument();
  });

  it('shows a loading state while the session is checked and an error with retry if it fails', async () => {
    let fail = true;
    const api = signedInApi('owner', { getSession: async () => { if (fail) throw new Error('offline'); return user; } });
    renderApp('/app/organization', api);
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    const retry = await screen.findByRole('button', { name: 'Try again' });
    fail = false;
    api.listMembers = vi.fn(async () => []);
    api.listInvites = vi.fn(async () => []);
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('heading', { level: 1, name: 'Example Learning Circle' })).toBeInTheDocument();
  });

  it('a signed-in visitor on /sign-in goes to the workspace', async () => {
    renderApp('/sign-in', signedInApi(null));
    await waitFor(() => expect(location()).toBe('/app/onboarding'));
  });
});

describe('sign up', () => {
  it('validates name, email, password length and confirmation', async () => {
    const api = createFakeApi();
    renderApp('/sign-up', api);
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Your name'), 'Robin');
    await ui.type(screen.getByLabelText('Email address'), 'robin@example.test');
    await ui.type(screen.getByLabelText('Password'), 'short');
    await ui.type(screen.getByLabelText('Confirm password'), 'different');
    await ui.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getAllByText('Password must be at least 10 characters.').length).toBe(2);
    expect(screen.getAllByText('Passwords do not match.').length).toBe(2);
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it('maps a backend field error to friendly copy', async () => {
    const api = createFakeApi({ signUp: async () => { throw new ApiError('VALIDATION', 'duplicate key', { fields: [{ field: 'email', code: 'UNAVAILABLE' }] }); } });
    renderApp('/sign-up', api);
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Your name'), 'Robin');
    await ui.type(screen.getByLabelText('Email address'), 'robin@example.test');
    await ui.type(screen.getByLabelText('Password'), 'long-password');
    await ui.type(screen.getByLabelText('Confirm password'), 'long-password');
    await ui.click(screen.getByRole('button', { name: 'Create account' }));
    expect((await screen.findAllByText('This email address cannot be used. Try signing in instead.')).length).toBe(2);
    expect(screen.queryByText('duplicate key')).toBeNull();
  });
});

describe('password reset', () => {
  async function request(api = createFakeApi({ requestPasswordReset: async () => {} })) {
    renderApp('/reset-password', api);
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Email address'), 'someone@example.test');
    await ui.click(screen.getByRole('button', { name: 'Send reset link' }));
    return api;
  }

  it('shows the same neutral confirmation whether or not the account exists', async () => {
    const api = await request();
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for that address/)).toBeInTheDocument();
    expect(api.requestPasswordReset).toHaveBeenCalledWith('someone@example.test');
  });

  it('does not reveal a NOT_FOUND from the backend', async () => {
    await request(createFakeApi({ requestPasswordReset: async () => { throw new ApiError('NOT_FOUND', 'no such user'); } }));
    expect(await screen.findByText(/If an account exists for that address/)).toBeInTheDocument();
  });

  it('lets the user retry after a rate limit', async () => {
    await request(createFakeApi({ requestPasswordReset: async () => { throw new ApiError('RATE_LIMITED', 'slow down'); } }));
    expect(await screen.findByText('Too many requests. Wait a moment and try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  });
});

describe('update password', () => {
  it('asks for the reset link when signed out', async () => {
    renderApp('/update-password', createFakeApi());
    expect(await screen.findByRole('heading', { name: 'Open your reset link first' })).toBeInTheDocument();
  });

  it('saves a matching password of at least 10 characters', async () => {
    const api = signedInApi('owner', { updatePassword: async () => {} });
    renderApp('/update-password', api);
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('New password'), 'a-new-password');
    await ui.type(screen.getByLabelText('Confirm new password'), 'a-new-password');
    await ui.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
    expect(api.updatePassword).toHaveBeenCalledWith('a-new-password');
  });
});

describe('invitation', () => {
  const token = 'A'.repeat(43);

  it('removes the token from the URL at once, then accepts it after sign-in', async () => {
    window.history.replaceState(null, '', `/invite#${token}`);
    let session: SessionUser | null = null;
    const api = createFakeApi({
      getSession: async () => session,
      signIn: async () => { session = user; return user; },
      acceptInvite: async () => ({ organizationId: 'org1', organizationName: 'Example Learning Circle', role: 'issuer', reviewState: 'reviewed' }),
    });
    renderApp('/invite', api);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/invite');
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Email address'), user.email);
    await ui.type(screen.getByLabelText('Password'), 'long-password');
    await ui.click(screen.getByRole('button', { name: 'Sign in to continue' }));
    await ui.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    expect(await screen.findByRole('heading', { name: 'You have joined Example Learning Circle' })).toBeInTheDocument();
    expect(api.acceptInvite).toHaveBeenCalledWith(token);
    expect(sessionStorage.getItem('verimark.activeOrganization')).toContain('org1');
    expect(sessionStorage.getItem('verimark.activeOrganization')).not.toContain(token);
  });

  it('shows one unavailable message for unknown, used, expired or wrong-email invitations', async () => {
    window.history.replaceState(null, '', `/invite#${token}`);
    const api = signedInApi(null, { acceptInvite: async () => { throw new ApiError('NOT_FOUND', 'invite expired at 2026-01-01'); } });
    renderApp('/invite', api);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Accept invitation' }));
    expect(await screen.findByRole('heading', { name: 'This invitation is unavailable' })).toBeInTheDocument();
    expect(screen.queryByText(/2026-01-01/)).toBeNull();
  });

  it('explains an incomplete link without calling the API', async () => {
    const api = signedInApi(null);
    renderApp('/invite', api);
    expect(await screen.findByRole('heading', { name: 'This invitation link is incomplete' })).toBeInTheDocument();
    expect(api.acceptInvite).not.toHaveBeenCalled();
  });
});
