import type { VeriMarkApi } from './types';

export * from './types';
export { ApiProvider, useApi } from './context';

/**
 * Set only by `npm run build:demo` (the public portfolio build). Vite inlines it as a constant, so the bundler drops the
 * Supabase branch and its chunk entirely: that build can never reach a Supabase project, whatever variables are set.
 */
const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === 'true';

/**
 * Uses the Supabase project when both public variables are configured; otherwise the clearly labelled local demo.
 * Only the adapter in use is downloaded.
 */
// Only these two keys, never the whole import.meta.env: Vite would otherwise embed every VITE_* variable in the bundle.
const PUBLIC_ENV = { VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
export async function createApi(env: Record<string, string | boolean | undefined> = PUBLIC_ENV): Promise<VeriMarkApi> {
  if (!DEMO_ONLY) {
    const url = String(env.VITE_SUPABASE_URL ?? '').trim();
    const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
    if (url && key) return (await import('./supabaseAdapter')).createSupabaseApi(url, key);
  }
  return (await import('./demoAdapter')).createDemoApi();
}
