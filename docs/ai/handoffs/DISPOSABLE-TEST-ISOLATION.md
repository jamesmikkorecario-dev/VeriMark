# TEST-ISOLATION — disposable hosted test approval gate

## Source and preservation

Prepared implementation committed on `dev/full-stack-integration`: `485f13f025996af31a92a7a783ea2b2d9d5d05a4` (`test: isolate hosted automation from protected development`). Required commit-msg hook was present; inspected commit message has no attribution/footer. Selective commit preserved 19 unrelated modified paths. Historical worktrees/branches were not reset, removed or switched; primary remains on `main`.

New Orca-managed checkout: `C:/Users/James/orca/workspaces/VeriMark/test-supabase-integration`, branch `jamesmikkorecario-dev/test-supabase-integration`, based on that exact commit. Setup hooks were skipped. Native Codex verifier `ctx_ad2054f36b0a` confirmed HEAD/base match, zero status entries, exactly two SQL migrations, ignored environment paths and no inherited environment/link cache. After the owner confirmed the disposable target, its publishable key was retrieved privately through the CLI without revealing secret keys; `.env.local` now contains exactly its URL/publishable key, and `.env.hosted-test.local` contains the matching test target/key with write consent empty. No development credential files were copied; no account passwords or UUIDs are configured yet.

Coordinator compared development `.env.local`, `supabase/.temp/project-ref` and `supabase/config.toml` against in-memory snapshots again after remote preflight: all byte-for-byte unchanged. The development link still points to protected `otovaqtmodpqelwbrglj`. No hosted migration/application writes, account/admin changes, push, deployment, paid action or deletion occurred. CLI read-only access initialized its temporary login role on the disposable target.

## Confirmed target and remote preflight

The owner explicitly confirmed **verimark-test — jtcudtkranugrxhbigyl** through the target-only approval form (not SQL/data approval). All following remote commands named this exact reference; the new checkout remains unlinked. Free-plan billing status is not established by project listing or the inspected CLI commands. Authenticated dashboard inspection through the browser relay failed with `EUNKNOWN: unknown error, uv_spawn`; no billing/configuration action was attempted.

## Migration set preserved (not applied)

1. `20261116000000_verimark_core.sql`
2. `20261116010000_invite_existing_member.sql`

Normalized LF UTF-8 SHA-256 fingerprints in the isolated checkout:

- Core: `8299a490880b07b4c72b821ba8d7db9cdc19e561801f117c13639a529db2dc7a`
- Invitation correction: `b9f1353369e00db5e54d30b1dfe86f0a1e8a6b136bacd90adeef8dc852b76084`

`migration list --remote=jtcudtkranugrxhbigyl` shows remote history empty, both local versions pending. `db push --remote=jtcudtkranugrxhbigyl --dry-run --skip-vault` succeeded and proposes exactly those two filenames, with no seed or role entries. No apply command ran. Independent reviewer `ctx_58c27527bc8e` found no ordering/signature incompatibility. Read-only SELECT found PostgreSQL 17.12, zero Auth users, zero public relations, no app schema, pgcrypto in extensions, automatic RLS event trigger enabled, and neither anon nor authenticated having public-schema CREATE. There are 24 default public-table API ACL entries: disabled automatic table exposure is not established and needs review before installation. Verify atomic migration execution/API isolation before applying; the core migration revokes defaults/installs RLS at its end.

## Verification

Coordinator ran local gates: typecheck/lint/build passed; database/safety 168 passed; units/components 220 passed; Chromium demo rehearsal 22 passed, 12 intentional viewport skips. Explicit missing-consent API and browser entries refused with nonzero exit before tests; browser refused before server startup. Native isolation reviewer `ctx_62dda3d6aac0` plus follow-up `ctx_3d121bf87f58` found no blocking source bypass after corrections; its missing-document finding was resolved by adding the canonical disposable plan. No hosted suite ran.

## Next owner action and approval boundaries

Target confirmation and migration dry run are complete. Remaining pre-approval evidence: Free plan and intended API exposure/settings. Read-only `config diff`/`config pull --dry-run` found email confirmation enabled remotely (local config false), remote site URL `http://localhost:3000` and no additional redirects (the hosted browser harness uses `http://127.0.0.1:3611`). Remote vector storage is disabled while local config defaults enabled. Do not push local configuration; keep email confirmation enabled. Review redirect/exposure settings and approve any necessary targeted settings changes separately. No config file was overwritten. No database password was requested.

After separately approved migrations, obtain separate approval for six fictional users/profiles, one dedicated test administrator and one combined writing run (13 credentials initially, 12 per repeat, plus associated immutable history; complete counts in `e2e-live/README.md`). No personal credentials or real administrator may be used. Project deletion remains irreversible and separately approval-gated; no automatic cleanup, database reset or worktree deletion.

## Isolated tooling completion

`npm ci` completed in the test checkout (290 packages); its local CLI is **3.1.0**. Git ignore checks confirmed `.env.local`, `.env.hosted-test.local` and `supabase/.temp/project-ref` are ignored. Completed verifier was safely released (`state=released`, agent terminal closed); worktree retained. Login/link commands, if needed privately: `npx supabase login`, then `npx supabase link --project-ref jtcudtkranugrxhbigyl` from this checkout only. History/dry run worked with explicit remote reference without linking. CLI's `production` target label denotes the project's main database branch; no deployment took place and that label is not billing-plan evidence.

## Migration approval command — not executed

After remaining checks and explicit approval naming this target and both pinned files, from this test worktree only:

```powershell
npx supabase db push --remote=jtcudtkranugrxhbigyl --skip-vault --yes
npx supabase migration list --remote=jtcudtkranugrxhbigyl
```

Stop on failure/partial application; never automatically retry. Account/admin provisioning and test-data execution remain separately unapproved.
