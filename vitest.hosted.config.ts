import { readHostedEnvironment } from './supabase/hosted/environment';
import { defineConfig } from 'vitest/config';
// Deliberately never reads application .env.local or VITE variables.
Object.assign(process.env, readHostedEnvironment());
export default defineConfig({ test: { environment: 'node', include: ['supabase/hosted/**/*.test.ts'], testTimeout: 180_000, fileParallelism: false } });
