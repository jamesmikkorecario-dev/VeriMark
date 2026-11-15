# Database authorization tests

`npm run test:db` loads every file in `supabase/migrations` into a real PostgreSQL engine running in-process (PGlite) and calls the functions the way the Supabase Data API does: as role `anon`, or as role `authenticated` with a JWT subject. Nothing is mocked inside the database.

`harness.ts` adds only what a Supabase project already provides: the roles `anon` / `authenticated` / `service_role`, the `auth` schema with `auth.users` and `auth.uid()`, and Supabase's permissive default privileges (so the migration's explicit revokes are what is being tested).

| File | Covers |
| --- | --- |
| `authorization.test.ts` | Anonymous and member table access, private columns, RLS tenant separation, cross-tenant RPC denial, role limits, removed members, immutable history |
| `issuance.test.ts` | Row validation, approval of the exact digest, atomic and idempotent issuance, issuer eligibility and suspension |
| `lifecycle-public.test.ts` | Public allowlist, status precedence and expiry boundary, rate budget, revoke, replace, delivery secrets |
| `organizations.test.ts` | Bootstrap, last-owner rule, invitations, platform review, templates, pagination, audit |
| `adapter.test.ts` | The real `supabaseAdapter` against the real schema (argument names, result shapes, error mapping) |

## What this does not prove

It is not a hosted Supabase project. Not covered: Supabase Auth itself (sign-up, e-mail confirmation, recovery, JWT settings), PostgREST configuration and exposed schemas, network-level rate limiting, real concurrency between separate connections (PGlite has one connection, so lock ordering is reviewed, not raced), backups, and performance. Repeat the suite's scenarios against a disposable project before any real data is used.
