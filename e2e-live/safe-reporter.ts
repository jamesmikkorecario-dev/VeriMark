import { mkdirSync, writeFileSync } from 'node:fs';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** Removes every known test secret and anything shaped like a credential, token or private link from error text. */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text.replace(ANSI, '');
  for (const secret of [...secrets].filter(s => s.length >= 8).sort((a, b) => b.length - a.length)) out = out.split(secret).join('[redacted]');
  return out
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[redacted-jwt]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[redacted-key]')
    .replace(/#[^\s"'`)]{16,}/g, '#[redacted-fragment]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted-token]');
}

/** The password and live session tokens global setup handed to the workers. */
function knownSecrets(): string[] {
  try {
    const state = JSON.parse(process.env.LIVE_STATE ?? 'null') as { password?: string; storage?: Record<string, { origins: { localStorage: { value: string }[] }[] }> | null } | null;
    const secrets = state?.password ? [state.password] : [];
    for (const persona of Object.values(state?.storage ?? {})) for (const origin of persona.origins) for (const item of origin.localStorage) {
      const session = JSON.parse(item.value) as { access_token?: string; refresh_token?: string };
      for (const value of [session.access_token, session.refresh_token]) if (value) secrets.push(value);
    }
    return secrets;
  } catch { return []; }
}

/** Hosted failures can contain passwords or bearer links. Persists statuses plus redacted, truncated error text only;
 * never stdout, attachments, DOM snapshots, traces or screenshots. */
export default class SafeReporter implements Reporter {
  private results: { file: string; line: number; status: string; expectedStatus: string; error?: string }[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    const raw = result.errors.map(e => e.message ?? '').join('\n').trim();
    const error = raw ? redact(raw, knownSecrets()).slice(0, 2000) : undefined;
    this.results.push({ file: test.location.file, line: test.location.line, status: result.status, expectedStatus: test.expectedStatus, ...(error ? { error } : {}) });
    console.log(`${result.status}: ${test.location.file}:${test.location.line}${error ? `\n${error}` : ''}`);
  }
  onError() { console.error('Hosted runner failed; error details suppressed to protect credentials. Check configuration and local rehearsal.'); }
  onEnd(result: FullResult) {
    mkdirSync('test-results-live', { recursive: true });
    writeFileSync('test-results-live/hosted-summary.json', JSON.stringify({ status: result.status, tests: this.results }, null, 2));
    console.log(`Hosted result: ${result.status}. Redacted evidence: test-results-live/hosted-summary.json`);
  }
}
