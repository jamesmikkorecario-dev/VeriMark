# Hosted verification

`npm run test:hosted` runs the shared rule scenario against real Supabase Auth/PostgREST sessions and checks table privileges, tenant isolation and platform-admin isolation. **Hosted execution has not been authorized or run.** This is a writing suite, not a read-only preflight. It requires a separate disposable Free project; the protected development project is rejected.

## Approval and prerequisites

Follow `e2e-live/README.md` for the complete approval/data plan and browser coverage. Both suites share `fixtures.ts`.

- Obtain explicit owner approval for six fictional Auth accounts, one dedicated test-admin assignment, the pending invitation correction migration, and the permanent records listed in that plan.
- Never use the owner's account, password, service-role key or database password.
- Keep email confirmation enabled. Fixture accounts must be confirmed through an approved operator provisioning process; the harness never creates accounts or changes Auth settings.
- Configure six exact account UUIDs and fictional email addresses in the test worktree's ignored `.env.hosted-test.local`. Invalid or missing configuration fails the explicitly requested hosted suite before authentication.
- Set `VM_TEST_PROJECT_REF`, `VM_TEST_SUPABASE_URL` and `VM_TEST_PUBLISHABLE_KEY` for the separately confirmed disposable project only. The runner never reads application `.env.local` or `VITE_*` credentials. `otovaqtmodpqelwbrglj` is forbidden even with matching URL/ref and write consent.
- Initial setup requires all six accounts to have no memberships. It creates two organizations and prints each UUID immediately. Pin their UUIDs before subsequent runs, including the browser suite. A partial setup requires inspection and explicit recovery: pin any already-created organization independently; only missing expected issuer/viewer memberships may be repaired.

## Coverage

Anonymous table/RPC privileges; direct member write denial; private columns; exact tenant rows; platform admin without implicit tenant reads; owner/issuer/viewer roles; existing-member invitation rejection; approval/digest/idempotency; pending issuer refusal; issuance, public allowlist, revocation, replacement and delivery rotation.

UPDATE/DELETE probes use contradictory filters so they cannot match any row even if privileges regress. The platform-admin INSERT probe targets the existing fictional administrator row, not another account.

Run sequentially, with no concurrent browser suite. Organizations, memberships and fixture roles must match the pinned identities before application writes. The other organization must remain pending. Account sessions are signed out locally after completion.

## Limits

No signup/confirmation/recovery email delivery, concurrent database sessions, rate exhaustion, expiry waiting, backups or performance proof. Public lookup calls update rate/counter records. Immutable issuance/audit history cannot be cleaned up through the application. Never reset the shared development project to clean up tests.
