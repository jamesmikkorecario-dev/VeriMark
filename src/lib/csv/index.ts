// CSV support for VeriMark issuance. Pure functions only: cell contents are data and are never evaluated.
import type { DraftRowInput } from '../api/types';

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_BATCH_ROWS = 200;
export const LIMITS = { recipientDisplayName: 200, title: 200, achievement: 2000, recipientEmail: 254 } as const;

/** Error codes used for CSV and form validation. Field-level codes match the backend's FieldError codes. */
export type RowErrorCode =
  | 'REQUIRED' | 'TOO_LONG' | 'INVALID' | 'INVALID_DATE' | 'PAST_DATE' | 'DUPLICATE' | 'COLUMN_COUNT'
  | 'MISSING_COLUMN' | 'UNKNOWN_COLUMN' | 'DUPLICATE_COLUMN' | 'NO_ROWS' | 'TOO_MANY_ROWS' | 'MALFORMED' | 'FILE_TOO_LARGE' | 'EMPTY_FILE';

/** `row` is the 1-based data row (row 1 is the first record after the header); 0 means the header or the whole file. */
export interface CsvRowError { row: number; field: string; code: RowErrorCode }
export interface RecipientCsvResult { rows: DraftRowInput[]; errors: CsvRowError[] }

export class CsvSyntaxError extends Error {
  readonly record: number;
  constructor(record: number) { super(`Malformed CSV near record ${record}`); this.name = 'CsvSyntaxError'; this.record = record; }
}

/**
 * RFC 4180 parser: comma separated, double-quoted fields, "" escapes, CRLF / LF / CR line endings,
 * embedded line breaks inside quotes, and a leading UTF-8 byte-order mark. Throws CsvSyntaxError on an
 * unterminated quote or on text following a closing quote. A trailing line break does not create a record.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let i = 0;
  let quoted = false;
  let afterQuote = false;
  let fieldStarted = false;
  const endField = () => { record.push(field); field = ''; afterQuote = false; fieldStarted = false; };
  const endRecord = () => { endField(); records.push(record); record = []; };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; afterQuote = true; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === ',') { endField(); i += 1; continue; }
    if (ch === '\r' || ch === '\n') {
      endRecord();
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (afterQuote) throw new CsvSyntaxError(records.length + 1);
    if (ch === '"' && !fieldStarted) { quoted = true; fieldStarted = true; i += 1; continue; }
    field += ch; fieldStarted = true; i += 1;
  }
  if (quoted) throw new CsvSyntaxError(records.length + 1);
  if (fieldStarted || afterQuote || record.length > 0) endRecord();
  return records;
}

const REQUIRED_COLUMNS = ['recipient_name', 'title', 'achievement'] as const;
const OPTIONAL_COLUMNS = ['email', 'expires_on'] as const;
type Column = (typeof REQUIRED_COLUMNS)[number] | (typeof OPTIONAL_COLUMNS)[number];
const KNOWN_COLUMNS: readonly string[] = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

/** CSV column for each DraftRowInput field, and back. */
export const CSV_COLUMN_FOR_FIELD: Record<keyof DraftRowInput, Column> = {
  recipientDisplayName: 'recipient_name', title: 'title', achievement: 'achievement', recipientEmail: 'email', expiresOn: 'expires_on',
};
export const FIELD_FOR_CSV_COLUMN: Record<Column, keyof DraftRowInput> = {
  recipient_name: 'recipientDisplayName', title: 'title', achievement: 'achievement', email: 'recipientEmail', expires_on: 'expiresOn',
};

const EMAIL_SHAPE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/;
const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's calendar date in UTC as YYYY-MM-DD. */
export function todayUtc(now: Date = new Date()): string { return now.toISOString().slice(0, 10); }

/** Validates a YYYY-MM-DD date: real calendar date strictly after `today` (UTC). Returns an error code or null. */
export function checkExpiryDate(value: string, today: string = todayUtc()): 'INVALID_DATE' | 'PAST_DATE' | null {
  const match = DATE_SHAPE.exec(value);
  if (!match) return 'INVALID_DATE';
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return 'INVALID_DATE';
  return value > today ? null : 'PAST_DATE';
}

export interface FieldIssue { field: keyof DraftRowInput; code: RowErrorCode }

/** Shared validation for the single form, CSV rows and replacements. Expects already-trimmed values. */
export function validateDraftRow(row: DraftRowInput, today: string = todayUtc()): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const text = (field: 'recipientDisplayName' | 'title' | 'achievement') => {
    const value = row[field];
    if (!value) issues.push({ field, code: 'REQUIRED' });
    else if (value.length > LIMITS[field]) issues.push({ field, code: 'TOO_LONG' });
  };
  text('recipientDisplayName'); text('title'); text('achievement');
  if (row.recipientEmail) {
    if (row.recipientEmail.length > LIMITS.recipientEmail) issues.push({ field: 'recipientEmail', code: 'TOO_LONG' });
    else if (!EMAIL_SHAPE.test(row.recipientEmail)) issues.push({ field: 'recipientEmail', code: 'INVALID' });
  }
  if (row.expiresOn) {
    const code = checkExpiryDate(row.expiresOn, today);
    if (code) issues.push({ field: 'expiresOn', code });
  }
  return issues;
}

/** Trims values and drops empty optional fields. */
export function normalizeDraftRow(row: DraftRowInput): DraftRowInput {
  const out: DraftRowInput = { recipientDisplayName: row.recipientDisplayName.trim(), title: row.title.trim(), achievement: row.achievement.trim() };
  const email = row.recipientEmail?.trim();
  const expires = row.expiresOn?.trim();
  if (email) out.recipientEmail = email;
  if (expires) out.expiresOn = expires;
  return out;
}

const duplicateKey = (row: DraftRowInput) => [row.recipientDisplayName, row.title, row.achievement]
  .map(value => value.normalize('NFC').replace(/\s+/g, ' ').toLowerCase()).join('\u0000');

/**
 * Parses and validates a recipient CSV. Reports every problem at once; `rows` is only safe to submit when
 * `errors` is empty. Fully blank records are ignored and do not count as rows.
 */
export function parseRecipientCsv(text: string, today: string = todayUtc()): RecipientCsvResult {
  const errors: CsvRowError[] = [];
  let records: string[][];
  try { records = parseCsv(text); } catch (error) {
    if (error instanceof CsvSyntaxError) return { rows: [], errors: [{ row: Math.max(0, error.record - 1), field: '', code: 'MALFORMED' }] };
    throw error;
  }
  const nonBlank = records.filter(record => record.some(cell => cell.trim() !== ''));
  if (nonBlank.length === 0) return { rows: [], errors: [{ row: 0, field: '', code: 'EMPTY_FILE' }] };

  const [header, ...data] = nonBlank;
  const columns = header.map(name => name.trim().toLowerCase());
  const seen = new Set<string>();
  columns.forEach(name => {
    if (!KNOWN_COLUMNS.includes(name)) errors.push({ row: 0, field: name, code: 'UNKNOWN_COLUMN' });
    else if (seen.has(name)) errors.push({ row: 0, field: name, code: 'DUPLICATE_COLUMN' });
    seen.add(name);
  });
  REQUIRED_COLUMNS.forEach(name => { if (!seen.has(name)) errors.push({ row: 0, field: name, code: 'MISSING_COLUMN' }); });
  if (errors.length) return { rows: [], errors };

  if (data.length === 0) return { rows: [], errors: [{ row: 0, field: '', code: 'NO_ROWS' }] };
  if (data.length > MAX_BATCH_ROWS) errors.push({ row: 0, field: '', code: 'TOO_MANY_ROWS' });

  const rows: DraftRowInput[] = [];
  const firstSeen = new Map<string, number>();
  data.forEach((record, index) => {
    const rowNumber = index + 1;
    if (record.length !== columns.length) {
      errors.push({ row: rowNumber, field: '', code: 'COLUMN_COUNT' });
      return;
    }
    const cell = (name: Column) => { const at = columns.indexOf(name); return at < 0 ? '' : record[at]; };
    const row = normalizeDraftRow({ recipientDisplayName: cell('recipient_name'), title: cell('title'), achievement: cell('achievement'), recipientEmail: cell('email'), expiresOn: cell('expires_on') });
    validateDraftRow(row, today).forEach(issue => errors.push({ row: rowNumber, field: CSV_COLUMN_FOR_FIELD[issue.field], code: issue.code }));
    if (row.recipientDisplayName && row.title && row.achievement) {
      const key = duplicateKey(row);
      if (firstSeen.has(key)) errors.push({ row: rowNumber, field: 'recipient_name', code: 'DUPLICATE' });
      else firstSeen.set(key, rowNumber);
    }
    rows.push(row);
  });
  return { rows, errors };
}

/** Checks the size before reading so an oversized file is never loaded into memory. */
export async function readRecipientCsvFile(file: Blob, today: string = todayUtc()): Promise<RecipientCsvResult> {
  if (file.size > MAX_CSV_BYTES) return { rows: [], errors: [{ row: 0, field: '', code: 'FILE_TOO_LARGE' }] };
  if (file.size === 0) return { rows: [], errors: [{ row: 0, field: '', code: 'EMPTY_FILE' }] };
  return parseRecipientCsv(await readBlobText(file), today);
}

function readBlobText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export type CsvCell = string | number | null | undefined;
const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutralises spreadsheet formula injection by prefixing a single quote. */
export function neutraliseCell(value: string): string { return FORMULA_START.test(value) ? `'${value}` : value; }

/** Serialises rows (the first row is usually the header) as RFC 4180 CSV with CRLF line endings. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  return rows.map(row => row.map(cell => {
    const value = neutraliseCell(cell === null || cell === undefined ? '' : String(cell));
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(',')).join('\r\n') + '\r\n';
}

/** A fictional sample file whose expiry date is always in the future. */
export function sampleRecipientCsv(now: Date = new Date()): string {
  const expires = `${now.getUTCFullYear() + 1}-12-31`;
  return toCsv([
    ['recipient_name', 'title', 'achievement', 'email', 'expires_on'],
    ['Rowan Example', 'Community First Aid', 'Completed the 12-hour community first aid course.', 'rowan@example.org', expires],
    ['Sam Placeholder', 'Volunteer Tutor Training', 'Completed tutor training, including "safe learning" practice.', '', ''],
  ]);
}
