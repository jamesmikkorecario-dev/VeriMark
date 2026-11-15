import { createContext, useContext } from 'react';
import type { Membership, Organization, SessionUser } from '../../lib/api/types';

/** Provided by the authenticated workspace layout (task FS-A) to every /app page. */
export interface Workspace {
  user: SessionUser;
  membership: Membership;
  organization: Organization;
  /** UI convenience only (owner or issuer). The backend re-checks every action. */
  canIssue: boolean;
  /** Reloads organization and membership after a change such as rename or review. */
  refresh(): Promise<void>;
}
export const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('useWorkspace requires the workspace layout');
  return workspace;
}
