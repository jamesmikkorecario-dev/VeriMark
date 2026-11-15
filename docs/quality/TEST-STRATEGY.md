# VeriMark test strategy

M1 implements frontend static, unit/component, build and browser gates; see docs/ai/handoffs/M1.md for exact passing evidence. Backend/API/RLS and later lifecycle tests below remain planned. Documentation validation is not software execution. Behavior and permissions must follow the PRD, API contracts and database/RLS docs; see SECURITY-THREAT-MODEL.md for threat analysis.

| Layer | Required coverage before accepting the affected slice |
| --- | --- |
| Static | Lockfile install, lint, strict types, formatting, build, secret/dependency scan |
| Unit | CSV headers/rows/size, formula-safe recipient-link exports, expiry boundaries, lifecycle transitions, PDF field mapping, QR URL encoding |
| Component | Issuer review labels, CSV preview/confirmation, form validation, loading/empty/error/success/denied states; keyboard/focus |
| Integration/API | Real isolated Postgres RLS, RPC and Storage policies; atomic batch issuance, idempotent retries, protected audit writes, immutable snapshots, replacement links, limited public projection |
| E2E | Approved issuer signs in, single/CSV preview, issue, PDF download/link export; anonymous verification; revoke/replace and reverify |
| Accessibility | Automated axe plus manual keyboard, screen reader spot checks, focus restoration/status announcements, contrast/reduced motion; proposed WCAG 2.2 AA target |
| Visual/responsive | Reviewed deterministic snapshots at 360/768/1440 px; long names, all status/error states, PDF print layout and QR scan; no blanket baseline updates |
| Performance | PERFORMANCE.md budgets, pagination and bounded batches; indexed queries measured under RLS |
| Security | Direct authorization-negative cases below, throttling, upload validation; independent review |

MVP uses downloadable PDFs and recipient-link exports, no automated bulk credential mail, public directory, wallet or cryptographic-proof claims. A genuine QR pasted onto a changed PDF must still prompt comparison with official fields. Database-only verification does not prove offline document integrity or accreditation.

## Authorization-negative matrix

Use synthetic tenants A/B with owner/issuer/reviewer/viewer fixtures and genuine anon/user sessions. Never run authorization checks solely through service-role bypass or UI mocks. Role grants follow canonical contracts; do not infer that reviewer means issuer. Every denied action asserts no private fields/object access, no data changes and no unauthorized audit insertion.

| Actor / request | Expected trusted-boundary result |
| --- | --- |
| Anonymous private credential/batch/import/evidence/member/audit read | Denied; only restricted public lookup allowed |
| A user substitutes B organization/record/batch/template/storage path | Denied for SELECT/INSERT/UPDATE/DELETE, RPC and signed-download creation |
| Viewer/reviewer attempts issue/revoke/replace/membership escalation without grant | Denied by server/database |
| Unreviewed/suspended issuer attempts issuance | Denied per canonical issuer-state policy |
| Removed member, expired or tampered session retries operation | Denied including stale cached UI path |
| Client sets own role/org/review state or directly writes audit | Denied; authority derived at trusted boundary |
| Recipient requests another private delivery/export token | Denied; intentionally public verification fields remain limited |
| Public verifier enumerates IDs/searches names/requests email, student ID or evidence | No directory/private fields; abuse throttled; unpredictable IDs |
| Any user edits issued snapshot or erases lifecycle history | Denied; authorized corrections create tracked replacement |
| Duplicate/replayed issuance, concurrent revoke/replace, partial batch failure | No duplicates/untracked partial issuance; transaction/idempotency contract tested |

Status cases: valid, expired, revoked, replaced, not found, unable to verify; exact expiry boundary, replacement navigation, malformed IDs and forged fields. Proposed precedence is revoked > replaced > expired > valid; confirm the policy before implementation. Backend failure must never become valid or not found.

## Evidence and gates

For each case record story/requirement ID, fixture/cleanup, Given/When/Then, expected error, actual command, SHA, environment and sanitized output. Use PASS / FAIL / SKIPPED / NOT RUN / NOT CONFIGURED. Start focused checks then full configured suite; no shared/prod DB tests. Flaky exceptions require owner/expiry and cannot waive tenant isolation. Once configured, required gates fail closed. Script inventory: ../delivery/SETUP-AND-VALIDATION.md.
