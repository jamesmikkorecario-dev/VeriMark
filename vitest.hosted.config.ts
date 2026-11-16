import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
// Hosted verification (supabase/hosted/README.md). Reads .env.local and .env.hosted-test.local; both are ignored by git.
Object.assign(process.env, loadEnv('hosted-test', process.cwd(), ['VITE_SUPABASE_', 'VM_']));
export default defineConfig({ test: { environment: 'node', include: ['supabase/hosted/**/*.test.ts'], testTimeout: 180_000, fileParallelism: false } });
