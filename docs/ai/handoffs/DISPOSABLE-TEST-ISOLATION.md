# TEST-ISOLATION — disposable hosted test approval gate

## Source and preservation

Prepared implementation committed on `dev/full-stack-integration`: `485f13f025996af31a92a7a783ea2b2d9d5d05a4` (`test: isolate hosted automation from protected development`). Required commit-msg hook was present; inspected commit message has no attribution/footer. Selective commit preserved 19 unrelated modified paths. Historical worktrees/branches were not reset, removed or switched; primary remains on `main`.

New Orca-managed checkout: `C:/Users/James/orca/workspaces/VeriMark/test-supabase-integration`, branch `jamesmikkorecario-dev/test-supabase-integration`, based on that exact commit. Setup hooks were skipped. Native Codex verifier `ctx_ad2054f36b0a` confirmed HEAD/base match, zero status entries, exactly two SQL migration files, both environment paths ignored and no inherited environment files or project-link cache. Coordinator subsequently created only inert ignored `.env.local` (two blank VITE URL/key variables) and `.env.hosted-test.local` (blank test ref/URL/key/consent). No development credential files were copied. These files are intentionally not configured until actual target confirmation and private test credentials are available.

Coordinator compared development `.env.local`, `supabase/.temp/project-ref` and `supabase/config.toml` against in-memory snapshots: all byte-for-byte unchanged. The development link still points to protected `otovaqtmodpqelwbrglj`. No SQL, hosted data writes, account/admin changes, push, deployment, paid action or deletion was performed.

## Target blocker

User supplied placeholder `YOUR_TEST_PROJECT_REF`. Read-only account project listing found `verimark-test`, candidate reference `jtcudtkranugrxhbigyl`, healthy and distinct from development. This does not establish owner-confirmed selection or Free plan. No project-specific link/settings/database-history/dry-run operation has been attempted against that candidate. The new checkout is unlinked. Obtain explicit target confirmation before those steps; no migration approval is requested as if remote preflight had passed.

## Migration set preserved (not applied)

1. `20261116000000_verimark_core.sql`
2. `20261116010000_invite_existing_member.sql`

Normalized LF UTF-8 SHA-256 fingerprints in the isolated checkout:

- Core: `8299a490880b07b4c72b821ba8d7db9cdc19e561801f117c13639a529db2dc7a`
- Invitation correction: `b9f1353369e00db5e54d30b1dfe86f0a1e8a6b136bacd90adeef8dc852b76084`

Expected fresh-project pending set is both; actual remote history/pending status is unverified. Independent migration reviewer `ctx_58c27527bc8e` found no ordering/signature incompatibility. Remaining installation checks: actual Free plan, approved ref/link, empty history/no collisions, automatic exposure OFF/RLS ON, Auth confirmation and redirects, `app` unexposed, pgcrypto in extensions, schema/default ACLs, trusted migration owner and atomic installation/API isolation. See the canonical disposable plan for exact guarded commands and failure handling. No config push is authorized.

## Verification

Coordinator ran local gates: typecheck/lint/build passed; database/safety 168 passed; units/components 220 passed; Chromium demo rehearsal 22 passed, 12 intentional viewport skips. Explicit missing-consent API and browser entries refused with nonzero exit before tests; browser refused before server startup. Native isolation reviewer `ctx_62dda3d6aac0` plus follow-up `ctx_3d121bf87f58` found no blocking source bypass after corrections; its missing-document finding was resolved by adding the canonical disposable plan. No hosted suite ran.

## Next owner action and approval boundaries

Confirm whether candidate `jtcudtkranugrxhbigyl` is the intended disposable test project. Privately configure only its URL/publishable key in this checkout. Follow `docs/database/DISPOSABLE-HOSTED-TEST-PLAN.md` for CLI login/link, explicit-target history and dry run; if a database password is requested, stop for private owner execution. Confirm Free plan/settings before presenting exact-target/two-migration approval. Do not apply SQL merely because local tests pass.

After separately approved migrations, obtain separate approval for six fictional users/profiles, one dedicated test administrator and one combined writing run (13 credentials initially, 12 per repeat, plus associated immutable history; complete counts in `e2e-live/README.md`). No personal credentials or real administrator may be used. Project deletion remains irreversible and separately approval-gated; no automatic cleanup, database reset or worktree deletion.

## Isolated tooling completion

`npm ci` completed in the test checkout (290 packages); its local `npx supabase --version` is **3.1.0**. Git ignore checks confirmed `.env.local`, `.env.hosted-test.local` and `supabase/.temp/project-ref` are ignored. Completed verifier was safely released through Orca (`state=released`, agent terminal closed); the new worktree is retained. No login/link/migration command was run in the test checkout.
