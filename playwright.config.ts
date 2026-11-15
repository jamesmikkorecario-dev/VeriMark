import { defineConfig, devices } from '@playwright/test';

// Opt in to an installed browser when the bundled Chromium cannot launch.
// PowerShell: $env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e
// Alternatively set PLAYWRIGHT_EXECUTABLE_PATH to a compatible local executable.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const channel = process.env.PLAYWRIGHT_CHANNEL;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
if (channel && executablePath) throw new Error('Set only PLAYWRIGHT_CHANNEL or PLAYWRIGHT_EXECUTABLE_PATH');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(channel ? { channel } : {}),
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [320, 390, 440, 768, 1024, 1440, 1920].map(width => ({
    name: 'chromium-' + width,
    use: { ...devices['Desktop Chrome'], viewport: { width, height: width === 440 ? 956 : 900 } },
  })),
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});


