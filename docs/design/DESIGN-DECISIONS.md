# Design decisions — provisional

| Decision | Rationale | Status |
| --- | --- | --- |
| Standalone offline HTML prototypes | Preview without package installation or production app scaffolding | Authorized local exploration |
| Fictional fixture on every view | Prevent confusion with actual credential issuance | Required |
| Status written in words | Trust must not depend on color perception | Required |
| No fake QR seal | A QR link is not authenticity evidence | Required |
| Explicit review before local approval | Make recipient/achievement confirmation reviewable | Demo implemented |
| In-memory session only | Avoid retaining entered names; refresh clears demo issuance | Demo implemented |
| Text summary download | Show recipient artifact interaction without claiming PDF issuance | Prototype limitation |
| Public fields limited to comparison fields | No email, private evidence, birthdate or directory in demo | Product privacy policy pending |
| Shared journey logic, distinct visual treatments | Review visual choices against consistent content | Implemented |
| Recommend Civic Ledger | Public-record hierarchy supports comparison | Human approval pending |

No final production tokens, API contract, auth model, schema or signing standard is established here. Scenario selectors are visibly labeled review tools, not proposed product controls. Exceptional scenario selection hides the happy-path content to avoid conflicting valid/revoked signals; reset restores it. Actual production state priority and server error mapping need implementation review.

No screen-reader study or user comprehension research has occurred. Real backend authorization and negative access tests belong to a future functional slice; the denied screen here is presentation only.

## M1 approval update - 2026-11-15

The owner approved Editorial Systems for application implementation in the master prompt. Its authoritative committed package is design-references/verimark-visual-design. Earlier exploration recommendations and pending-approval labels below are historical; they do not override current authorization. M1 delivers frontend demonstration only; see docs/ai/handoffs/M1.md.
