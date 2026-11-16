import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

/** Test credentials never fall back to the application's .env.local or ambient VITE variables. */
export function readHostedEnvironment(directory = process.cwd(), ambient = process.env): Record<string, string | undefined> {
  const path = resolve(directory, '.env.hosted-test.local');
  const file = existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
  return Object.fromEntries(Object.entries({ ...file, ...ambient }).filter(([key]) => key === 'VM_HOSTED_TESTS' || key.startsWith('VM_TEST_')));
}
