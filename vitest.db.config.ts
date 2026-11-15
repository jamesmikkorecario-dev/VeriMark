import { defineConfig } from 'vitest/config';
// Database authorization tests: real PostgreSQL (PGlite, in-process) with the Supabase role/auth shim. See supabase/tests/README.md.
export default defineConfig({ test: { environment: 'node', include: ['supabase/tests/**/*.test.ts'], testTimeout: 60_000, hookTimeout: 120_000, fileParallelism: false } });
