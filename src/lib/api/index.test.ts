import { describe, expect, it } from 'vitest';
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
