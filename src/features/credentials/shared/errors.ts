import { ApiError, type ApiErrorCode } from '../../../lib/api/types';

export interface FriendlyError { code: ApiErrorCode | 'UNKNOWN'; title: string; message: string }

const COPY: Record<ApiErrorCode, { title: string; message: string }> = {
  VALIDATION: { title: 'Some details need attention', message: 'Check the highlighted fields and try again.' },
  UNAUTHENTICATED: { title: 'Your session has ended', message: 'Sign in again to continue. Nothing was changed.' },
  FORBIDDEN: { title: 'Not available for your role', message: 'Your role in this organization does not allow this action.' },
  NOT_FOUND: { title: 'Record unavailable', message: 'This item is unavailable. It may not exist or you may not have access to it.' },
  REVISION_CONFLICT: { title: 'This changed since you opened it', message: 'Someone else saved a newer version. Reload to see the latest version.' },
  IDEMPOTENCY_CONFLICT: { title: 'This request was already used', message: 'This request was already sent with different details, so nothing new was done. Check the records list before trying again.' },
  INVALID_TRANSITION: { title: 'The record status has changed', message: 'This action is no longer possible for this record. The latest version is shown.' },
  APPROVAL_REQUIRED: { title: 'Approval required', message: 'The records must be reviewed and approved again before they can be issued.' },
  ISSUER_NOT_ELIGIBLE: { title: 'Your organization cannot issue yet', message: 'An organization must be reviewed by VeriMark before it can issue credentials. Nothing was issued.' },
  PAYLOAD_TOO_LARGE: { title: 'Too much data', message: 'This request is larger than allowed. Use at most 200 records and a CSV file up to 2 MiB.' },
  RATE_LIMITED: { title: 'Too many requests', message: 'Please wait a moment and try again.' },
  UNABLE_TO_VERIFY: { title: 'Unable to complete the check', message: 'The service could not be reached. Try again shortly.' },
  DELIVERY_UNAVAILABLE: { title: 'Link unavailable', message: 'This link is unavailable.' },
  TEMPORARILY_UNAVAILABLE: { title: 'Service temporarily unavailable', message: 'The service could not complete the request. Try again shortly.' },
  INTERNAL_ERROR: { title: 'Something went wrong', message: 'The request could not be completed. Try again shortly.' },
};

/** Maps any thrown value to safe, friendly copy. Raw server text is never shown. */
export function friendlyError(error: unknown): FriendlyError {
  if (error instanceof ApiError && COPY[error.code]) {
    const copy = COPY[error.code];
    const message = error.code === 'RATE_LIMITED' && error.retryAfterSeconds
      ? `Please wait about ${error.retryAfterSeconds} seconds and try again.`
      : copy.message;
    return { code: error.code, title: copy.title, message };
  }
  return { code: 'UNKNOWN', title: 'Something went wrong', message: 'The request could not be completed. Check your connection and try again.' };
}

export const errorCode = (error: unknown): ApiErrorCode | 'UNKNOWN' => (error instanceof ApiError ? error.code : 'UNKNOWN');

const LABELS: Record<string, string> = {
  recipientDisplayName: 'Recipient name', recipient_name: 'Recipient name',
  title: 'Title', achievement: 'Achievement',
  recipientEmail: 'E-mail', email: 'E-mail',
  expiresOn: 'Expiry date', expires_on: 'Expiry date',
  reason: 'Reason', name: 'Template name', heading: 'Heading', bodyPrefix: 'Text before the name',
  signatoryName: 'Signatory name', signatoryTitle: 'Signatory title', accent: 'Accent colour', orientation: 'Orientation',
};
export const fieldLabel = (field: string) => LABELS[field] ?? (field ? field.replace(/[_.]/g, ' ') : 'File');

const LIMIT_WORDS: Record<string, number> = {
  recipientDisplayName: 200, recipient_name: 200, title: 200, achievement: 2000, recipientEmail: 254, email: 254, reason: 1000,
  name: 120, heading: 120, bodyPrefix: 200, signatoryName: 120, signatoryTitle: 120,
};

/** Friendly copy for a field-level validation code (client or server). */
export function fieldMessage(field: string, code: string): string {
  const label = fieldLabel(field);
  switch (code) {
    case 'REQUIRED': return `Enter the ${label.toLowerCase()}.`;
    case 'TOO_LONG': return LIMIT_WORDS[field] ? `${label} must be ${LIMIT_WORDS[field]} characters or fewer.` : `${label} is too long.`;
    case 'INVALID': return field === 'recipientEmail' || field === 'email' ? 'Enter an e-mail address like name@example.org.' : `${label} is not valid.`;
    case 'INVALID_DATE': return 'Use a real date in the form YYYY-MM-DD.';
    case 'PAST_DATE': return 'The expiry date must be after today.';
    case 'DUPLICATE': return 'This row repeats an earlier row with the same recipient, title and achievement.';
    case 'COLUMN_COUNT': return 'This row has a different number of cells than the header.';
    case 'MISSING_COLUMN': return `The header is missing the required column "${field}".`;
    case 'UNKNOWN_COLUMN': return `The column "${field}" is not supported. Use recipient_name, title, achievement, email and expires_on.`;
    case 'DUPLICATE_COLUMN': return `The column "${field}" appears more than once.`;
    case 'NO_ROWS': return 'The file has a header but no records.';
    case 'TOO_MANY_ROWS': return 'A file can contain at most 200 records.';
    case 'MALFORMED': return 'The file could not be read as CSV. Check for a missing closing quotation mark.';
    case 'FILE_TOO_LARGE': return 'The file is larger than 2 MiB.';
    case 'EMPTY_FILE': return 'The file is empty.';
    default: return `${label} is not valid.`;
  }
}
