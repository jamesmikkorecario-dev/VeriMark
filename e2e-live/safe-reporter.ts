import { mkdirSync, writeFileSync } from 'node:fs';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/** Hosted failures can contain passwords or bearer links. Persist only static locations and statuses, never errors,
 * stdout, attachments, DOM snapshots or assertion values. Diagnose failed locations using fictional local rehearsal. */
export default class SafeReporter implements Reporter {
  private results: { file: string; line: number; status: string; expectedStatus: string }[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    this.results.push({ file: test.location.file, line: test.location.line, status: result.status, expectedStatus: test.expectedStatus });
    console.log(`${result.status}: ${test.location.file}:${test.location.line}`);
  }
  onError() { console.error('Hosted runner failed; error details suppressed to protect credentials. Check configuration and local rehearsal.'); }
  onEnd(result: FullResult) {
    mkdirSync('test-results-live', { recursive: true });
    writeFileSync('test-results-live/hosted-summary.json', JSON.stringify({ status: result.status, tests: this.results }, null, 2));
    console.log(`Hosted result: ${result.status}. Secret-free evidence: test-results-live/hosted-summary.json`);
  }
}
