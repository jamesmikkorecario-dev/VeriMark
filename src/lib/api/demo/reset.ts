import { DEMO_STORAGE_KEY } from './state';

/** The route that signs in as a seeded persona and lands in the workspace. Reseeding happens on the load after a reset. */
export const DEMO_ENTRY_PATH = '/demo';

export interface ResetDemoOptions {
  /** Defaults to window.sessionStorage; null skips clearing (nothing is stored). */
  storage?: Pick<Storage, 'removeItem'> | null;
  /** Defaults to a full page navigation, so the in-memory adapter is discarded and the seed is rebuilt. */
  navigate?: (path: string) => void;
}

function defaultStorage(): ResetDemoOptions['storage'] {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}

/**
 * Throws away everything created or changed in this browser tab and starts the demonstration again from its seed.
 * Only the demo state key is removed; a full navigation (not a router transition) follows so no in-memory copy survives.
 */
export function resetDemoData(options: ResetDemoOptions = {}): void {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  try { storage?.removeItem(DEMO_STORAGE_KEY); } catch { /* Storage blocked: the reload below still discards the in-memory state. */ }
  (options.navigate ?? (path => window.location.assign(path)))(DEMO_ENTRY_PATH);
}
