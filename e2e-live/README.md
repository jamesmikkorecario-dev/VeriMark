# Real-backend browser verification and approval gate

## Current status

Prepared locally on `dev/full-stack-integration`; **no hosted fixture users, administrator grants or test records created**. Hosted testing requires a separate disposable Free Supabase project and an isolated worktree. Development project `otovaqtmodpqelwbrglj` is permanently forbidden as a hosted-test target. See `docs/database/DISPOSABLE-HOSTED-TEST-PLAN.md` for the current target-confirmation and migration gates.

The owner must approve hosted writes separately. An opt-in environment variable is an execution guard, not human authorization. Do not run the writing commands below before approval. Do not run the API and browser suites concurrently or automatically retry failed writing runs.

## Local verification

`npm run test:live` defaults to demo rehearsal, with environment-file loading disabled for its Vite server. Hosted runners read only test-specific `VM_TEST_*` variables from `.env.hosted-test.local` and the process environment; they never fall back to application `.env.local` or `VITE_*` credentials. Invalid hosted runs fail before authentication/server startup. Existing `e2e/` remains the separate demonstration suite.

Local evidence at this checkpoint:
- Browser rehearsal: **22 passed, 12 intentional viewport skips**, Chromium, 1440/390 plus explicit 320-pixel checks. Record-creating journeys run only at 1440.
- Typecheck, lint, build: pass.
- Units/components: **220 passed**. Full database/configuration run: **161 passed**; after the final fixture change, the focused safety file passed **10/10**, and typecheck/lint passed again.
- `VM_HOSTED_TESTS='' npm run test:hosted`: four hosted tests skipped, one local configuration assertion passed. This is NOT a hosted pass.
- Hosted browser consent refusal: `LIVE_TARGET=hosted VM_HOSTED_TESTS='' npm run test:live` exited 1 before tests, with `{ "status": "failed", "tests": [] }` in the secret-free summary. This expected failure proves refusal, not hosted connectivity.
- Two native Codex Orca workers independently reviewed safety and coverage. Fixed error-masking RLS queries, broad mutation probes, account/name-only identity checks and unsafe browser failure artifacts. Review identified the partial-bootstrap recovery gap; setup now logs each organization UUID immediately and permits independently pinned recovery of absent expected issuer/viewer memberships, rejecting wrong roles.

## What runs automatically after approval

API: actual Auth sessions, PostgREST errors, table/RPC privileges, tenant separation, private-field access, owner/issuer/viewer restrictions, approval/digest/idempotency, eligibility, issue/revoke/replace/delivery and the public response allowlist.

Browser: wrong-password rejection, protected-route return, sign-in/out, single issuance, invalid/valid CSV, exported links, activity, public verification, irreversible revoke, replacement lineage, anonymous cross-context delivery and PDF header, delivery rotation, invitations/identity binding, member removal on repeats, role/tenant guards, reviewer controls, keyboard-only issuance, mobile navigation/focus/Escape, reduced motion, overflow at 320/390/1440, and WCAG A/AA automated checks for serious/critical violations.

The reviewer journey re-confirms the already reviewed fictional main organization. Initial pending-to-reviewed approval is exercised by API fixture setup. Neither route touches real organizations. Hosted admin views necessarily read the review queue, but tests scope the one decision to the exact fictional organization name after UUID/membership validation.

Not proven: email signup/confirmation/recovery delivery, browser template authoring/member-role changes, actual expiry waiting, database concurrency, global rate exhaustion, backups, performance, all accessibility criteria, real physical devices or production deployment. Local DB tests cover expiry and additional role/template invariants. No claim of complete hosted verification before authorized execution.

## Proposed identities and credentials

Exactly **six new fictional Auth users** with local parts `vm-test-owner`, `vm-test-issuer`, `vm-test-viewer`, `vm-test-other`, `vm-test-admin`, `vm-test-invitee` at an owner-approved test domain. Do not reuse an existing personal account. All must have confirmed emails and profiles. Only `vm-test-admin` receives a new `platform_admins` row; it has no tenant memberships. Existing real administrator is untouched.

One-time privileged provisioning is separate from feature testing. After approval, use an agreed operator-controlled account-creation process; the harness does not create users or disable confirmation. No personal password, service-role key or database password is needed by the test runner. Do not send fictional addresses signup/recovery mail. Keep invitee display metadata unset (profile name defaults to `vm-test-invitee`).

Runner credentials: disposable test URL/publishable key, one dedicated test-only shared password of at least 16 characters, six exact emails and six approved Auth UUIDs. Store only in the test worktree's ignored `.env.hosted-test.local`, never chat/logs/commits. Do not print it. The app's separate test-worktree `.env.local` contains only its own VITE URL/key.

```dotenv
VM_TEST_PROJECT_REF=<confirmed disposable test project reference; never the protected development ref>
VM_TEST_SUPABASE_URL=https://<confirmed disposable test project reference>.supabase.co
VM_TEST_PUBLISHABLE_KEY=<disposable test publishable key>
VM_HOSTED_TESTS=I-understand-this-writes-test-data
VM_TEST_PASSWORD=<dedicated test-only password, at least 16 characters>
VM_TEST_OWNER_EMAIL=vm-test-owner@<approved-domain>
VM_TEST_OWNER_ID=<exact approved Auth UUID>
VM_TEST_ISSUER_EMAIL=vm-test-issuer@<approved-domain>
VM_TEST_ISSUER_ID=<exact approved Auth UUID>
VM_TEST_VIEWER_EMAIL=vm-test-viewer@<approved-domain>
VM_TEST_VIEWER_ID=<exact approved Auth UUID>
VM_TEST_OTHER_OWNER_EMAIL=vm-test-other@<approved-domain>
VM_TEST_OTHER_OWNER_ID=<exact approved Auth UUID>
VM_TEST_ADMIN_EMAIL=vm-test-admin@<approved-domain>
VM_TEST_ADMIN_ID=<exact approved Auth UUID>
VM_TEST_INVITEE_EMAIL=vm-test-invitee@<approved-domain>
VM_TEST_INVITEE_ID=<exact approved Auth UUID>
```

Initially leave organization IDs absent; all test accounts must have zero memberships. The first API run creates `VM Test Main (automated)` and `VM Test Other (automated)` and prints their nonsecret UUIDs immediately. Record them privately as `VM_TEST_MAIN_ORG_ID` and `VM_TEST_OTHER_ORG_ID` before the browser or any repeat. Each existing organization must match the approved owner, exact name and allowed fictional member UUIDs. Partial setup is inspected before resumption; pin any already-created organization independently. Never blindly rerun an interrupted writing test: already-issued scenario/browser records are not rolled back.

## Provisioning the six accounts (server-only secret)

`supabase/hosted/provision-users.ts` is the only code that uses an elevated key. It reads `VM_PROVISION_SECRET_KEY` solely from `.env.hosted-admin.local` (ignored by `.env.*` in `.gitignore`). The variable name deliberately lacks the `VM_TEST_` and `VITE_` prefixes, so the hosted runner's loader, Vitest and the Playwright/Vite server never read it (regression: `supabase/tests/provisioning-safety.test.ts`). It refuses a non-`sb_secret_` key, a mismatched URL/reference and the protected development reference, and creates nothing unless the project has zero Auth users.

Owner places the key without echoing it (PowerShell, in the test worktree):

```powershell
$secure = Read-Host 'verimark_hosted_tests secret key' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
[IO.File]::WriteAllText("$PWD\.env.hosted-admin.local", "VM_PROVISION_SECRET_KEY=$plain`n")
Remove-Variable plain, secure
icacls .env.hosted-admin.local /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null
git check-ignore .env.hosted-admin.local   # must print the file name
```

Then, once: `node supabase/hosted/provision-users.ts` creates exactly six confirmed accounts at `@example.test` (no e-mail is sent), generates one random test-only password, and appends the password, addresses and returned UUIDs to `.env.hosted-test.local`; it prints UUIDs only. `--check` re-verifies them read-only. The dedicated test administrator row is then inserted by exact UUID through `npx supabase db query --remote=<test ref>`. After provisioning, remove `.env.hosted-admin.local` and revoke the `verimark_hosted_tests` key through the Management API (`docs/operations/SUPABASE-OPERATIONS.md`); the test runs need only the publishable key and the test password. Done for `jtcudtkranugrxhbigyl` on 2026-11-18 (`docs/ai/handoffs/HOSTED-TEST-RUN-2.md`).

## Pending application corrections

- `RemountOnFragment` remounts receive/invite pages on a second native fragment navigation, ensuring the next secret is consumed and removed. Unit regression and browser delivery rehearsal pass. Existing animations and scrolling are unchanged.
- **Local-only migration `20261116010000_invite_existing_member.sql` is preserved.** A fresh test project requires both the core migration and this invitation correction, in that order, with separate explicit approval for the exact target and set. Do not apply either as part of test preparation to the protected development project.

## Expected permanent data (successful first API + browser run)

Static projections independently reviewed; failures can leave a partial set. These are additions, never replacements for existing real records.

| Record | First combined run | Each combined repeat |
| --- | ---: | ---: |
| Auth users / application profiles (one-time provisioning) | 6 / 6 | 0 |
| Dedicated platform-admin assignment (one-time provisioning) | 1 | 0 |
| Organizations | 2 | 0 |
| Memberships, net | 5 | 0 |
| Invitations | 3 | 1 |
| Issuer reviews | 2 | 1 |
| Templates | 2 | 0 |
| Batches | 11 | 10 |
| Batch rows | 13 | 12 |
| Approvals | 10 | 9 |
| Credentials | **13** | **12** |
| Credential events | 17 | 16 |
| Delivery capabilities | 4 | 4 |
| Idempotency receipts | 13 | 12 |
| Audit rows | 54 | 43 |
| Verification counter rows | 2 | 0 (existing values increase) |

Rate-window rows depend on elapsed minute boundaries. Auth sign-ins create/update Supabase-managed sessions and security records. Six users/one admin grant are additional to the suite's application counts. API alone first creates 4 credentials (seed + 3); browser after it adds 9. Browser alone on fresh fixtures creates 10. Browser creates one unissued narrow-screen draft; API leaves an approved batch in the pending organization. Repeated membership testing removes/re-adds only the fictional invitee. Counts assume no extra retries, fixtures or manual records.

## Exact execution sequence — only after approval

Use the isolated test worktree and guarded commands in `docs/database/DISPOSABLE-HOSTED-TEST-PLAN.md`. First confirm the actual target reference, Free plan, settings, and empty history; then review a dry run. Do not use the development worktree's implicit CLI link. Migration approval does not authorize users or data.

After separately approved migrations, provisioning and test-data execution, from the isolated test worktree, PowerShell:

```powershell
npm run test:hosted
# Pin both printed test organization UUIDs in the ignored environment file before continuing.
$env:LIVE_TARGET = 'hosted'
npm run test:live
Remove-Item Env:LIVE_TARGET
```

Stop on any unexpected project/migration/account identity, provider limit, partial write, timeout or test failure; inspect read-only and obtain approval for recovery or additional permanent records as needed. Successful API execution is prerequisite to browser execution in the combined count plan.

## Evidence and cleanup limitations

Hosted Playwright disables trace, screenshot and video capture. It discards per-test output and uses a static-location/status reporter (`test-results-live/hosted-summary.json`) that keeps only redacted, truncated error text plus, for failed tests, a redacted `diagnostics` event list covering every page the test opened (its own page and each persona/anonymous Stage page: navigations, Auth/REST method + path + status, failed requests, console/page errors; never query strings, headers, bodies, stdout or attachments). The redaction removes the test password, global-setup session tokens, JWTs, `sb_` keys, link fragments and long tokens. Abrupt termination can leave temporary runner files: treat ignored output as sensitive, do not upload it. Never override hosted reporter/trace/screenshot settings for sharing without a separate privacy review.

Fixture sessions live in memory and are signed out with local scope after a completed run. Auth sign-in rate limits still apply. There is no automatic deletion: immutable credentials, approvals, reviews/events and audit records must remain. Do not delete test users with historical references, wipe a schema, reset this shared project or delete unrelated worktrees. Any later test-user disablement/admin-role removal or retention cleanup requires separate approval.
