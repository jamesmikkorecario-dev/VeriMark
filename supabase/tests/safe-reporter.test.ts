import { describe, expect, it } from 'vitest';
import { redact } from '../../e2e-live/safe-reporter';

describe('hosted reporter redaction (no network)', () => {
  const password = 'Fictional-Pass-1234567890';
  it('removes the test password, JWTs, keys, private link fragments and long tokens but keeps the diagnosis', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl';
    const message = [
      '\x1b[31mexpect(page).toHaveURL(expected) failed\x1b[39m',
      `  - fill("${password}")`,
      `  Authorization: Bearer ${jwt}`,
      '  apikey sb_publishable_AbC123_xyz and sb_secret_AbC123_xyz',
      '  navigated to "http://127.0.0.1:3611/receive#Zk3vQ9pL2mX8rT5yU7wE1aS4dF6gH0jK"',
      `  refresh ${'r'.repeat(48)}`,
    ].join('\n');
    const out = redact(message, [password]);
    for (const leaked of [password, jwt, 'sb_publishable_AbC123', 'sb_secret_AbC123', 'Zk3vQ9pL2mX8rT5yU7wE1aS4dF6gH0jK', 'r'.repeat(48), '\x1b[']) expect(out).not.toContain(leaked);
    expect(out).toContain('toHaveURL(expected) failed');
    expect(out).toContain('http://127.0.0.1:3611/receive');
  });
  it('redacts a secret even when one known secret contains another', () => {
    expect(redact('a Fictional-Pass-1234567890-suffix b', ['Fictional-Pass-1234567890', 'Fictional-Pass-1234567890-suffix'])).toBe('a [redacted] b');
  });
});
