import type { VeriMarkApi } from './types';

export * from './types';
export { ApiProvider, useApi } from './context';

/**
 * Uses the Supabase project when both public variables are configured; otherwise the clearly labelled local demo.
 * Only the adapter in use is downloaded.
 */
export async function createApi(env: Record<string, string | boolean | undefined> = import.meta.env): Promise<VeriMarkApi> {
  const url = String(env.VITE_SUPABASE_URL ?? '').trim();
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (url && key) return (await import('./supabaseAdapter')).createSupabaseApi(url, key);
  return (await import('./demoAdapter')).createDemoApi();
}
