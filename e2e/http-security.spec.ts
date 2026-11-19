import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { build, preview, type PreviewServer, type Plugin } from 'vite';
import { DEMO_PUBLIC_IDS } from './app-helpers';

// Browser enforcement of the vercel.json header policy against a PRODUCTION build. The shared suite runs the Vite dev
// server, which injects inline scripts and style elements and never applies vercel.json, so this spec builds into a
// temporary directory and serves it with `vite preview` on its own port, adding the headers vercel.json resolves for
// each request path. This is a local emulation of the configuration: it shows the built UI works under the policy in
// Chromium. It is not evidence of what a Vercel deployment sends (see docs/security/hardening/HTTP-SECURITY.md).
// The build is forced onto the demonstration adapter (empty envDir and blanked VITE_* variables in this worker, which Vite
// would otherwise copy into the bundle) and every request leaving 127.0.0.1 is aborted.

const port = Number(process.env.HTTP_SECURITY_PORT ?? 3653);
const origin = `http://127.0.0.1:${port}`;
const root = fileURLToPath(new URL('../', import.meta.url));

interface HeaderRule { source: string; headers: { key: string; value: string }[] }
let rules: HeaderRule[] = [];

// Same restricted source grammar as supabase/tests/http-security.test.ts (which asserts every source parses).
function sourceToRegExp(source: string): RegExp {
  let pattern = '';
  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    if (source[i] === '(') {
      let depth = 0; let j = i;
      for (; j < source.length; j++) { if (source[j] === '(') depth++; else if (source[j] === ')' && --depth === 0) break; }
      pattern += source.slice(i, j + 1); i = j + 1;
    } else if (rest.startsWith('/:')) { pattern += '(?:/.*)?'; i = source.length; }
    else { pattern += source[i]; i++; }
  }
  return new RegExp(`^${pattern}/?$`);
}
function headersFor(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rule of rules) if (sourceToRegExp(rule.source).test(path)) for (const { key, value } of rule.headers) result[key] = value;
  return result;
}
const vercelHeaders: Plugin = {
  name: 'verimark-vercel-headers',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = new URL(req.url ?? '/', origin).pathname;
      for (const [key, value] of Object.entries(headersFor(path))) res.setHeader(key, value);
      next();
    });
  },
};

let server: PreviewServer | undefined;
let outDir = '';

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  if (test.info().project.name !== 'chromium-1440') return;
  rules = (JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8')) as { headers: HeaderRule[] }).headers;
  outDir = await mkdtemp(join(tmpdir(), 'verimark-http-'));
  // Vite copies VITE_* variables from this worker's own environment into the build: blank the Supabase ones and build
  // exactly the public demo release mode (`npm run build:demo`), with the Supabase adapter compiled out.
  process.env.VITE_SUPABASE_URL = ''; process.env.VITE_SUPABASE_PUBLISHABLE_KEY = ''; process.env.VITE_DEMO_ONLY = 'true';
  const envDir = await mkdtemp(join(tmpdir(), 'verimark-http-env-')); // empty: no .env file can select a hosted backend
  try {
    const shared = { root, configFile: join(root, 'vite.config.ts'), envDir, logLevel: 'warn' as const, plugins: [vercelHeaders] };
    await build({ ...shared, build: { outDir, emptyOutDir: true } });
    server = await preview({ ...shared, build: { outDir }, preview: { host: '127.0.0.1', port, strictPort: true } });
  } finally {
    await rm(envDir, { recursive: true, force: true });
  }
});
test.afterAll(async () => {
  await server?.close();
  if (outDir) await rm(outDir, { recursive: true, force: true });
});
/** Every request the site tried to send anywhere but the local preview (aborted, then asserted empty). */
let outside: string[] = [];
test.beforeEach(async ({ context }, info) => {
  test.skip(info.project.name !== 'chromium-1440', 'Runs once: builds and serves its own production preview.');
  outside = [];
  await context.route(url => !url.href.startsWith(origin + '/') && !/^(data|blob):/.test(url.href), route => {
    outside.push(new URL(route.request().url()).origin);
    return route.abort();
  });
});
// The demo build has no backend: it must never even try to reach another host (Supabase or anything else).
test.afterEach(() => { expect(outside).toEqual([]); });

/** Records CSP violations and browser policy complaints for the page's whole life. */
async function watch(page: Page) {
  const problems: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => {
      (window as unknown as { __violations: string[] }).__violations ??= [];
      (window as unknown as { __violations: string[] }).__violations.push(`${e.effectiveDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`);
    });
  });
  page.on('console', message => {
    if (/Content Security Policy|Permissions-Policy|Unrecognized feature|Refused to/i.test(message.text())) problems.push(message.text());
  });
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  return {
    problems,
    async violations() { return page.evaluate(() => (window as unknown as { __violations?: string[] }).__violations ?? []); },
  };
}
async function visit(page: Page, path: string) {
  await page.goto(origin + path);
  await expect(page.locator('#root')).not.toBeEmpty();
}

test('the preview serves the vercel.json headers for each path', async ({ request }) => {
  const shell = await request.get(origin + '/verify/' + DEMO_PUBLIC_IDS.valid);
  expect(shell.status()).toBe(200);
  expect(shell.headers()['content-security-policy']).toBe(headersFor('/verify/x')['Content-Security-Policy']);
  expect(shell.headers()['x-frame-options']).toBe('DENY');
  const receive = await request.get(origin + '/receive');
  expect(receive.headers()['referrer-policy']).toBe('no-referrer');
  const html = await shell.text();
  expect(html).not.toMatch(/<style\b|\sstyle=|<script(?![^>]*\ssrc=)[^>]*>/i);
});

test('public, recipient, invitation and auth pages render with no policy violation', async ({ page }) => {
  const seen = await watch(page);
  await visit(page, '/');
  await visit(page, '/verify');
  await visit(page, '/verify/' + DEMO_PUBLIC_IDS.valid);
  await expect(page.getByRole('heading', { name: 'Valid record', exact: true })).toBeVisible();
  for (const id of [DEMO_PUBLIC_IDS.revoked, DEMO_PUBLIC_IDS.replaced, DEMO_PUBLIC_IDS.expired]) await visit(page, '/verify/' + id);
  for (const path of ['/sign-up', '/reset-password', '/update-password', '/demo', '/workspace', '/no-such-page']) await visit(page, path);
  await visit(page, '/receive#' + 'x'.repeat(43));
  await expect(page.getByRole('heading', { name: 'Access link unavailable' })).toBeVisible();
  await visit(page, '/invite#' + 'x'.repeat(43));
  expect(await seen.violations()).toEqual([]);
  expect(seen.problems).toEqual([]);
});

test('workspace, certificate PDF, recipient link and mobile navigation work under the policy', async ({ page }) => {
  const seen = await watch(page);
  // The shared login()/logout() helpers resolve URLs against the dev-server baseURL; this spec stays on its own origin.
  await page.goto(origin + '/sign-in');
  await page.getByLabel('Email address').fill('issuer@demo.verimark.test');
  await page.getByLabel('Password', { exact: true }).fill('demo-password-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\/.*)?$/);
  for (const path of ['/app/credentials', '/app/issue', '/app/templates', '/app/activity', '/app/organization']) {
    await page.goto(origin + path); await expect(page.getByRole('main')).toBeVisible();
  }
  await page.goto(origin + '/app/credentials/cred_demo_valid');
  await page.getByRole('button', { name: 'Create recipient link', exact: true }).click();
  await page.getByRole('button', { name: 'Create link', exact: true }).click();
  const link = await page.getByLabel('Private recipient link').inputValue();
  expect(link.startsWith(origin + '/receive#')).toBe(true);
  await page.setViewportSize({ width: 390, height: 900 });
  const open = page.getByRole('button', { name: 'Open workspace navigation' });
  await open.click();
  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toHaveCount(0);
  await open.click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(origin + '/sign-in');
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Your certificate' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download certificate (PDF)', exact: true }).click();
  expect((await readFile((await (await download).path())!)).subarray(0, 4).toString()).toBe('%PDF');
  expect(await seen.violations()).toEqual([]);
  expect(seen.problems).toEqual([]);
});

// eval is not probed here: page.evaluate runs through DevTools, which Chromium exempts from the eval check. The
// configuration test asserts that no directive allows 'unsafe-eval'.
test('the policy is enforced: inline script, style elements and style attributes are refused; CSSOM is not', async ({ page }) => {
  const seen = await watch(page);
  await visit(page, '/verify/' + DEMO_PUBLIC_IDS.valid);
  const outcome = await page.evaluate(() => {
    const w = window as unknown as { __inline?: boolean };
    const script = document.createElement('script'); script.textContent = 'window.__inline = true'; document.head.append(script);
    const style = document.createElement('style'); style.textContent = 'body { scroll-margin-bottom: 7px }'; document.head.append(style);
    const element = getComputedStyle(document.body).scrollMarginBottom;
    document.body.setAttribute('style', 'scroll-margin-top: 1px'); // refused: style-src 'self' has no 'unsafe-inline'
    const attr = getComputedStyle(document.body).scrollMarginTop;
    document.body.removeAttribute('style');
    document.body.style.cssText = 'scroll-margin-left: 2px'; // allowed: CSSOM, the setter Navigation restores styles with
    const cssom = getComputedStyle(document.body).scrollMarginLeft;
    document.body.removeAttribute('style');
    return { inline: w.__inline === true, element, attr, cssom };
  });
  expect(outcome).toEqual({ inline: false, element: '0px', attr: '0px', cssom: '2px' });
  const directives = (await seen.violations()).map(v => v.split(' ')[0]);
  expect(directives).toEqual(expect.arrayContaining(['script-src-elem', 'style-src-elem', 'style-src-attr']));

  // The embedding document is about:blank (no policy of its own), so only the framed response's headers can refuse it.
  const framed = await page.context().newPage();
  const refused: string[] = [];
  framed.on('console', m => { if (/frame-ancestors|X-Frame-Options|Refused to (display|frame)/i.test(m.text())) refused.push(m.text()); });
  await framed.setContent(`<iframe src="${origin}/verify/${DEMO_PUBLIC_IDS.valid}"></iframe>`);
  await expect.poll(() => refused.length).toBeGreaterThan(0);
});
