import { createContext, useContext } from 'react';
import type { Membership, ReviewState } from '../../lib/api/types';

/** Account-level data for /app, available even before the user belongs to an organization. */
export interface AppShell {
  memberships: Membership[];
  isPlatformAdmin: boolean;
  /** Switches the active organization (persisted for this browser session). */
  selectOrganization(organizationId: string): void;
  /** Reloads memberships and the active organization, optionally switching to `organizationId`. */
  reload(organizationId?: string): Promise<void>;
}
export const AppShellContext = createContext<AppShell | null>(null);
export function useAppShell(): AppShell {
  const shell = useContext(AppShellContext);
  if (!shell) throw new Error('useAppShell requires the app layout');
  return shell;
}

export const reviewLabels: Record<ReviewState, string> = { pending: 'Review pending', reviewed: 'Reviewed', suspended: 'Suspended' };
export const reviewExplanations: Record<ReviewState, string> = {
  pending: 'VeriMark has not yet checked that this organization is who it says it is. You can prepare templates, but issuing is unavailable until the review is complete.',
  reviewed: 'VeriMark has checked that this organization is who it says it is. This is an identity check, not an accreditation or endorsement of its programmes.',
  suspended: 'VeriMark has suspended issuing for this organization. Existing records keep their own status. Contact VeriMark for details.',
};
export const REVIEW_IS_NOT_ACCREDITATION = 'Review is an identity check, not accreditation.';
const sectionTitles: [RegExp, string][] = [
  [/^\/app\/?$/, 'Overview'], [/^\/app\/credentials\/[^/]+/, 'Credential'], [/^\/app\/credentials\/?$/, 'Credentials'],
  [/^\/app\/issue/, 'Issue credentials'], [/^\/app\/templates/, 'Templates'], [/^\/app\/activity/, 'Activity'],
  [/^\/app\/organization/, 'Organization'], [/^\/app\/onboarding/, 'Create organization'], [/^\/app\/review/, 'Platform review'],
];
/** Human name of an /app section, used for the breadcrumb and the document title. */
export const sectionTitle = (path: string) => sectionTitles.find(([pattern]) => pattern.test(path))?.[1] ?? 'Workspace';

export const ORGANIZATION_NAME_MAX = 120;
export function validateOrganizationName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return 'Enter the organization name.';
  if (name.length > ORGANIZATION_NAME_MAX) return `Organization name must be ${ORGANIZATION_NAME_MAX} characters or fewer.`;
  return undefined;
}

export const roleLabels = { owner: 'Owner', issuer: 'Issuer', viewer: 'Viewer' } as const;
