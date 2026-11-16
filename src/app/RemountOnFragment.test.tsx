import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../lib/api/context';
import { ApiError, type VeriMarkApi } from '../lib/api/types';
import ReceivePage from '../features/delivery/ReceivePage';
import RemountOnFragment from './RemountOnFragment';

afterEach(() => { window.history.replaceState(null, '', '/'); });

describe('a second secret link opened in the same tab', () => {
  it('is exchanged and removed from the address bar, like a first visit', async () => {
    const first = 'a'.repeat(43); const second = 'b'.repeat(43);
    const exchangeDelivery = vi.fn(async (token: string) => {
      if (token === first) throw new ApiError('DELIVERY_UNAVAILABLE', 'DELIVERY_UNAVAILABLE');
      return { publicId: 'p'.repeat(22), status: 'valid' as const, issuerDisplayName: 'Fictional Guild', recipientDisplayName: 'Second Link Fictional', title: 'T', achievement: 'A',
        issuedAt: '2026-01-01T00:00:00Z', expiresAt: null, template: { heading: 'H', bodyPrefix: 'B', signatoryName: 'S', signatoryTitle: 'T', accent: 'forest' as const, orientation: 'landscape' as const } };
    });
    const api = { mode: 'supabase', exchangeDelivery } as unknown as VeriMarkApi;
    window.history.replaceState(null, '', `/receive#${first}`);
    render(<ApiProvider api={api}><MemoryRouter><RemountOnFragment><ReceivePage /></RemountOnFragment></MemoryRouter></ApiProvider>);
    expect(await screen.findByRole('heading', { name: 'Access link unavailable' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');

    window.history.replaceState(null, '', `/receive#${second}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Your certificate' })).toBeInTheDocument();
    expect(screen.getByText('Second Link Fictional')).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(exchangeDelivery.mock.calls.map(call => call[0])).toEqual([first, second]);
  });
});
