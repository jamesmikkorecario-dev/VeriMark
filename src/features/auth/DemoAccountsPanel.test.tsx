import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../lib/api/context';
import { resetDemoData } from '../../lib/api/demo/reset';
import { installDialogPolyfill } from '../credentials/shared/testing';
import { createFakeApi } from './testing/fakeApi';
import { DemoAccountsPanel, DemoResetControl } from './DemoAccountsPanel';

vi.mock('../../lib/api/demo/reset', () => ({ resetDemoData: vi.fn(), DEMO_ENTRY_PATH: '/demo' }));
beforeEach(() => { installDialogPolyfill(); });

const view = (mode: 'demo' | 'supabase', ui = <DemoAccountsPanel />) =>
  render(<ApiProvider api={createFakeApi({}, mode)}><MemoryRouter>{ui}</MemoryRouter></ApiProvider>);

describe('demo accounts panel', () => {
  it('offers the one-click demo entry and a reset in demo mode', () => {
    view('demo');
    expect(screen.getByRole('link', { name: 'Open the live demo' })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('button', { name: 'Reset demo data' })).toBeInTheDocument();
  });

  it('renders nothing with a real backend', () => {
    const { container } = view('supabase');
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DemoResetControl', () => {
  it('asks before resetting, and Cancel changes nothing', async () => {
    const user = userEvent.setup();
    view('demo', <DemoResetControl />);
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset the demo data?' });
    expect(dialog).toHaveAccessibleDescription(/removes everything you created or changed in this browser tab/);
    await user.click(within(dialog).getByRole('button', { name: 'Keep my changes' }));
    expect(resetDemoData).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Reset the demo data?' })).toBeNull();
  });

  it('resets after confirmation', async () => {
    const user = userEvent.setup();
    view('demo', <DemoResetControl />);
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    await user.click(screen.getByRole('button', { name: 'Yes, reset everything' }));
    expect(resetDemoData).toHaveBeenCalledTimes(1);
  });

  it('is absent with a real backend', () => {
    view('supabase', <DemoResetControl />);
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).toBeNull();
  });
});
