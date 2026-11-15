# VeriMark component contract — provisional

This is a proposed React.js + TypeScript component inventory for the mandatory Vite frontend and Supabase/PostgreSQL/Auth backend, hosted on Vercel free tiers only. It introduces no package, production implementation or approved visual tokens. Visual selection is pending; see DESIGN-SYSTEM.md. Feature services own API/state transitions; presentation components never bypass server authorization or access Supabase with privileged credentials.

| Component / story use | Proposed inputs and state | Semantics, focus and responsive contract |
| --- | --- | --- |
| PublicShell / US-006, US-005 | title, navigation, main content, demo flag | Header/nav/main/footer, one page H1, skip link, visible current page; route change focuses main; mobile links wrap |
| IssuerShell / US-001, US-008 | authorized organization summary, allowed actions, pending/error | Explicit organization context; no cross-tenant data during switch; focus page heading after load; denied shell renders no private content |
| FormField / US-001..005 | label, value, required, description, field error, onChange | Native labeled input/select; error linked by aria-describedby and aria-invalid; keep user input; no placeholder-only labels |
| ActionButton / US-003, US-007 | type, label, pending, disabled reason, onAction | Native button; pending accessible label and duplicate-submit guard; unavailable action explanation outside disabled control; target at least 44px high |
| StatusNotice / US-003, US-005..008 | discriminated lifecycle or transport outcome, checkedAt, retry action | Text and optional icon, never color alone; polite async announcement, urgent blocking error once; reserve layout space; no multiple competing live regions |
| CredentialComparison / US-005, US-006 | approved public DTO keyed by exact public ID | Definition list for recipient/title/achievement/issuer/dates/ID; long text wraps; selected ID never uses another issuance's mutable fixture |
| IssuerTrustExplanation / US-001, US-006 | review state, historical issuer label | Always explain reviewed identity/authority is not accreditation; separate current review state from credential lifecycle |
| ExactIdLookup / US-006 | input, pending/result, onSubmit | Form supports Enter; format error associated with field, not-found distinct from outage; no directory or wildcard autocomplete |
| IssuanceReview / US-002..004 | normalized draft, template revision, row errors, preview digest, approval state | Step headings, change/edit controls and explicit approve; editing invalidates review; errors link to row/field; no real credentials from offline demo |
| RecipientRows / US-004 | bounded row summaries, errors/duplicates, progress | Private labeled table with headers, row number and field errors; no formulas executed; narrow view scrolls inside region; count partial PDF failures explicitly |
| LifecycleConfirmation / US-007 | operation revoke/replace, target ID, private reason, pending/conflict | Explicit original/new comparison; confirm and cancel; accessible dialog only if needed with focus containment/restoration; no silent original-claim edit |
| HistoryList / US-008 | authorized page, cursor, filters, counts, empty/error | Semantic table/list, stable row identity; next-page loading announced; focus stays on pagination trigger; aggregates labeled demo vs real |
| RecipientAccess / US-005 | capability-exchange outcome, scoped record, PDF state | Common unavailable message for invalid/expired/revoked capability; no login or wallet; no token in rendered error, analytics or logs |
| PdfDownload / US-005 | pending/ready/failed, session outcome, onDownload | State-specific text, labeled download button; pending is not issuance failure; expired signed URL renews through authorized request; failure does not reissue |
| EmptyState / US-001..004, US-008 | reason and permission-appropriate action | Heading and explanation; never displayed for outage or denial; no inaccessible action as sole recovery |

## Proposed typed boundaries

Use discriminated unions rather than independent booleans that allow contradictory outcomes. LifecycleStatus is valid/expired/revoked/replaced; LookupOutcome is pending/found/notFound/unable/rateLimited/invalid. PdfState is pending/ready/failed; DeliveryOutcome is pending/available/unavailable/error. Found carries an exact-ID record and server checked time; unavailable carries no private comparison data. These are documentation proposals to reconcile with canonical API schemas before implementation, not exported types today.

Permission-aware action visibility is presentation only; server policies enforce roles/organization on every operation. Components take minimal DTOs rather than raw database rows or bearer secrets. Recipient capability exchange stays in a dedicated service; no primitive sees delivery tokens. Public comparison never accepts private email, evidence, student identifiers or signed storage URLs. US-009 requires all demos/seeds clearly marked, no fabricated success counts, and consented pilot evidence before real records.

## Verification requirements

Meaningful component tests must check exact-ID identity after issuing another record, status precedence/replacement labels, field-error associations, pending duplicate prevention, conflict preserving drafts, capability non-disclosure, and PDF failure vs issuance success. Keyboard tests cover lookup Enter, review/edit/approve, table paging and confirmation cancel/focus restoration. Responsive tests cover long comparison fields and row errors at narrow widths and zoom. Axe checks supplement manual screen-reader and focus checks; they cannot certify conformance. No production components or tests are implemented by this document. The offline shared HTML logic is an exploration artifact and does not define a production component API.
