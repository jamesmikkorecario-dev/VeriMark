import { describe, expect, it, vi } from 'vitest';
import { createDemoApi, DEMO_PASSWORD } from '../demoAdapter';
import { DEMO_ENTRY_PATH, resetDemoData } from './reset';
import { DEMO_STORAGE_KEY } from './state';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('resetDemoData', () => {
  it('clears only the demo state and navigates to the demo entry with a full navigation', () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, '{"anything":true}');
    storage.setItem('unrelated', 'keep');
    const navigate = vi.fn();
    resetDemoData({ storage, navigate });
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
    expect(navigate).toHaveBeenCalledExactlyOnceWith(DEMO_ENTRY_PATH);
    expect(DEMO_ENTRY_PATH).toBe('/demo');
  });

  it('still navigates when storage is unavailable or throws', () => {
    const navigate = vi.fn();
    resetDemoData({ storage: null, navigate });
    resetDemoData({ storage: { removeItem() { throw new Error('blocked'); } }, navigate });
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('makes the next adapter start from the seed again', async () => {
    const storage = new MemoryStorage();
    const first = createDemoApi({ storage });
    await first.signIn('owner@demo.verimark.test', DEMO_PASSWORD);
    const [membership] = await first.listMemberships();
    const draft = await first.createBatch(membership.organizationId, { templateId: 'tpl_demo_fieldwork', source: 'single', rows: [{ recipientDisplayName: 'Temp Person', title: 'Temp', achievement: 'Temporary change.' }] });
    expect(draft.batchId).toBeTruthy();
    expect(storage.getItem(DEMO_STORAGE_KEY)).toContain('Temp Person');
    resetDemoData({ storage, navigate: () => {} });
    const second = createDemoApi({ storage });
    expect(await second.getSession()).toBeNull();
    await second.signIn('owner@demo.verimark.test', DEMO_PASSWORD);
    expect(storage.getItem(DEMO_STORAGE_KEY)).not.toContain('Temp Person');
  });
});
