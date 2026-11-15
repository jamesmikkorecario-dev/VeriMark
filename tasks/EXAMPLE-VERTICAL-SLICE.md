# VM-04 ? Issue one credential and verify its official status

This is VeriMark's planned first trust slice, not an implemented example. Stories US-003/006, requirements FR-003/006, milestone M04. Proposed branch: feat/vm-04-issue-verify. Owner: backend/database/frontend engineers in explicitly split files; independent QA and security/code reviewer. Depends on M03 auth/organization/RLS and approved M02 design.

Goal: an authorized member of an approved organization issues one validated credential and a third party compares its public fields without an account. Use one reviewed fixture template; template authoring, CSV, PDFs/delivery, wallet, cryptography and email are separate milestones.

Likely scope: future credential migration/RLS, guarded issuance RPC/Edge handler, public projection endpoint, issuer confirmation and public verification route, tests. Exact file ownership and API/status contracts must be frozen before dispatch. Issued claims immutable; audit and idempotency required.

Acceptance:
- Approved authorized issuer creates one record with unpredictable ID; retry yields same result.
- Anonymous, wrong-role and another tenant cannot issue/read private records or mutate claims.
- Public lookup exposes only agreed allowlist; no emails/private evidence/table browse.
- Valid, expired, revoked, not found and unable to verify are distinct under agreed fixtures; outage is never not found.
- Verification asks user to compare attributes and explains issuer-review limitations; QR alone is not proof.
- Keyboard/mobile and loading/empty/error/success/denied states work.

Evidence: EV-US-003/006; RLS role/tenant denial tests, issuance retry/immutability tests, public projection contract tests and critical browser journey. Actual commands are not configured; M03 supplies them. Handoff includes branch/SHA, exact paths and observed results. No merge/deploy without explicit human approval.
