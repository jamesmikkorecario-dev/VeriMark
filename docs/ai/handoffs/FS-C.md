# VeriMark handoff: FS-C

- Status: ready for review
- Owner / independent reviewer: FS-C worker (Orca task task_db50e37a8a6d) / coordinator review pending
- Goal / stories / acceptance coverage: FR-002 templates, FR-003 single issuance, FR-004 CSV batch preview and issue, FR-007 revoke/replace plus delivery-link creation (FR-005 issuer side), FR-008 activity and dashboard metrics. Covers scope items 1–6 of the FS-C task.
- Branch / worktree / base SHA / delivered SHA: `jamesmikkorecario-dev/fs-c-issuer-features` in `C:/Users/James/orca/workspaces/VeriMark/fs-c-issuer-features`; base `61035bd`; implementation head `f3989df` (this report is committed separately after it).

## Exact changed paths and reasons

| Path | Reason |
| --- | --- |
| `src/lib/csv/index.ts`, `csv.test.ts` | RFC 4180 parser (quotes, `""`, CRLF/LF/CR, BOM, embedded newlines, syntax errors), `parseRecipientCsv`, `readRecipientCsvFile` (2 MiB check before reading), shared `validateDraftRow`/`normalizeDraftRow`/`checkExpiryDate`, `toCsv` with formula neutralisation, `sampleRecipientCsv` |
| `src/features/credentials/shared/errors.ts` | `ApiError.code` → friendly copy; field-code → message. Raw server text is never shown |
| `src/features/credentials/shared/format.ts` | UTC date formatting, file download, audit action wording, idempotency key creation |
| `src/features/credentials/shared/components.tsx`, `app-pages.css` | `DemoNotice`, `PageIntro`, `ErrorSummary`, `TextArea`, `ScrollRegion`, native `<dialog>` `Modal`; FS-C styles built only from existing tokens |
| `src/features/credentials/shared/testing.tsx` | Test-only: hand-written fake `VeriMarkApi`, workspace/router wrapper, `<dialog>` polyfill for jsdom, fixtures (all fictional) |
| `src/features/templates/TemplatesPage.tsx`, `CertificatePreview.tsx`, test | List, create/edit with live HTML preview, `expectedRevision` save, REVISION_CONFLICT reload, archive confirmation, viewer read-only |
| `src/features/issuance/IssuePage.tsx`, test | Stepped single/CSV flow: draft → preview → confirm → approve → issue → result + CSV export |
| `src/features/credentials/CredentialsPage.tsx`, test | Debounced search (300 ms), status filter, `?search=` deep link, table → stacked cards under 720 px, keyset "Load more" |
| `src/features/credentials/CredentialDetailPage.tsx`, `LifecycleDialogs.tsx`, test | All detail fields, history, predecessor/successor, verification link copy/open, PDF download, recipient link, revoke, replace |
| `src/features/activity/ActivityPage.tsx`, `DashboardHome.tsx`, `activity.test.tsx` | Paginated audit history; metrics, five recent records, role/review-aware next steps |
| `docs/ai/handoffs/FS-C.md` | This report |

No frozen file, dependency, config, UI kit or style token was changed.

## Inputs/contracts consumed; API/migration/env effects

Consumes `VeriMarkApi` (types.ts), `useApi`, `useWorkspace`, and `renderCertificatePdf`/`verificationUrl` from `src/lib/certificate` (mocked in tests; FS-B implements). No API, migration or env changes.

## Decisions/deviations/constraints preserved

- **Idempotency.** Issue: one `crypto.randomUUID()` per *approval* of a batch, stored in a ref and reused for every retry of `issueBatch`; the approve call is not repeated on retry. If the server says `APPROVAL_REQUIRED` or `REVISION_CONFLICT`, the approval and key are dropped and the user re-reviews (nothing was issued under that key). Revoke/replace: one key per exact payload (reason + replacement); a retry with identical input reuses it, changed input gets a new key so one key never carries two payloads. A double revoke/replace is still refused by the server as `INVALID_TRANSITION`.
- **Ineligible organizations** (`reviewState !== 'reviewed'`, or `ISSUER_NOT_ELIGIBLE` from the server) can choose a template and validate a form/CSV, but "Review records" is disabled so no draft batch is created. Notice shown up front.
- **CSV row numbers** are 1-based *data* rows (row 1 = first record after the header); completely blank lines are ignored and not counted. Header/file-level errors use row 0 and are shown as "Header / file". Server `FieldError` rows are assumed to use the same numbering (matches `PreviewRow.sourceRow` = index + 1).
- **Expiry dates** must be strictly after today's UTC date (the task says "real future date"). If the backend accepts today, the UI is slightly stricter.
- **Duplicate detection** compares recipient name + title + achievement case-insensitively with whitespace collapsed; later duplicates are flagged.
- **Recipient link** always needs confirmation (the UI cannot know whether an earlier link exists); the dialog warns that earlier links stop working. The link is held only in component state and is gone after leaving the page.
- **PDF download and recipient link** are offered only for `valid`/`expired` records (hidden for revoked/replaced, like revoke/replace), and only to owners/issuers.
- **Predecessor/successor links** use `/app/credentials?search=<publicId>` because the contract gives only public IDs for them; this relies on the backend search matching public IDs.
- **Audit action wording** maps likely codes (`credential.revoked`, `template.created`, …) and otherwise humanises the code; the action vocabulary is not fixed in the contract.
- `NOT_FOUND` and `FORBIDDEN` on a record both show the same non-disclosing "record unavailable" state.
- `Modal` uses native `showModal()`; it also focuses the first control explicitly and restores focus to the trigger when closed. Escape and Cancel are ignored while a request is pending.

| Actual command/check | Result | Evidence/environment/commit |
| --- | --- | --- |
| `npm ci` | PASS | 0 vulnerabilities |
| `npm run typecheck` | PASS | `tsc --noEmit`, no output, at `f3989df` |
| `npm run lint` | PASS | `eslint .`, no warnings or errors |
| `npm test -- --run` | PASS | 12 files, 103 tests. FS-C: csv 22, templates 7, issue 12, credentials list 7, detail 9, activity/dashboard 6 = 63 |
| `npm run build` | PASS | Vite build, JS 286.66 kB (89.91 kB gzip), CSS 27.09 kB |
| `git log 61035bd..HEAD --format=%B \| grep -Ei "co-authored-by\|generated with\|anthropic\|openai"` | PASS | no matches |
| Playwright / visual 320 px check | NOT RUN | Not required by the task; the pages are not routed until integration with FS-A |

## Security/privacy/design risks

- 320 px reflow, focus visibility and reduced-motion were built in CSS (stacked tables, wrapping, scroll regions, `prefers-reduced-motion`) but not checked in a browser. FS-E2E should cover them after integration.
- jsdom has no full `<dialog>`; the tests use a small polyfill, so native modal inertness and Escape are checked only in a real browser.
- The recipient link token is shown in a read-only input and never logged or stored; it remains in React state until the user leaves the page.
- Recipient e-mail is shown only when `canIssue`; the backend already returns `null` to viewers.

## Open decisions / next owner

- Coordinator/FS-A: route the default exports (already at the contract paths). FS-B: real `renderCertificatePdf`.
- Confirm: the server row-numbering for `FieldError.row`, whether search matches public IDs, the audit action vocabulary, and whether today counts as a valid expiry date.

## Independent review status/findings

Not yet reviewed.

## Human approvals still needed

None for this slice beyond the existing ADR-0005 owner decisions.
