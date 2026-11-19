import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
  installCommand: string; buildCommand: string; outputDirectory: string;
  headers: { source: string; headers: { key: string; value: string }[] }[];
  rewrites: { source: string; destination: string }[];
};

// Configuration assertions only. This intentionally supports only the existing
// regex sources, not Vercel's full routing engine or its deployed CDN behavior.
function headersFor(url: string) {
  const path = new URL(url, 'https://verimark.example').pathname;
  const headers: Record<string, string> = {};
  for (const rule of config.headers) {
    if (new RegExp(`^${rule.source}$`).test(path)) {
      for (const { key, value } of rule.headers) headers[key.toLowerCase()] = value;
    }
  }
  return headers;
}

const documents = [
  '/', '/index.html', '/verify', '/verify/VM-AAAA-1111',
  '/verify/VM-AAAA-1111?source=qr', '/verify/',
  '/receive', '/receive/', '/receive#fictional-capability',
  '/invite', '/invite/', '/invite#fictional-capability',
  '/app', '/app/', '/app/credentials/fictional-id', '/app/review',
  '/sign-in', '/sign-up', '/reset-password', '/update-password',
  '/update-password?code=fictional', '/unknown-route',
];
const PERMISSIONS = 'accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), payment=(), serial=(), usb=()';

describe('HTTP security configuration (not runtime platform evidence)', () => {
  test.each(documents)('%s forbids response storage and referrer disclosure', path => {
    expect(headersFor(path)).toMatchObject({
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    });
  });

  test.each(['/assets/index-AbCd1234.js', '/assets/index-AbCd1234.css'])('%s retains immutable caching and security headers', path => {
    expect(headersFor(path)).toMatchObject({
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'permissions-policy': PERMISSIONS,
      'cross-origin-resource-policy': 'same-origin',
    });
  });

  test('global controls keep strict script, style, framing, MIME, device and cross-origin restrictions', () => {
    const headers = headersFor('/verify/VM-AAAA-1111');
    expect(headers).toMatchObject({
      'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
      'permissions-policy': PERMISSIONS,
      'strict-transport-security': 'max-age=63072000; includeSubDomains',
      'cross-origin-opener-policy': 'same-origin', 'cross-origin-resource-policy': 'same-origin',
    });
    const directives = Object.fromEntries(headers['content-security-policy'].split(';').map(d => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values.join(' ')];
    }));
    expect(directives).toEqual({
      'default-src': "'self'", 'script-src': "'self'", 'style-src': "'self'", 'img-src': "'self' data: blob:",
      'font-src': "'self'", 'connect-src': "'self' https://*.supabase.co", 'frame-src': "'none'",
      'object-src': "'none'", 'base-uri': "'self'", 'form-action': "'self'",
      'frame-ancestors': "'none'", 'upgrade-insecure-requests': '',
    });
    // No inline script/style or eval escape hatch anywhere in the policy.
    expect(headers['content-security-policy']).not.toMatch(/unsafe-/);
  });

  test('SPA fallback still covers deep links and excludes build assets', () => {
    expect(config.rewrites).toEqual([{ source: '/((?!assets/).*)', destination: '/index.html' }]);
    const pattern = new RegExp(`^${config.rewrites[0].source}$`);
    for (const path of documents) expect(pattern.test(new URL(path, 'https://verimark.example').pathname)).toBe(true);
    expect(pattern.test('/assets/index-AbCd1234.js')).toBe(false);
  });

  test('only build assets can override the default no-store policy', () => {
    expect(config.headers.map(rule => rule.source)).toEqual(['/(.*)', '/assets/(.*)']);
    for (const rule of config.headers) {
      const keys = rule.headers.map(header => header.key.toLowerCase());
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test('the deployment installs locked dependencies and builds the demo-only release (Supabase compiled out)', () => {
    expect({ installCommand: config.installCommand, buildCommand: config.buildCommand, outputDirectory: config.outputDirectory })
      .toEqual({ installCommand: 'npm ci', buildCommand: 'npm run build:demo', outputDirectory: 'dist' });
  });
});
