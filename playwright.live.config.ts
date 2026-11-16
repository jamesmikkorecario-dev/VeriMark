import { defineConfig, devices } from '@playwright/test';
import { readHostedEnvironment } from './supabase/hosted/environment';
import { readHostedConfig } from './supabase/hosted/fixtures';

// Browser journeys through the real application, separate from the demonstration-mode suite in e2e/.
//   LIVE_TARGET=demo   (default) the same journeys against the in-browser demonstration adapter: a rehearsal that writes nothing anywhere.
//   LIVE_TARGET=hosted the separately approved disposable Supabase project from .env.hosted-test.local.
// See e2e-live/README.md. One worker: journeys share two test organizations and must not race each other.
const hosted = process.env.LIVE_TARGET === 'hosted';
const checked = hosted ? readHostedConfig(readHostedEnvironment()) : null;
if (checked && !checked.config) throw new Error(`Hosted execution refused: ${checked.problems.join('; ')}`);
const port = Number(process.env.LIVE_PORT ?? (hosted ? 3611 : 3610));
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './e2e-live',
  outputDir: './test-results-live',
  preserveOutput: hosted ? 'never' : 'always',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: hosted ? 90_000 : 45_000,
  expect: { timeout: hosted ? 15_000 : 7_000 },
  globalSetup: './e2e-live/global-setup.ts',
  reporter: hosted ? [['./e2e-live/safe-reporter.ts']] : [['list'], ['json', { outputFile: 'test-results-live/report.json' }]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'off', screenshot: hosted ? 'off' : 'only-on-failure', video: 'off', ...(channel ? { channel } : {}) },
  projects: [
    { name: 'live-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'live-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run dev -- --config e2e-live/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    // The test server disables all .env loading and receives only the validated disposable credentials.
    env: { VITE_SUPABASE_URL: checked?.config?.url ?? '', VITE_SUPABASE_PUBLISHABLE_KEY: checked?.config?.key ?? '' },
  },
});
