/** sessionStorage key for the chosen organization. Holds an organization id only; cleared on sign-out. */
export const ACTIVE_ORGANIZATION_KEY = 'verimark.activeOrganization';

export function readActiveOrganization(userId: string): string | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_ORGANIZATION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { userId?: unknown; organizationId?: unknown };
    return value.userId === userId && typeof value.organizationId === 'string' ? value.organizationId : null;
  } catch { return null; }
}
export function writeActiveOrganization(userId: string, organizationId: string) {
  try { sessionStorage.setItem(ACTIVE_ORGANIZATION_KEY, JSON.stringify({ userId, organizationId })); } catch { /* Storage blocked: the choice lasts for this page only. */ }
}
export function clearActiveOrganization() {
  try { sessionStorage.removeItem(ACTIVE_ORGANIZATION_KEY); } catch { /* ignore */ }
}

/** Only same-origin workspace paths are allowed as a post-sign-in destination. */
export function safeReturnPath(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string') return fallback;
  if (!/^\/app(?:[/?#]|$)/.test(value)) return fallback;
  if (value.includes('//') || value.includes('\\') || [...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return fallback;
  return value;
}

export const MIN_PASSWORD_LENGTH = 10;
export const isEmailAddress = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
