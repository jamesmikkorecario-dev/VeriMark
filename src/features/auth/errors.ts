import { ApiError, type ApiErrorCode, type FieldError } from '../../lib/api/types';

/** Friendly copy for stable error codes. Raw server text is never shown. */
const copy: Partial<Record<ApiErrorCode, string>> = {
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  FORBIDDEN: 'Your role in this organization does not allow this action.',
  NOT_FOUND: 'This item is not available. It may have been removed, or you may not have access to it.',
  REVISION_CONFLICT: 'Someone changed this after you loaded it. The latest version is now shown; review it and try again.',
  IDEMPOTENCY_CONFLICT: 'This request could not be repeated safely. Reload the page and try again.',
  INVALID_TRANSITION: 'This change is not possible in the current state.',
  APPROVAL_REQUIRED: 'Approve the exact preview before continuing.',
  ISSUER_NOT_ELIGIBLE: 'This organization cannot issue until VeriMark has completed its identity review.',
  PAYLOAD_TOO_LARGE: 'That is too large to process.',
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
  VALIDATION: 'Some details need attention.',
  TEMPORARILY_UNAVAILABLE: 'The service is temporarily unavailable. Please try again.',
};
export const GENERIC_ERROR = 'Something went wrong. Please try again.';

export const errorCode = (error: unknown): ApiErrorCode | null => (error instanceof ApiError ? error.code : null);

export function friendlyError(error: unknown, overrides: Partial<Record<ApiErrorCode, string>> = {}): string {
  const code = errorCode(error);
  if (!code) return GENERIC_ERROR;
  return overrides[code] ?? copy[code] ?? GENERIC_ERROR;
}

export function fieldErrors(error: unknown): FieldError[] {
  return error instanceof ApiError ? error.fields : [];
}

/** Message for a field error code from the backend, phrased for a given field label. */
export function fieldMessage(code: string, label: string): string {
  switch (code) {
    case 'REQUIRED': return `Enter ${label.toLowerCase()}.`;
    case 'TOO_LONG': return `${label} is too long.`;
    case 'TOO_SHORT': return `${label} is too short.`;
    case 'INVALID': return `Enter a valid ${label.toLowerCase()}.`;
    case 'UNAVAILABLE': return `This ${label.toLowerCase()} cannot be used. Try signing in instead.`;
    case 'ALREADY_MEMBER': return 'This person is already a member of the organization.';
    case 'DUPLICATE': return `${label} is duplicated.`;
    case 'PAST_DATE': return `${label} must be in the future.`;
    default: return `Check ${label.toLowerCase()}.`;
  }
}
