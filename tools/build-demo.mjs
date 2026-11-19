/* global process, console */
// Builds the public portfolio demonstration: fictional data in the visitor's own browser, no backend.
//   npm run build:demo
// Refuses to start if Supabase variables are set in the environment (a mis-configured hosting project), builds with
// VITE_DEMO_ONLY=true so the Supabase adapter is compiled out, then scans dist/ and fails on anything that could reach or
// identify a Supabase project. Never prints variable values.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const fail = message => { console.error(`build:demo refused: ${message}`); process.exit(1); };

// Any VITE_* variable naming Supabase would be embedded in the public bundle or select a backend: refuse them all.
const set = Object.keys(process.env).filter(name => /^VITE_.*SUPABASE/i.test(name) && (process.env[name] ?? '').trim() !== '');
if (set.length) fail(`${set.join(', ')} must not be set for the demonstration build. Remove them from the hosting project's environment.`);

// Explicit blanks also override any VITE_SUPABASE_* values in local .env files, which Vite would otherwise load.
const env = { ...process.env, VITE_DEMO_ONLY: 'true', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' };
// The locally installed, locked tools (never an npx download).
for (const args of [['node_modules/typescript/bin/tsc', '--noEmit'], ['node_modules/vite/bin/vite.js', 'build']]) {
  const run = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (run.error) fail(`could not run ${args[0]}: ${run.error.message}`);
  if (run.status !== 0) process.exit(run.status ?? 1);
}

const files = [];
const walk = dir => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files.push(path); } };
walk('dist');
const forbidden = [
  [/supabase\.co/i, 'a Supabase-hosted URL'],
  [/\/(rest|auth|storage|functions|realtime)\/v1\b/, 'a Supabase API path'],
  [/sb_(publishable|secret)_[A-Za-z0-9_-]+/, 'a Supabase API key'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, 'a JWT'],
  [/GoTrueClient|PostgrestClient/, 'the Supabase client library'],
  [/[a-z]{20}\.supabase/i, 'a Supabase project reference'],
];
const problems = [];
let demoAccounts = false;
for (const file of files) {
  const text = readFileSync(file, 'latin1');
  for (const [pattern, what] of forbidden) if (pattern.test(text)) problems.push(`${file} contains ${what}`);
  if (text.includes('owner@demo.verimark.test')) demoAccounts = true;
}
if (problems.length) fail(`the output is not demo-only:\n - ${problems.join('\n - ')}`);
if (!demoAccounts) fail('the demonstration adapter is missing from the output.');
console.log(`build:demo: ${files.length} files in dist/, demonstration adapter only, no Supabase client, host, key or token.`);
