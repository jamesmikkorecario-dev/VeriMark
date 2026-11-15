import { createContext, useContext, type ReactNode } from 'react';
import type { VeriMarkApi } from './types';

const ApiContext = createContext<VeriMarkApi | null>(null);
/** Tests inject a fake VeriMarkApi here; the app passes createApi(). */
export function ApiProvider({ api, children }: { api: VeriMarkApi; children: ReactNode }) { return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>; }
// eslint-disable-next-line react-refresh/only-export-components
export function useApi(): VeriMarkApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi requires an ApiProvider');
  return api;
}
