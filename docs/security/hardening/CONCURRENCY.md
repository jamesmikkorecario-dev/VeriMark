# Concurrency audit and handoff

Task: `task_18c3f0faaee6`, 2026-11-18. Owner: dispatched concurrency worker;
independent reviewer: coordinator (review requested with delivery, pending).
Branch: `jamesmikkorecario-dev/hardening-concurrency`, base `bd640e4`.
Status: sequential regressions complete; three real multi-connection schedules
executed in the follow-up below. Other schedules remain unverified.
This report follows the handoff template in the assigned documentation path;
the shared template itself is unchanged to respect ownership.

Goal: audit issuance/lifecycle/authorization serialization without changing policy.
Acceptance: current-membership negative tests, lifecycle/revision regressions,
lock inventory and repeatable multi-session test design with honest limitations.
Inputs: README source matrix, PRD, RC assessment, threat model, ADR-0005,
D-010–D-014, core/invite migrations and shared test harness.
No API, environment, dependency, applied migration or rate-check changes.
Initial audit added no migration; the follow-up demonstrated and fixed a deadlock.

## Evidence boundary

PGlite is a single connection. The new `concurrency-hardening.test.ts` deliberately
does not use `Promise.all` to pretend otherwise. Six tests cover committed-before
orderings: removal before receipt replay; demotion before approved issuance;
suspension before issuance/replacement; replacement replay and fork prevention;
revoke replay and replacement denial; stale organization/template revisions.
Rejected operations leave credential, event and receipt counts unchanged.
Existing DB tests additionally exercise tenant/role denials, issue receipts,
last-owner rules, direct write denial and public permissions.

`Get-Command postgres,initdb,psql,docker -ErrorAction SilentlyContinue` found only
Docker CLI. `C:/Program Files/PostgreSQL` is absent. The dispatch states that the
Docker daemon and installed PostgreSQL are unavailable. No daemon, service,
downloaded executable, hosted target or remote database was used. A portable
PostgreSQL package was permitted but not obtained; true concurrency remains a
release verification gap, not an inferred pass.

## Lock and invariant inventory (source audit, not race proof)

| Path | Explicit ordering and expected invariant |
| --- | --- |
| issue_batch | organization SHARE → caller membership SHARE → batch UPDATE; locks retained through receipt/events/credentials commit; batch winner prevents duplicate issue |
| replace_credential | organization SHARE → membership SHARE → predecessor UPDATE; state check prevents multiple successors; successor and predecessor update atomic |
| revoke_credential | membership SHARE → credential UPDATE; state checked after credential lock; replacement and revoke should have one winner |
| create_delivery_link | membership SHARE → credential UPDATE; serializes regeneration and lifecycle; old capabilities revoked before insert |
| rename/review | organization UPDATE; revision checked after lock; review cannot commit suspension during issue's organization SHARE |
| membership changes | organization UPDATE → caller membership SHARE → target membership UPDATE; owner count serialized per organization |
| create organization/template | profile UPDATE / organization UPDATE respectively serializes cap check and insert |
| save existing template | membership SHARE → template UPDATE; expected revision checked after lock |
| approve_batch | membership SHARE → batch UPDATE; exact pinned digest/revision checked after lock |
| accept_invite | discover organization → organization UPDATE → re-read invite UPDATE; single-use state checked under lock |

Membership SHARE prevents deletion/demotion committing while the authorized
transaction holds it. If deletion/demotion wins first at READ COMMITTED,
`require_role` should see the deleted/updated tuple after waiting. Issue and
replacement read eligibility under organization SHARE. These expectations must
be tested on PostgreSQL, including authorization after waits, rather than inferred
from sequential tests. Existing receipts are checked after membership authorization.
An already successful exact receipt replay can return while suspended because
eligibility follows receipt lookup; it creates no new issuance. This audit does
not redefine replay or suspension policy.

Receipt scope is organization + actor + operation + key. Same-resource requests
serialize on batch/predecessor. Same key on different resources can both miss the
receipt, then collide on its unique constraint; the losing transaction should
roll back all its effects. Whether the error must be normalized/retried is not
demonstrated here. No claim of cross-resource replay reliability is made.

## Suspected lock inversion requiring reproduction

The helper comment claiming organization-first ordering for every operation is
broader than actual callers. Member-first paths that later insert organization
FK rows (for example create_batch, approve_batch audit, revoke audit) may obtain
an implicit organization KEY SHARE lock. Membership administration already holds
organization UPDATE and can then wait for the caller's membership SHARE.
KEY SHARE conflicts with UPDATE: this is a plausible deadlock, with PostgreSQL
aborting one transaction, not demonstrated unauthorized issuance or partial commit.
Do not describe the system as deadlock-free. No fix was made on static suspicion.

## Reproducible local PostgreSQL test design

Use an explicitly disposable, loopback-only PostgreSQL cluster outside the repo
(never either Supabase project). With portable PostgreSQL binaries available:

```powershell
# Replace these with a NEW disposable local directory and binary directory.
& "$pgBin/initdb.exe" -D "$clusterDir" -A trust -U postgres
& "$pgBin/pg_ctl.exe" -D "$clusterDir" -l "$clusterDir/server.log" -o '-h 127.0.0.1 -p 35479' start
& "$pgBin/createdb.exe" -h 127.0.0.1 -p 35479 -U postgres verimark_concurrency
```

Initialize the empty database with `SUPABASE_SHIM` from `supabase/tests/harness.ts`,
then all migrations sorted by name using `psql -X -v ON_ERROR_STOP=1 -f ...`.
Ensure pgcrypto is available. Seed fictional accounts/admin/tenant with the same
SQL and RPC sequence as `platformAdmin`, `tenant`, `approved` in the tests; save
UUID results locally. This is a runner design, not an executable automated runner.
Use three independent psql processes, A/B for transactions and C for observation.
On A and B set `statement_timeout='15s'`, `lock_timeout='10s'`, READ COMMITTED;
start transactions and set the fictional actor before each RPC:

```sql
begin isolation level read committed;
select set_config('request.jwt.claim.sub', '<actor UUID>', true);
set local role authenticated;
-- execute the RPC below, then keep transaction open until C confirms B waits
```

C must observe B blocked using `pg_stat_activity` and `pg_blocking_pids(pid)`
before releasing A; a timed sleep alone is insufficient evidence. Collect SQLSTATE,
RPC result, blocker PID, and post-commit credential/event/receipt/capability counts.
Use synthetic values only; redact returned delivery/invitation tokens.

| Schedule | A holds open | B while A holds | Commit A; required outcome |
| --- | --- | --- | --- |
| removal wins | owner remove_member(issuer) | issuer issue_batch(approved batch) | B NOT_FOUND, no issuance/receipt |
| demotion wins | owner set_member_role(issuer, viewer) | issuer issue_batch | B FORBIDDEN, no issuance/receipt |
| suspension wins | admin record_issuer_review(suspended,current revision) | issuer issue_batch / replace_credential | B ISSUER_NOT_ELIGIBLE, no new credential |
| issue wins | issuer issue_batch | owner remove_member / admin suspension | B waits; after both commits exactly one issue, later new issue denied |
| exact replay | issuer issue_batch(key K) | same actor issue_batch(same args/K) | same response, one set of events/receipts |
| competing issue | issuer issue_batch(key K) | issue_batch(same batch/new key) | INVALID_TRANSITION, one issuance |
| replace race | issuer replace_credential(key K) | same predecessor replacement with new key | one successor only; loser INVALID_TRANSITION |
| revoke/replace | issuer revoke_credential | issuer replace_credential(same predecessor) | loser INVALID_TRANSITION; repeat with ordering reversed |
| stale revision | owner rename revision R / issuer save template R | same revision, different value | loser REVISION_CONFLICT, winner preserved |
| receipt collision | issue batch X with K | same actor issue batch Y with K | no partial Y effects; record actual error/retry behavior |
| last owner | owner demote/remove another owner | other owner demote/remove first owner | at least one owner remains; loser denied |

To force the suspected inversion, A (privileged fixture session) locks issuer
membership `FOR SHARE`. B starts owner remove_member: C must confirm B holds
organization UPDATE and waits on A. A then calls create_batch as that issuer;
its organization FK insert may wait on B. Capture 40P01 if produced and confirm
full rollback of the victim; repeat with approve/revoke and audit insertion.
This fixture pause models the point after require_role and before a later FK
insert without adding sleeps or test hooks to production functions. If reproduced,
propose consistent organization-first locks in affected writers, then rerun all
orderings plus cap tests before an additive migration is accepted.

Finish with `pg_ctl -D <exact disposable cluster directory> stop -m fast`.
No cleanup/delete command is required; retain logs for review. Never aim this
design at an existing database. The coordinator owns execution/review of this
design when a true PostgreSQL runtime becomes available.

## Decisions, risks and verification

No product decision proposal: existing suspension, status and public-field
defaults are preserved. Engineering recommendation: reproduce the suspected
inversion and cross-resource key collision before pilot; do not accept single
connection evidence as satisfying the concurrency gate. Remaining risks include
deadlock availability/retry behavior, post-wait snapshots and actual runtime lock
behavior. No production safety certification is implied.

Before every test/check, PowerShell set `$env:VITE_SUPABASE_URL='';
$env:VITE_SUPABASE_PUBLISHABLE_KEY=''`.

| Actual command | Result |
| --- | --- |
| `npm ci` | pass, 290 packages installed; audit reported 12 high vulnerabilities (no dependency changes authorized) |
| `npx vitest run --config vitest.db.config.ts supabase/tests/concurrency-hardening.test.ts` | pass, 6/6, 1 file, 2.90s |
| `npm run test:db` | pass, 182/182, 12 files, 21.76s |
| `npm run typecheck` | pass, exit 0 |
| `npm run lint` | pass, exit 0 |
| `git diff --check` | pass |
| Multi-connection PostgreSQL execution | NOT RUN: no installed runtime/daemon; design above remains unverified |
| Unit/build/browser suites | NOT RUN: no application or build changes; focused and full DB coverage run |

Independent review is pending; coordinator should review this report and tests
before integration. Local commit identifies delivered changes; no push, merge,
cloud operations, policy changes or human approvals were performed.

## Follow-up: portable PostgreSQL execution and demonstrated fix

Task `task_a478793e7c81` supersedes the earlier runtime-unavailable conclusion.
Prior commit `b1da9db` is preserved. Portable execution was reachable and should
have been attempted in the first audit. Sources consulted: maintained package
[repository](https://github.com/leinelissen/embedded-postgres) and its
[Windows binary package](https://www.npmjs.com/package/@embedded-postgres/windows-x64).
Registry metadata reported package modification 2026-10-30. Official binary
installation was unnecessary once the maintained Windows package ran successfully.

Runtime directory (outside repository):
`C:/Users/James/AppData/Local/Temp/verimark-concurrency-d98f71d4092741578540b324575a9f26`.
Binary subdirectory: `node_modules/@embedded-postgres/windows-x64/native/bin`.
Cluster: `data`; log: `server.log`, both beneath that temporary directory.
No global installation, service, account creation, repository dependency change,
hosted request or environment-file copy occurred. npm scripts were disabled;
the package's `pg-symlinks.json` was empty so hydration was unnecessary.

Exact setup commands (PowerShell, `$runtimeDir` set to the directory above):

```powershell
npm view embedded-postgres version description dist.tarball
npm view @embedded-postgres/windows-x64 version description dist.tarball
npm view embedded-postgres readme
npm view @embedded-postgres/windows-x64 scripts dist.unpackedSize repository
npm view embedded-postgres repository time.modified
npm install --prefix $runtimeDir --ignore-scripts --no-audit --no-fund @embedded-postgres/windows-x64@18.6.0-beta.19 pg@8.16.3
# 15 packages installed successfully outside repo
$pgBin = Join-Path $runtimeDir 'node_modules/@embedded-postgres/windows-x64/native/bin'
& (Join-Path $pgBin 'postgres.exe') --version
# postgres (PostgreSQL) 18.6
& (Join-Path $pgBin 'initdb.exe') -D (Join-Path $runtimeDir 'data') -A trust -U postgres --encoding=UTF8 --locale=C
& (Join-Path $pgBin 'pg_ctl.exe') -D (Join-Path $runtimeDir 'data') -l (Join-Path $runtimeDir 'server.log') -o '-h 127.0.0.1 -p 35479' -w start
```

Trust authentication was limited to a throwaway loopback server, stopped after
execution; no real data was loaded. The committed runner creates a fresh database,
uses the existing Supabase shim and sorted migrations, then drops only that database.
Roles are cluster-wide and retained in the stopped disposable cluster. Independent
clients use READ COMMITTED; an observer confirms `wait_event_type=Lock` and
`pg_blocking_pids(B)` includes A before proceeding. The pause between authorization
and batch creation calls the actual helper, with no production test hooks.

Before adding the new migration:
`node tools/test-concurrency.mjs $runtimeDir --expect-deadlock` passed 3/3
expectations. A PID 21728 blocked B PID 36344 at all three barriers. Exact issue
replay returned the same result and counts 1 credential / 1 event / 1 receipt;
issue waiting behind removal returned `VM:NOT_FOUND` with counts unchanged;
the member-first schedule produced `40P01 deadlock detected` on A and B removal
succeeded. This demonstrates an availability defect, not an authorization bypass.

Fix: additive `20261118010000_concurrency_hardening.sql` replaces only
`app.require_role`, acquiring organization SHARE before membership SHARE.
Existing organization-first RPCs retain their order; formerly member-first
callers now hold organization SHARE before any later FK KEY SHARE. This removes
the demonstrated cycle with organization UPDATE in membership administration.
UID/role errors, grants, RLS and policy defaults remain unchanged. Read RPCs using
this helper now also hold an organization SHARE lock until transaction end;
this may increase contention with administration and deserves review.

After migration, `node tools/test-concurrency.mjs $runtimeDir` passed 3/3
expectations. A PID 17964 blocked B PID 18728 at all three barriers; duplicate
replay and post-wait denial retained their results and counts, while both draft
creation and removal committed without deadlock. An initial repeat attempt failed
at setup with SQLSTATE 42710, `role "anon" already exists`: the runner was then
corrected to reuse cluster roles when creating subsequent disposable databases.
That failed setup database was removed by the runner's finally block.

Post-fix `npm run test:db`: 182/182 across 12 files, 34.75s; `npm run typecheck`,
`npm run lint`, `git diff --check`: all exit 0. Vite Supabase variables were blanked
before checks. No browser/build checks were needed for this SQL/tool-only change.
No antivirus, provider or network errors occurred.

Remaining: independent coordinator review requested; other schedules in the
matrix (including suspension waits, competing different keys, last-owner races,
caps, capability regeneration and cross-resource receipt collisions) have not
been executed concurrently. Three passing schedules do not certify all races.
No product decision proposal was needed. Stop/lifecycle evidence follows below.

Shutdown command:
`pg_ctl.exe -D <runtimeDir>/data -m fast -w stop` returned exit 0,
`server stopped`; subsequent `pg_ctl.exe -D <runtimeDir>/data status` returned
exit 3, `no server running`. `Get-NetTCPConnection -LocalPort 35479 -State Listen
-ErrorAction SilentlyContinue` returned no listener. Temporary binaries, stopped
cluster and logs are retained for review; no service was registered.
