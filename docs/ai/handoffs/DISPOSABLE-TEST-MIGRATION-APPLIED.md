# Disposable Supabase test migrations — applied and verified

## Authorization and scope

The owner explicitly approved exactly these two reviewed migrations against **verimark-test**, reference **jtcudtkranugrxhbigyl**, a Free-plan project confirmed by the owner:

1. `20261116000000_verimark_core.sql`
2. `20261116010000_invite_existing_member.sql`

Execution checkout: `C:/Users/James/orca/workspaces/VeriMark/test-supabase-integration`; branch `jamesmikkorecario-dev/test-supabase-integration`; source HEAD before execution `ad12646db8a313eac80f8a833d5871a3c2ca2d2b`. Supabase CLI 3.1.0. The protected development reference `otovaqtmodpqelwbrglj` was never a command target. No application source or migration file was edited.

## Pre-execution gate

All checks passed before the apply call:

- Account project listing identifies the exact reference as `verimark-test`, healthy. Application environment URL privately matched that reference. All remote commands supplied the literal approved reference rather than an implicit link.
- Local migration directory contained exactly the approved pair. Normalized LF UTF-8 SHA-256 matched the previously reviewed values:
  - Core: `8299a490880b07b4c72b821ba8d7db9cdc19e561801f117c13639a529db2dc7a`
  - Invitation correction: `b9f1353369e00db5e54d30b1dfe86f0a1e8a6b136bacd90adeef8dc852b76084`
- `npx supabase migration list --remote=jtcudtkranugrxhbigyl`: remote history empty; exactly two local versions.
- `npx supabase db push --remote=jtcudtkranugrxhbigyl --dry-run --skip-vault`: exactly both ordered migration files, no seeds or roles, exact project name/reference.

## Single authorized execution

```text
npx supabase db push --remote=jtcudtkranugrxhbigyl --skip-vault --yes
```

One attempt, successful exit. CLI reported both migrations applied and `Finished supabase db push.` No automatic retry, reset, repair, seed, roles push or configuration push. CLI's `production` label denotes this project's main database branch, not a Vercel deployment or paid-tier assertion. CLI remote access initializes its temporary login role.

## Post-migration verification (read-only)

| Check | Observed result |
| --- | --- |
| Remote history | Both `20261116000000` and `20261116010000` match local versions |
| Schemas | `public` and `app` exist |
| Application tables | 17, all RLS enabled |
| Policies | Six authenticated SELECT-only membership policies; audit additionally requires non-null organization |
| Anonymous table rights | No privileges on any application table |
| Authenticated table rights | No whole-table SELECT or INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN privileges |
| Safe column reads | Exactly 44 SELECT grants across the six designed tables; no anonymous column reads or private-column leakage |
| Public application functions | 30, all SECURITY DEFINER with pinned empty search_path |
| Internal app functions | 26, all pinned empty search_path; authenticated execute only on `is_member` |
| Anonymous function allowlist | Exactly `public.verify_credential` and `public.exchange_delivery` |
| Authenticated public RPCs | All 30 designed public application functions; no execute on Supabase's event-trigger helper |
| Triggers | 11 enabled public integrity triggers; enabled `verimark_on_auth_user_created` on Auth users |
| Automatic RLS | Supabase `ensure_rls` event trigger remains enabled |
| Migration creator | Application tables owned by postgres; zero PUBLIC/anon/authenticated default ACL entries for this creator in the inspected public/app/global scopes |
| Invitation correction | Hosted `create_invite(uuid,text,text)` contains `ALREADY_MEMBER` validation |
| Anonymous HTTP table checks | All 17 denied with HTTP 401 and PostgreSQL `42501` |
| Anonymous guarded RPC checks | `my_memberships`, `list_review_queue`, `is_platform_admin` denied with HTTP 401 / `42501` |
| Private API schema | Request selecting `app` rejected with HTTP 406 / `PGRST106` |
| Auth connectivity | Settings endpoint HTTP 200; email confirmation required |
| Auth URLs | Site URL `http://127.0.0.1:3611`; redirect allowlist `http://127.0.0.1:3611/**`, unchanged |
| Data | All 17 application tables empty; zero Auth users; no platform administrator |

No public verification/delivery RPC was invoked because each writes a rate counter. Guarded RPC probes were read-only functions rejected before execution by permissions. No hosted test suite, Auth signup, fixture setup, issuance or administrator bootstrap was run. Authenticated privileges were inspected in PostgreSQL catalogs; real signed-in tenant journeys remain untested because no accounts are authorized yet.

## Inspection limitations and unexpected behavior

- No migration error or unexpected application-data change observed.
- `projects list` warns that this checkout has no implicit link; explicit-target commands worked. No relinking was necessary and the development link was untouched.
- The CLI read-only inspection role did not expose rows through `information_schema.column_privileges`. Effective `pg_catalog` / `has_column_privilege` checks verified the exact column allowlist instead; this was an inspection visibility limitation, not missing grants.
- An initial summary query compared PostgreSQL's stored `search_path=""` spelling incorrectly. Existing catalog output was parsed correctly to verify all 30 application RPCs and 26 internal helpers. This was a reporting-query issue, not a migration defect. No migration was retried.
- Defaults for objects created by other administrative roles are not proof of future-object safety. Every later migration must retain explicit ACL/RLS review. Global anonymous rate budgets, immutable history and untested real multi-connection behavior remain known design limits.

## Preservation and stop boundary

After all hosted checks, development `.env.local`, `supabase/.temp/project-ref` and `supabase/config.toml` were privately compared to preserved snapshots: all byte-for-byte unchanged. No credentials were printed or included here. No primary checkout change, Git push/main merge, deployment, paid service, Auth configuration change, worktree/database deletion or test-user creation occurred.

Migration execution and required read-only verification are complete. Stop here. The six fictional accounts, dedicated test platform administrator, hosted API/browser suites and permanent test data still require separate explicit approval.
