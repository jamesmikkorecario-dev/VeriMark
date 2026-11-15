import { ApiError, type DraftRowInput, type FieldError, type TemplateConfig } from '../types';

export const LIMITS = {
  recipientDisplayName: 200, title: 200, achievement: 2000, reason: 1000,
  organizationName: 120, templateName: 120, heading: 120, bodyPrefix: 200, signatoryName: 120, signatoryTitle: 120,
  email: 254, displayName: 120, minPassword: 10, maxBatchRows: 200,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => value.length <= LIMITS.email && EMAIL.test(value);
export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export function checkText(errors: FieldError[], field: string, value: unknown, max: number, options: { row?: number; optional?: boolean } = {}): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const at = options.row === undefined ? {} : { row: options.row };
  if (!text) { if (!options.optional) errors.push({ field, code: 'REQUIRED', ...at }); }
  else if (text.length > max) errors.push({ field, code: 'TOO_LONG', ...at });
  return text;
}

export function fail(errors: FieldError[], message = 'Some details need attention.'): void {
  if (errors.length) throw new ApiError('VALIDATION', message, { fields: errors });
}

export function requireText(field: string, value: unknown, max: number): string {
  const errors: FieldError[] = [];
  const text = checkText(errors, field, value, max);
  fail(errors);
  return text;
}

/** Calendar date YYYY-MM-DD -> end of that UTC day, or null when it is not a real date. */
export function endOfUtcDay(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString();
}

export interface NormalRow { recipientDisplayName: string; title: string; achievement: string; recipientEmail: string | null; expiresOn: string | null }

export function normalizeRow(errors: FieldError[], input: DraftRowInput, now: Date, row?: number): NormalRow {
  const at = row === undefined ? {} : { row };
  const recipientDisplayName = checkText(errors, 'recipientDisplayName', input?.recipientDisplayName, LIMITS.recipientDisplayName, { row });
  const title = checkText(errors, 'title', input?.title, LIMITS.title, { row });
  const achievement = checkText(errors, 'achievement', input?.achievement, LIMITS.achievement, { row });
  const email = typeof input?.recipientEmail === 'string' ? normalizeEmail(input.recipientEmail) : '';
  if (email && !isEmail(email)) errors.push({ field: 'recipientEmail', code: 'INVALID', ...at });
  const expiresOn = typeof input?.expiresOn === 'string' ? input.expiresOn.trim() : '';
  if (expiresOn) {
    const end = endOfUtcDay(expiresOn);
    if (!end) errors.push({ field: 'expiresOn', code: 'INVALID', ...at });
    else if (new Date(end).getTime() <= now.getTime()) errors.push({ field: 'expiresOn', code: 'PAST_DATE', ...at });
  }
  return { recipientDisplayName, title, achievement, recipientEmail: email || null, expiresOn: expiresOn || null };
}

export function validateTemplateConfig(errors: FieldError[], config: TemplateConfig | undefined): TemplateConfig {
  const c = (config ?? {}) as Partial<TemplateConfig>;
  const heading = checkText(errors, 'config.heading', c.heading, LIMITS.heading);
  const bodyPrefix = checkText(errors, 'config.bodyPrefix', c.bodyPrefix, LIMITS.bodyPrefix);
  const signatoryName = checkText(errors, 'config.signatoryName', c.signatoryName, LIMITS.signatoryName);
  const signatoryTitle = checkText(errors, 'config.signatoryTitle', c.signatoryTitle, LIMITS.signatoryTitle, { optional: true });
  if (!['forest', 'ink', 'ochre'].includes(c.accent as string)) errors.push({ field: 'config.accent', code: 'INVALID' });
  if (!['landscape', 'portrait'].includes(c.orientation as string)) errors.push({ field: 'config.orientation', code: 'INVALID' });
  return { heading, bodyPrefix, signatoryName, signatoryTitle, accent: c.accent as TemplateConfig['accent'], orientation: c.orientation as TemplateConfig['orientation'] };
}
