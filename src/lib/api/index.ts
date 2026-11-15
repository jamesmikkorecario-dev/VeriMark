import { createDemoApi } from './demoAdapter';
import { createSupabaseApi } from './supabaseAdapter';
import type { VeriMarkApi } from './types';

export * from './types';
export { ApiProvider, useApi } from './context';

/** Uses the Supabase project when both public variables are configured; otherwise the clearly labelled local demo. */
export function createApi(env: Record<string, string | boolean | undefined> = import.meta.env): VeriMarkApi {
  const url = String(env.VITE_SUPABASE_URL ?? '').trim();
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  return url && key ? createSupabaseApi(url, key) : createDemoApi();
}
