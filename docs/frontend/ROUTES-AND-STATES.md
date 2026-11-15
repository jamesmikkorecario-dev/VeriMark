# VeriMark routes, screens and states — proposed

Production route names below are proposals, not implemented URLs. All visual directions and production tokens await human selection. The actual offline files use hash screens; account-free recipient access is a guarded individual capability, not public ID access. Story IDs refer to the integrated product USER-STORIES document; API semantics follow architecture/API-CONTRACTS.

| Offline screen | Proposed production route | Stories and purpose | Loading / empty | Success / failure |
| --- | --- | --- | --- | --- |
| #landing | / | US-006 entry; US-001 issuer entry; US-009 honest pilot positioning | Static explanatory content; no invented usage metrics | Choose verify or issuer sign-in; never claim accreditation or real adoption from demo data |
| #verify | /verify | US-006 exact-ID public lookup | Labeled pending check; empty input prompts entry | Valid/expired/revoked/replaced distinct; invalid syntax, not found, rate limited and unable distinct |
| #details | /verify/:publicId | US-006 comparison; US-007 replacement history | Pending authoritative check; no empty success card | Approved fields, checked time and issuer review explanation; missing record vs unavailable service distinguished |
| #dashboard | /organizations/:organizationId/dashboard | US-001 scoped membership/review, US-008 history and counts; US-002 template entry; US-004 batch progress | Stable skeleton; empty own-organization list with permitted next action | Paginated authorized records; denied/inaccessible, stale revision and service error; never tenant discovery |
| #issue | /organizations/:organizationId/issuance/new | US-003 single review/approve; US-002 template selection; US-004 CSV preparation/progress | Load permitted templates; no template/rows means no approval | Field/row validation, review, changed-draft conflict, issuing, success; explicit approval/eligibility denial and recoverable PDF failure |
| #recipient | /receive | US-005 account-free individual access | Capability exchange pending; PDF pending is distinct from empty record | Guarded record/download; unavailable capability, PDF failure and expired download URL handled separately |

US-007 revoke/replace controls are proposed private record-detail actions reached from dashboard, not implemented prototype mutations. US-001 membership/review and US-002 template editing require later dedicated subviews, not falsely represented as complete by the six views. US-004 CSV upload/row errors and partial PDF progress are future issuance substeps; prototype only creates a single in-memory record. US-008 prototype metrics/history are fictional fixtures. US-009 has no separate pilot app screen: its consent, privacy, accessibility and honest-measurement gates cover all six journeys and require operator review before real data or deployment. All US-001..009 remain planned product behavior; visual prototypes do not satisfy their server acceptance criteria.

## Status and transport rules

| State | Required presentation and recovery |
| --- | --- |
| Valid | Recognized by issuer at server checked_at; still compare name, achievement, issuer and date |
| Expired | Validity ended, including expires_at equal to checked_at; never use current-valid styling |
| Revoked | Issuer withdrew record; no public private reason, no unrevocation action |
| Replaced | Original claims remain; explicit superseded label and approved replacement link only if privacy policy permits; never auto-redirect or show original as valid |
| Not found | No approved public record for exact ID; no directory or wildcard suggestions |
| Unable to verify | Timeout, offline or dependency failure means no conclusion; retry affordance, no stale-valid claim |
| Invalid input | Associated field error, keep input; does not imply a credential was revoked |
| Empty | No own-organization records/template/rows yet; permitted next action, not a service error |
| Denied / unauthenticated | Known member action denial explains permission; inaccessible cross-tenant resource gets non-disclosing unavailable view; sign-in only for private issuer routes |
| Conflict / ineligible | 409 stale revision, missing approval or issuer eligibility: explain review again; preserve draft, no automatic new issuance |
| Throttled / service error | 429 uses server Retry-After; 500/503 use safe request reference and bounded retry; never expose SQL or tokens |
| Mutation pending / success | Block duplicate approval, announce result; timeout checks operation or replays same idempotency key, never blindly starts another issuance |

Proposed authoritative precedence is revoked > replaced > expired > valid; not found/unable are lookup outcomes, not lifecycle values. Show textual status and current issuer-review state separately. Review means identity/authority review, not accreditation. A QR only opens the official URL; comparison remains required. No portable cryptographic proof is checked in MVP.

## Recipient capability and PDF states

On /receive read secret from fragment, remove it immediately from location, then exchange through POST without third-party scripts/analytics or referrer leakage. Public ID must never authorize private PDF retrieval. Invalid, expired and revoked capability all show the same DELIVERY_UNAVAILABLE message: this access link is unavailable, contact the issuer for a fresh link. Do not reveal which condition occurred, or another recipient's data. A valid scoped session may show PDF pending (record issued, document processing), ready (download action), or failed (record issued, document unavailable; issuer recovery required). Failed PDF retry is an issuer action and cannot create another credential. An expired signed download URL requires a new authorized download request; unavailable delivery session requires fresh issuer access. Do not embed secret links in QR/public sharing controls. PDF generation and delivery are planned; prototype downloads only a fictional text summary.

## Navigation, focus and responsive acceptance

Deep links/refreshed routes must resolve directly; private issuer sign-in returns only to an allowlisted internal route after fresh permission checks. No recipient/verifier account required. New page focuses heading/main; inline result uses a polite status region without stealing focus. Submission errors focus a linked error summary, then field links; review step focuses its heading, edit returns to edited field. Modal confirmation for revoke/replace requires labeled reason, clear consequences, cancel focus restoration and no keyboard trap; successful mutation focuses updated status. No destructive lifecycle undo is promised.

Test 320/390px mobile, 768px tablet, 1440px desktop and 200% text/400% browser zoom for reflow. Stack comparison fields on narrow screens; keep labels, status and action reachable; contain large private tables in labeled scroll regions with keyboard access. Long names/IDs wrap without truncating comparison information. Preserve focus/input through loading, error and orientation change. Record negative authorization, capability/PDF state and deep-link tests alongside story evidence; these production checks remain unrun. Existing prototype evidence covers 390/1440px only; see design review and INIT-C handoff for actual results.
