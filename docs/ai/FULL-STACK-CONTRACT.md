# Full-stack implementation contract

Authority: owner's Autonomous Full-Stack Engineering Master Prompt, 2026-11-16. Architecture: `docs/architecture/adr/0005-full-stack-release-candidate.md`. Product scope: FR-001..FR-008 in `docs/product/PRD.md`. FR-009 (pilot) needs a separate owner approval and is out of scope.

- Integration branch / worktree: `dev/full-stack-integration` at `C:/Users/James/orca/workspaces/VeriMark/full-stack-integration`, based on the M1 head `c45bf28`.
- The primary checkout stays on `main`. No push, no merge to `main`, no deployment, no cloud provisioning, no paid services.
- Commit messages follow `docs/delivery/COMMIT-POLICY.md` (no AI attribution of any kind; the `commit-msg` hook enforces it).
- Preserve the approved Editorial Systems design: reuse `src/components/ui` and the existing CSS tokens; no new fonts, colours or UI libraries.

## Frozen shared contract (do not edit; ask the coordinator)

- `src/lib/api/types.ts`, `src/lib/api/context.tsx`, `src/lib/api/index.ts`
- `src/features/organizations/WorkspaceContext.tsx`
- `src/lib/certificate/index.ts` exports (`CertificateInput`, `verificationUrl`, `renderCertificatePdf`) – FS-B implements the body
- `src/components/ui/**`, `src/styles/**`, `package.json`, `package-lock.json`, config files. If a dependency or shared component is truly needed, stop and `ask`.

Pages get the API with `useApi()` and, inside `/app`, the workspace with `useWorkspace()`. Component tests inject a fake `VeriMarkApi` through `ApiProvider`. Errors are `ApiError` with a stable `code`; map codes to messages in the UI and never show raw server text.

## Routes

| Route | Component (default export) | Owner |
| --- | --- | --- |
| `/` | existing `LandingPage` | FS-A (links only) |
| `/verify`, `/verify/:publicId` | `src/features/verification/VerifyPage.tsx` | FS-B |
| `/receive` (secret in `#fragment`) | `src/features/delivery/ReceivePage.tsx` | FS-B |
| `/sign-in`, `/sign-up`, `/reset-password`, `/update-password`, `/invite` (token in `#fragment`) | `src/features/auth/*` | FS-A |
| `/app` guard + layout, `/app/onboarding`, `/app/organization`, `/app/review` | `src/features/organizations/*`, `src/features/admin/*` | FS-A |
| `/app` (index) | `src/features/activity/DashboardHome.tsx` | FS-C |
| `/app/credentials`, `/app/credentials/:credentialId` | `src/features/credentials/CredentialsPage.tsx`, `CredentialDetailPage.tsx` | FS-C |
| `/app/issue` | `src/features/issuance/IssuePage.tsx` | FS-C |
| `/app/templates` | `src/features/templates/TemplatesPage.tsx` | FS-C |
| `/app/activity` | `src/features/activity/ActivityPage.tsx` | FS-C |
| `/workspace`, `/workspace/:section`, `/preview/:section` | unchanged M1 demonstration routes | – |

Public pages render inside the existing `PublicLayout`. `/app` pages render only their content; FS-A's layout supplies the shell, the `<main id="main">`, the heading focus behaviour and `WorkspaceContext`. Each page sets one `<h1>`.

## Rules every adapter and page must honour

- Roles: owner, issuer, viewer. Owner and issuer may edit templates, issue, revoke, replace and create delivery links. Only owners manage members, invites and the organization name. Viewers read. The UI hides what a role cannot do, and the backend refuses it regardless.
- Only a `reviewed` organization can issue. `pending` and `suspended` get `ISSUER_NOT_ELIGIBLE`; the UI explains this and never pretends to issue.
- Status precedence: revoked > replaced > expired > valid. Issued content is immutable; a correction is a replacement.
- Public verification shows only `VerificationResult`. "Not found" and "unable to verify" are different outcomes; a failure never renders as valid or as not found. Always tell the verifier to compare the document with the record, and that issuer review is an identity check, not accreditation. No cryptographic-proof claims.
- Delivery: read the secret from `location.hash`, remove it from the URL at once (`history.replaceState`), never store or log it. Invalid, expired and revoked links show one identical "unavailable" message.
- Every page has loading, empty, error (with retry where sensible), success and denied states, works at 320 px wide with no horizontal document overflow, is keyboard operable with visible focus, and respects `prefers-reduced-motion`.
- Demo mode (`api.mode === 'demo'`) is labelled as a demonstration with fictional data on every screen.

## Limits (validated in the UI and again by the backend)

Recipient display name and title 1..200 characters; achievement 1..2000; reason 1..1000; organization and template names 1..120; template text fields per `TemplateConfig` comments; batch 1..200 rows; CSV at most 2 MiB; expiry date must be in the future; password at least 10 characters. CSV columns: `recipient_name,title,achievement,email,expires_on` (header required; `email` and `expires_on` optional). Report every row error before anything is created. Never evaluate cell contents; when exporting CSV, prefix cells that start with `= + - @` (or tab/CR) with a single quote.

## Tasks

| Task | Scope | Owns (exclusive write) |
| --- | --- | --- |
| FS-DB | Schema, RLS, RPCs, database tests, Supabase adapter | `supabase/**`, `src/lib/api/supabaseAdapter.ts` (+ test), `docs/database/**` |
| FS-A | Demo adapter, app routing and guard, auth, onboarding, organization/members/invites, platform review | `src/lib/api/demoAdapter.ts` (+ test), `src/app/**`, `src/main.tsx`, `src/components/layout/**`, `src/features/auth/**`, `src/features/organizations/**` (not `WorkspaceContext.tsx`), `src/features/admin/**`, `src/pages/**`, `e2e/app-auth.spec.ts` |
| FS-B | Public verification, recipient delivery, certificate PDF/QR | `src/features/verification/**`, `src/features/delivery/**`, `src/lib/certificate/**` |
| FS-C | Templates, issuance (single + CSV), credentials list/detail, revoke/replace, delivery-link creation, activity, dashboard | `src/features/templates/**`, `src/features/issuance/**`, `src/features/credentials/**`, `src/features/activity/**`, `src/lib/csv/**` |
| FS-E2E (after integration) | Browser journeys on the demo adapter, accessibility, mobile | `e2e/app-*.spec.ts` |

Gates for every task: `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`. The coordinator re-runs them, plus `npm run test:db` and `npm run test:e2e -- --workers=2`, after each integration. Close with `docs/ai/handoffs/<TASK>.md` following `HANDOFF-TEMPLATE.md`.
