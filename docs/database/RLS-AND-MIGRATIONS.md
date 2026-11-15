# Row-Level Security and Migration Policy

## RLS

For **every client-exposed table**, confirm RLS enabled and least-privilege policies for SELECT/INSERT/UPDATE/DELETE as applicable. Evaluate `USING` and `WITH CHECK`, joins, public views, functions, storage objects, and realtime exposure. Default deny, then allow explicitly.

| Table | Role/action | Predicate | Positive test | Negative test |
| --- | --- | --- | --- | --- |
| `profiles` | owner SELECT | `auth.uid() = id` (example) | owner reads own | other user cannot read |

## Migration safety

1. Add a numbered, committed migration; never mutate existing applied migrations.
2. Assess backward compatibility, data backfill, constraints, locks, and rollback/forward fix.
3. Run against disposable/local DB and seed test users; exercise RLS positives/negatives.
4. Require DB + security review for policy/schema changes.
5. Take/verify backup or recovery plan before destructive production changes; explicit approval required.
6. Document post-migration smoke checks and how to respond if rollout fails.

## Supabase specifics

Publishable/anon client keys do **not** bypass RLS; service-role/secret keys must never be embedded in frontend bundles. Storage policy coverage and security advisors are part of launch review. Check the live Supabase official checklist before launch.
