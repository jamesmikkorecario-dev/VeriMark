import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApi } from './index';

describe('createApi', () => {
  it('uses the demonstration adapter unless both Supabase variables are set', async () => {
    expect((await createApi({})).mode).toBe('demo');
    expect((await createApi({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).mode).toBe('demo');
    expect((await createApi({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_PUBLISHABLE_KEY: 'key' })).mode).toBe('demo');
  });
  it('uses Supabase when both are set', async () => {
    expect((await createApi({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable' })).mode).toBe('supabase');
  });
});

describe('createApi in the demo-only build', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it('never selects Supabase, even with both variables set', async () => {
    vi.stubEnv('VITE_DEMO_ONLY', 'true');
    vi.resetModules();
    // Re-imported on purpose: the flag is read once at module load, as the bundler inlines it.
    const { createApi: demoOnly } = await import('./index');
    expect((await demoOnly({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable' })).mode).toBe('demo');
  });
});
