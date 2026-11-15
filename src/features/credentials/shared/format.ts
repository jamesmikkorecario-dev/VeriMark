const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });

const valid = (value: string) => !Number.isNaN(new Date(value).getTime());
export const formatDate = (value: string | null | undefined, empty = 'No expiry') => (value && valid(value) ? dateFormat.format(new Date(value)) : empty);
export const formatDateTime = (value: string | null | undefined) => (value && valid(value) ? dateTimeFormat.format(new Date(value)) : '—');

/** Saves data as a file through a temporary object URL. */
export function downloadFile(data: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const ACTIONS: Record<string, string> = {
  'organization.created': 'Created the organization',
  'organization.renamed': 'Renamed the organization',
  'organization.reviewed': 'Recorded an issuer review',
  'member.invited': 'Invited a member',
  'member.joined': 'Joined the organization',
  'member.role_changed': 'Changed a member role',
  'member.removed': 'Removed a member',
  'invite.revoked': 'Withdrew an invitation',
  'template.created': 'Created a template',
  'template.updated': 'Updated a template',
  'template.archived': 'Archived a template',
  'batch.created': 'Prepared records for review',
  'batch.approved': 'Approved records for issuing',
  'batch.issued': 'Issued records',
  'credential.issued': 'Issued a credential',
  'credential.revoked': 'Revoked a credential',
  'credential.replaced': 'Replaced a credential',
  'delivery.created': 'Created a recipient link',
  'delivery_link.created': 'Created a recipient link',
};

/** Turns an audit action code such as "credential.revoked" into readable words. */
export function describeAction(action: string): string {
  const known = ACTIONS[action] ?? ACTIONS[action.toLowerCase()];
  if (known) return known;
  const words = action.replace(/[._-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Activity';
}

/** Creates a random idempotency key; falls back to getRandomValues when randomUUID is unavailable. */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
