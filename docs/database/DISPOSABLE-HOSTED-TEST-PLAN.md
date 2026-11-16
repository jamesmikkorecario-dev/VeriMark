# Disposable hosted test environment — TEST-ISOLATION

## Authority and target separation

Protected development reference: **otovaqtmodpqelwbrglj**. Never apply test migrations, create fictional users, run hosted suites or alter its administrator. Its integration-worktree `.env.local`, CLI link and configuration are preserved byte-for-byte. Primary `main` and every historical worktree remain intact. No push, deployment, main merge, paid provisioning or destructive operation.

The owner subsequently confirmed **verimark-test — jtcudtkranugrxhbigyl** through a target-only form, authorizing read-only preflight and dry run, not SQL/data writes. Explicit-target migration history is empty and the dry run proposes exactly the two files below. See `docs/ai/handoffs/DISPOSABLE-TEST-ISOLATION.md` for observed settings, fingerprints and current blockers. Free billing status remains unverified; do not infer it from the project name or organization.

Local preparation, review and commits are authorized. Stop at migration approval. User provisioning and hosted test-data writes have a later independent approval gate. The project already exists; no project is created or paid service enabled by this preparation.

## Local safety architecture

- Shared hosted config requires `VM_TEST_SUPABASE_URL`, `VM_TEST_PUBLISHABLE_KEY`, exact `VM_TEST_PROJECT_REF`, explicit write consent, six fictional emails and exact confirmed Auth UUIDs.
- The protected reference is rejected in both URL and configured ref even if they agree. The client boundary independently refuses protected/mismatched targets before SDK creation or authentication.
- Dedicated loader reads only `.env.hosted-test.local` and `VM_TEST_*`/`VM_HOSTED_TESTS` process variables. It never reads `.env.local` or falls back to `VITE_*`.
- Playwright validates before server startup; test-only Vite config has `envDir: false` and receives only the validated URL/key mapping. Default browser rehearsal passes empty URL/key and does not contact hosted Supabase.
- Invalid requested hosted suites fail rather than green-skip. One browser worker, no retries, no trace/video/screenshots; hosted reporter persists static locations/status only.
- Reused organization UUIDs, owners, member allowlists and roles are verified before writes. Names alone cannot establish identity. Initial creation logs each new organization UUID; an interrupted response still requires read-only inspection before recovery.

## Isolated checkout and private configuration

Create a new Orca-managed worktree from the verified committed `dev/full-stack-integration` HEAD, with setup hooks skipped. Do not copy any development `.env*`, `supabase/.temp`, `supabase/.branches`, node_modules, sessions or runtime artifacts. Preserve all old worktrees. The final report records the actual new path/branch and base commit.

In the test worktree only, `.env.local` is prepared with exactly two initially blank variables:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

After target confirmation, the owner privately supplies that project's URL and publishable key; never reuse the development key. The separate `.env.hosted-test.local` is initially inert (empty reference/URL/key, no password, no consent) and later receives `VM_TEST_*` values listed in `e2e-live/README.md`. Both files must be ignored and absent from tracked files. No production/service-role key or database password belongs in either file. A blank configuration is deliberately unusable, not a claim that the project is configured.

## CLI and read-only preflight — after target confirmation

Supabase CLI is pinned to devDependency **3.1.0**. Use the local dependency (`npm ci` in the new checkout if needed), not an unpinned download. CLI v3 supports explicit `--remote=<ref>` for history/dry run/apply, so never rely on the development link. Login credentials are user-scoped; project-link cache must remain test-worktree-local.

PowerShell, after owner confirms the actual test reference (replace the path with the final reported test worktree):

```powershell
Set-Location '<isolated test worktree path>'
$TestRef = Read-Host 'Confirmed disposable test project reference'
if ($TestRef -notmatch '^[a-z0-9]{20}$' -or $TestRef -eq 'otovaqtmodpqelwbrglj') { throw 'Invalid or protected target' }
npm ci
npx supabase --version                         # must be 3.1.0
npx supabase login                             # if not already authenticated; never paste login tokens into chat
npx supabase link --project-ref $TestRef        # only in the isolated test checkout
$LinkedRef = (Get-Content 'supabase/.temp/project-ref' -Raw).Trim()
if ($LinkedRef -ne $TestRef) { throw 'Linked target mismatch' }
npx supabase migration list "--remote=$TestRef"
npx supabase db push "--remote=$TestRef" --dry-run --skip-vault
```

Do not include passwords in arguments. If any CLI operation asks for a database password, the orchestrator stops and hands the same commands to the owner for private execution. Do not use `--include-all`, `--include-seed`, `--include-roles`, migration repair/reset, config push or debug logging. A dry run is a planning operation, not proof the SQL executes successfully. CLI remote access may initialize its temporary login role; it must never target the protected database.

Before presenting a migration approval request, verify:

1. Reference, project name and link match the owner's exact confirmed target, not just a matching URL string.
2. Dashboard/authorized account metadata establishes the project/organization is on the Free plan; no paid add-ons enabled.
3. Intended PostgreSQL version and extension placement: `pgcrypto` must be in `extensions`; core's `IF NOT EXISTS` does not move an existing extension.
4. Data API exposes `public` only (plus `graphql_public` only if intentionally enabled), never `app`. Automatic new-table exposure is OFF, automatic RLS ON. Tracked local config is not evidence of hosted settings; do not push config.
5. Email confirmation stays enabled; no phone/anonymous/social provider is enabled for testing without a separate decision. Auth URL allowlist supports the test app (`http://127.0.0.1:3611`), `/sign-in` and `/update-password` as appropriate. Inspect settings read-only; do not modify them now.
6. Remote migration history is empty and no conflicting application objects/accounts/data exist. If not empty, stop rather than reset/overwrite.
7. Dry run proposes exactly the ordered set below, no vault/seed/roles/config changes. Record file hashes from the committed source.

## Exact fresh-project migration set — not applied

1. `20261116000000_verimark_core.sql`
2. `20261116010000_invite_existing_member.sql`

The second migration preserves `create_invite(uuid,text,text)` privileges, owner authorization, email normalization, organization locking, secret hashing and empty SECURITY DEFINER search_path, adding rejection of an existing member (`ALREADY_MEMBER`). Core remains unchanged from the reviewed/applied development version. Independent static review found no ordering/signature conflict when applying both to an empty project.

Expected pending set is **both** for a fresh project, but this has not been confirmed remotely. No SQL correction is added in this isolation task. The local migration config does not itself configure hosted automatic exposure/RLS. Verify actual public-schema CREATE/default ACLs, extension ownership and transactional migration behavior. Core installs RLS/revokes at its end: establish atomic execution or keep the fresh project's API inaccessible during installation; never assume a dry run proves isolation during DDL. Blanket revokes affect pre-existing public helper functions; inspect afterward. No automatic retry if a migration fails or is partially applied.

### Apply command — display only, needs exact-target/set approval

Only after all checks pass and the owner explicitly approves the confirmed target and these two exact committed migration files:

```powershell
if ($TestRef -notmatch '^[a-z0-9]{20}$' -or $TestRef -eq 'otovaqtmodpqelwbrglj') { throw 'Invalid or protected target' }
if ((Get-Content 'supabase/.temp/project-ref' -Raw).Trim() -ne $TestRef) { throw 'Linked target mismatch' }
npx supabase db push "--remote=$TestRef" --skip-vault --yes
npx supabase migration list "--remote=$TestRef"
```

No apply command has been run or authorized by this document. Migration approval alone does not authorize fictional users, test admin grants or persistent test records.

## Post-migration checks and subsequent approvals

Read-only verify both history versions, 17 public RLS-enabled tables, six tenant SELECT policies, explicit safe-column grants on six tables, no API-role table writes, two anonymous RPCs only, authenticated public RPC grants, internal helper revokes/pinned search_path, correct Auth trigger and extension/default ACLs. Public verification/delivery RPCs update counters even for misses; do not treat invoking them as read-only.

Then obtain separate approval for six fictional confirmed Auth users/profiles and one dedicated test-admin assignment, never touching the real administrator. Agree on privileged provisioning method without sharing personal passwords or service-role credentials in chat. Runner needs only dedicated test passwords, exact UUIDs and publishable credentials.

After account setup, verify identity/membership boundaries and obtain authorization for one combined API/browser execution. Projected first successful run: two organizations, five net memberships, two templates, thirteen credentials and associated history (full per-table counts in `e2e-live/README.md`). Repeats add twelve credentials and other immutable rows; failures can leave partial data. Do not repeat writing tests without inspecting existing state and obtaining authorization for extra records. Automated coverage/known limits remain documented in the browser guide.

## Cleanup plan — never automatic

No project deletion, account deletion, database reset or worktree removal is performed. Immutability/FK references prevent ordinary record/user cleanup; disposable whole-project deletion is the eventual clean boundary.

After all evidence is reviewed and exported without secrets, obtain explicit irreversible-deletion approval naming the confirmed disposable reference. In Supabase Dashboard, open that project's General settings, verify the reference differs from protected development, recheck Free billing/project scope and the owner's approval, then use Delete Project and the dashboard's confirmation. Confirm absence through the read-only project list afterward. Dashboard labels/flow must be re-verified at execution time; no deletion command has been run or tested. Remove only that test checkout's ignored credential files after separate approval; do not delete historical worktrees or the development link. The protected development project must remain listed and unchanged.

## Local verification evidence for this isolation change

- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `npm run test:db`: 168 passed, eight files (includes protected URL/ref/placeholder/ambient-VITE rejection and exact identity/role guards).
- `npm test -- --run`: 220 passed, twenty files.
- `npm run test:live`: demo rehearsal 22 passed, 12 intentional viewport skips, 1.5 minutes; real Vite server uses environment-file isolation. Not a hosted backend pass.
- With write consent explicitly empty, both `npm run test:hosted` and hosted `npm run test:live` exited nonzero before any tests/authentication; browser refused before server startup. These expected refusal failures are safety evidence, not product failures.
- Two native Codex Orca review workers independently reviewed isolation and fresh-project migration compatibility. Isolation follow-up found no blocking source bypass; the previously missing referenced plan is supplied by this file. No review worker modified code, read secret environment files, ran tests or made network calls.
- Non-blocking runner warnings: NO_COLOR/FORCE_COLOR precedence and future Vite native config-loader extension requirements. No warnings were suppressed.
- After target confirmation, explicit-target history/dry run/read-only catalog queries and read-only config comparisons completed. No hosted migrations/users/test records created, no settings pushed and no project deleted. Free-plan verification and intended API-exposure/redirect settings remain approval prerequisites.
