import { useCallback, useEffect, useState } from 'react';

export type LoadState<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/**
 * Loads data for a screen. `fetcher` must be memoized; it reruns when it changes.
 * `retry()` shows the loading state again; `refresh()` reloads in the background and keeps current data visible.
 */
export function useLoad<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    fetcher().then(
      data => { if (active) setState({ status: 'ready', data }); },
      error => { if (active) setState({ status: 'error', error }); },
    );
    return () => { active = false; };
  }, [fetcher, attempt]);
  const refresh = useCallback(() => setAttempt(n => n + 1), []);
  const retry = useCallback(() => { setState({ status: 'loading' }); setAttempt(n => n + 1); }, []);
  return { state, refresh, retry };
}
