# Hosted verification

`npm run test:hosted` runs the same end-to-end rule scenario used locally (`supabase/tests/scenario.ts`) against a real Supabase project, plus direct table-access denial checks with real sessions. **Not yet run against any project.**

It **writes test data** (two organizations, templates, a few records per run, audit rows) and cannot delete it: issued records are immutable by design. Use a development project only. It is skipped unless everything below is set.

## Prerequisites (after the migration has been applied with the owner's approval)

1. In the Supabase dashboard, Authentication → Users → Add user, create five users with **Auto Confirm** ticked and one shared strong password: owner, issuer, viewer, other-owner, admin. Use addresses you control or a reserved test domain. No e-mail is sent.
2. Make the admin test user a platform administrator (SQL editor): `insert into public.platform_admins (user_id) select id from auth.users where email = '<admin test address>';`
3. Create `.env.hosted-test.local` in this worktree (ignored by git; never commit it):

```
VM_HOSTED_TESTS=I-understand-this-writes-test-data
VM_TEST_PASSWORD=<the shared password>
VM_TEST_OWNER_EMAIL=...
VM_TEST_ISSUER_EMAIL=...
VM_TEST_VIEWER_EMAIL=...
VM_TEST_OTHER_OWNER_EMAIL=...
VM_TEST_ADMIN_EMAIL=...
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are read from `.env.local`.

## What it checks

- Anonymous: every table refuses reads and writes with PostgreSQL's permission error; member-only functions are refused; the two public functions answer.
- The scenario's pinned outcomes (roles, tenant separation, approval, idempotency, eligibility, revoke, replace, delivery links, public allowlist).
- With real sessions: no table accepts a write; private tables and private columns cannot be read; each member sees only their own organization's rows; a platform administrator sees no tenant data.

Re-runs reuse the two organizations. The "other" organization must stay unreviewed. The public rate budget (600 lookups a minute) is not exercised here.

## What it does not check

Sign-up, e-mail confirmation and password-recovery e-mails; invitation acceptance by a brand-new account; real concurrency; rate-limit exhaustion; backups. These are in the manual checklist in `docs/database/HOSTED-MIGRATION-PLAN.md`.
