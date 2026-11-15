import { describe, expect, it } from 'vitest';
import { checkExpiryDate, MAX_CSV_BYTES, neutraliseCell, parseCsv, parseRecipientCsv, readRecipientCsvFile, sampleRecipientCsv, toCsv, validateDraftRow } from '.';

const TODAY = '2026-11-16';
const HEADER = 'recipient_name,title,achievement,email,expires_on';
const csv = (...lines: string[]) => lines.join('\n');

describe('parseCsv', () => {
  it('parses quoted fields, escaped quotes, embedded newlines and commas', () => {
    expect(parseCsv('a,"b, c","say ""hi""","line1\nline2"\r\nx,y,z,w')).toEqual([
      ['a', 'b, c', 'say "hi"', 'line1\nline2'],
      ['x', 'y', 'z', 'w'],
    ]);
  });
  it('accepts CRLF, LF and CR line endings and strips a BOM', () => {
    expect(parseCsv('﻿a,b\r\nc,d\ne,f\rg,h')).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']]);
  });
  it('does not create a record for a trailing line break but keeps trailing empty fields', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
    expect(parseCsv('a,\n')).toEqual([['a', '']]);
    expect(parseCsv('a,')).toEqual([['a', '']]);
    expect(parseCsv('"",""')).toEqual([['', '']]);
  });
  it('rejects an unterminated quote and text after a closing quote', () => {
    expect(() => parseCsv('a,"open\nb')).toThrow(/Malformed/);
    expect(() => parseCsv('"a"b,c')).toThrow(/Malformed/);
  });
  it('treats a quote inside an unquoted field as data and never evaluates content', () => {
    expect(parseCsv('5" pipe,=1+1')).toEqual([['5" pipe', '=1+1']]);
  });
});

describe('parseRecipientCsv', () => {
  it('maps a valid file to draft rows, case-insensitive header and optional columns', () => {
    const result = parseRecipientCsv(csv('Recipient_Name, TITLE ,Achievement,Email,Expires_On', 'Rowan Example,First Aid,"Completed, with merit",rowan@example.org,2027-03-01', 'Sam Placeholder,Tutor,Done,,'), TODAY);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { recipientDisplayName: 'Rowan Example', title: 'First Aid', achievement: 'Completed, with merit', recipientEmail: 'rowan@example.org', expiresOn: '2027-03-01' },
      { recipientDisplayName: 'Sam Placeholder', title: 'Tutor', achievement: 'Done' },
    ]);
  });
  it('accepts the required columns only, in any order', () => {
    const result = parseRecipientCsv(csv('achievement,recipient_name,title', 'Done,Rowan,First Aid'), TODAY);
    expect(result).toEqual({ rows: [{ recipientDisplayName: 'Rowan', title: 'First Aid', achievement: 'Done' }], errors: [] });
  });
  it('rejects unknown, duplicate and missing columns without reading rows', () => {
    const result = parseRecipientCsv(csv('recipient_name,title,notes,title', 'a,b,c,d'), TODAY);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { row: 0, field: 'notes', code: 'UNKNOWN_COLUMN' },
      { row: 0, field: 'title', code: 'DUPLICATE_COLUMN' },
      { row: 0, field: 'achievement', code: 'MISSING_COLUMN' },
    ]);
  });
  it('requires at least one data row and at most 200', () => {
    expect(parseRecipientCsv(HEADER + '\n\n', TODAY).errors).toEqual([{ row: 0, field: '', code: 'NO_ROWS' }]);
    expect(parseRecipientCsv('', TODAY).errors).toEqual([{ row: 0, field: '', code: 'EMPTY_FILE' }]);
    const rows = Array.from({ length: 201 }, (_, i) => `Person ${i},Title,Achievement`);
    const result = parseRecipientCsv(csv('recipient_name,title,achievement', ...rows), TODAY);
    expect(result.errors).toContainEqual({ row: 0, field: '', code: 'TOO_MANY_ROWS' });
    const exactly200 = parseRecipientCsv(csv('recipient_name,title,achievement', ...rows.slice(0, 200)), TODAY);
    expect(exactly200.errors).toEqual([]);
    expect(exactly200.rows).toHaveLength(200);
  });
  it('reports every row error at once with 1-based data row numbers', () => {
    const result = parseRecipientCsv(csv(HEADER,
      ',Title,Achievement,,',
      `Name,${'t'.repeat(201)},Achievement,not-an-email,`,
      `Name,Title,${'a'.repeat(2001)},,2026-11-16`,
      'Name,Title,Achievement,,2027-02-30',
      'Other,Title,Achievement,,27-01-01',
      'only,three,cells',
    ), TODAY);
    expect(result.errors).toEqual([
      { row: 1, field: 'recipient_name', code: 'REQUIRED' },
      { row: 2, field: 'title', code: 'TOO_LONG' },
      { row: 2, field: 'email', code: 'INVALID' },
      { row: 3, field: 'achievement', code: 'TOO_LONG' },
      { row: 3, field: 'expires_on', code: 'PAST_DATE' },
      { row: 4, field: 'expires_on', code: 'INVALID_DATE' },
      { row: 5, field: 'expires_on', code: 'INVALID_DATE' },
      { row: 6, field: '', code: 'COLUMN_COUNT' },
    ]);
  });
  it('accepts values exactly at the length limits', () => {
    const result = parseRecipientCsv(csv('recipient_name,title,achievement', `${'n'.repeat(200)},${'t'.repeat(200)},${'a'.repeat(2000)}`), TODAY);
    expect(result.errors).toEqual([]);
  });
  it('flags duplicate recipient + title + achievement rows, ignoring case and spacing', () => {
    const result = parseRecipientCsv(csv('recipient_name,title,achievement', 'Rowan Example,First Aid,Done', 'Sam,First Aid,Done', 'rowan  example,FIRST AID, done'), TODAY);
    expect(result.errors).toEqual([{ row: 3, field: 'recipient_name', code: 'DUPLICATE' }]);
  });
  it('reports malformed quoting as a file error', () => {
    expect(parseRecipientCsv(csv('recipient_name,title,achievement', '"Rowan,First Aid,Done'), TODAY).errors).toEqual([{ row: 1, field: '', code: 'MALFORMED' }]);
  });
  it('ignores blank lines and keeps formula-like text as plain data', () => {
    const result = parseRecipientCsv(csv('recipient_name,title,achievement', '', '=HYPERLINK("x"),+Title,@Done', ''), TODAY);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual({ recipientDisplayName: '=HYPERLINK("x")', title: '+Title', achievement: '@Done' });
  });
});

describe('readRecipientCsvFile', () => {
  it('rejects files over 2 MiB before reading them', async () => {
    const file = new File(['x'], 'big.csv');
    Object.defineProperty(file, 'size', { value: MAX_CSV_BYTES + 1 });
    let read = false;
    Object.defineProperty(file, 'text', { value: () => { read = true; return Promise.resolve(''); } });
    expect(await readRecipientCsvFile(file, TODAY)).toEqual({ rows: [], errors: [{ row: 0, field: '', code: 'FILE_TOO_LARGE' }] });
    expect(read).toBe(false);
  });
  it('reads and validates a file', async () => {
    const file = new File(['﻿recipient_name,title,achievement\r\nRowan,First Aid,Done\r\n'], 'ok.csv', { type: 'text/csv' });
    expect((await readRecipientCsvFile(file, TODAY)).rows).toHaveLength(1);
  });
});

describe('validation helpers', () => {
  it('checks real future calendar dates', () => {
    expect(checkExpiryDate('2026-11-17', TODAY)).toBeNull();
    expect(checkExpiryDate('2026-11-16', TODAY)).toBe('PAST_DATE');
    expect(checkExpiryDate('2028-02-29', TODAY)).toBeNull();
    expect(checkExpiryDate('2027-02-29', TODAY)).toBe('INVALID_DATE');
    expect(checkExpiryDate('2027-1-01', TODAY)).toBe('INVALID_DATE');
  });
  it('validates required fields and e-mail shape for single rows', () => {
    expect(validateDraftRow({ recipientDisplayName: '', title: 'T', achievement: '', recipientEmail: 'a@b' }, TODAY)).toEqual([
      { field: 'recipientDisplayName', code: 'REQUIRED' },
      { field: 'achievement', code: 'REQUIRED' },
      { field: 'recipientEmail', code: 'INVALID' },
    ]);
  });
});

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks and uses CRLF', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'x\ny', null, 3]])).toBe('a,"b,c","say ""hi""","x\ny",,3\r\n');
  });
  it('neutralises formula cells', () => {
    expect(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx', 'safe'].map(neutraliseCell)).toEqual(["'=1+1", "'+1", "'-1", "'@SUM(A1)", "'\tx", "'\rx", 'safe']);
    expect(toCsv([['=cmd|"/c calc"!A1']])).toBe(`"'=cmd|""/c calc""!A1"\r\n`);
    expect(toCsv([['\rboom']])).toBe(`"'\rboom"\r\n`);
  });
  it('round-trips through the parser (apart from neutralised cells)', () => {
    const rows = [['public_id', 'name'], ['VM-1', 'Ana, "Rowan"\nExample']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it('produces a sample file that passes validation', () => {
    const result = parseRecipientCsv(sampleRecipientCsv(new Date('2026-11-16T00:00:00Z')), TODAY);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });
});
