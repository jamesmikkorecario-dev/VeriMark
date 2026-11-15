# VeriMark handoff: FS-A

- Status: ready for review
- Owner / independent reviewer: FS-A worker (Orca task task_6d1705a6b9b1) / coordinator to assign
- Goal / stories / acceptance coverage: demo adapter (every `VeriMarkApi` method, rule-faithful), app routing and `/app` guard, session context, auth pages (sign-in, sign-up, reset, update password, invite), authenticated workspace layout with `WorkspaceContext`, onboarding, organization/members/invites, platform review, public navigation updates, browser journeys. Covers FR-001 (accounts, organizations, roles, review) for the demo path.
- Branch / worktree / base SHA / delivered SHA: `jamesmikkorecario-dev/fs-a-auth-org` at `C:/Users/James/orca/workspaces/VeriMark/fs-a-auth-org`, base `61035bd`. Implementation commits `8f9f223` (adapter), `10ef385` (routing, auth, workspace, organization, review), `b348f2e` (tests and e2e); implementation head `b348f2e`. The report commit follows separately.

## Changed paths and reasons

| Path | Reason |
| --- | --- |
| `src/lib/api/demoAdapter.ts` | `createDemoApi(options?)`, `mode: 'demo'`; all methods; atomic copy-and-commit mutations; sessionStorage persistence under a versioned key, corrupt or foreign state reseeds; exports `DEMO_PUBLIC_IDS`, `DEMO_ACCOUNTS`, `DEMO_PASSWORD`, `DEMO_STORAGE_KEY`, `statusOf`. Optional `{ storage, now }` for tests; the zero-argument call is unchanged. |
| `src/lib/api/demo/{crypto,state,validation}.ts` | Web Crypto helpers (22-char public ids from 16 bytes, 43-char secrets from 32 bytes, SHA-256), fictional seed and state shape, contract limits and row validation. |
| `src/lib/api/demoAdapter.test.ts` | 32 adapter tests. |
| `src/main.tsx` | `<ApiProvider api={createApi()}>` around the router. |
| `src/app/App.tsx` | Contract route table; `/app` = `RequireAuth` + `AppLayout` with nested FS-B/FS-C/FS-A pages; unknown `/app/*` renders an in-shell not-found. M1 routes unchanged. `EnvironmentContext` from `api.mode`; `AuthProvider`. |
| `src/app/RouteEffects.tsx` (+test) | Titles for all new routes (never from the URL fragment). Main-focus behaviour unchanged and applied to new routes. |
| `src/components/layout/Layouts.tsx`, `environment.ts`, `navigation.css` | Public nav: "Verify a record" and the header "Verify credential" go to `/verify`; added "Sign in"; footer "Recipient view" removed (recipients need a secret link). Ribbon/footer copy depends on mode (demo is labelled fictional; Supabase mode drops the "fictional" ribbon). Tighter nav gap between 801 and 1100 px so five links fit. `IssuerWorkspaceLayout` untouched. |
| `src/pages/LandingPage.tsx` | "Verify a credential" CTA, method "Verify" card and "For verifiers" go to `/verify`; "For recipients" is no longer a link and says recipients get a private link. |
| `src/features/auth/**` | `AuthProvider`/`useAuth`, `RequireAuth`, `session.ts` (`safeReturnPath`, active organization storage), `errors.ts` (code-to-copy), `validation.ts`, `useLoad.ts`, forms, pages, `auth.css`, tests and the hand-written fake (`testing/fakeApi.tsx`). |
| `src/features/organizations/**` (not `WorkspaceContext.tsx`) | `AppLayout`, `ShellContext` (memberships, admin flag, switcher, review copy), `OnboardingPage`, `OrganizationPage`, `AppNotFound`, CSS, tests. |
| `src/features/admin/ReviewPage.tsx` | Platform review queue and decisions. |
| `e2e/app-auth.spec.ts` | Browser journeys (390 and 1440 only). |
| `e2e/foundation.spec.ts` | One assertion only: line 120, "For verifiers" now expects `/verify` instead of `/preview/verify` because the link target changed. Nothing else in existing specs was edited; `/preview/:section` still works and `mobile-layout.spec.ts` still checks `/preview/verify`. |

## Decisions and deviations

- **PublicLayout ownership** (coordinator-confirmed, option a): FS-B pages wrap themselves in `PublicLayout`; `App.tsx` routes them bare.
- **Demo adapter rules**: tenant misses are `NOT_FOUND` before any role check; role misses are `FORBIDDEN`; invites are owner-only including `listInvites`. Last owner cannot be demoted or removed (`INVALID_TRANSITION`). Issue checks run in this order: idempotent replay, already issued (`INVALID_TRANSITION`), review state (`ISSUER_NOT_ELIGIBLE`), approval id (`APPROVAL_REQUIRED`), then digest re-check against the current template revision (`REVISION_CONFLICT`). The digest is SHA-256 over template id, template revision and the normalized rows. Revoke and replace are idempotent per (organization, key); the same key with a different target or payload is `IDEMPOTENCY_CONFLICT`. Revoking a credential also revokes its live delivery links. Creating a delivery link for a revoked credential is `INVALID_TRANSITION`. A second pending invite for the same email supersedes the first. `listReviewQueue` returns every organization, pending first; the page splits "awaiting" and "reviewed/suspended". The private review reason is stored but never appears in the organization audit.
- **Duplicate rows**: the same recipient name plus title twice in one batch is reported as `DUPLICATE` on the later row.
- **Sign-up in demo** with a taken email returns `VALIDATION` `email:UNAVAILABLE` (a real backend that confirms email would not reveal this). Demo sign-up signs the user in, matching `needsEmailConfirmation: false`.
- **Invite flow**: the token is read from `location.hash` and removed with `history.replaceState` in a layout effect, kept only in component state, and never stored. Sign-in/sign-up forms render inline on `/invite` so the token survives without storage.
- **Active organization**: sessionStorage `verimark.activeOrganization` holds `{ userId, organizationId }`. It is cleared whenever the session becomes null.
- **Return path**: only `/app`, `/app/...`, `/app?...`, `/app#...`; rejects `//`, backslashes and control characters.
- **Admin without a membership** may open `/app/review` and `/app/onboarding`; all other `/app` paths redirect to onboarding.
- **Demo labelling in /app**: a ribbon above the header (visible on mobile), a header badge on desktop, and the footer.
- No dependency, config, frozen-contract or `src/components/ui`/`src/styles` changes.

## Commands and results (this worktree, 2026-11-16)

| Actual command/check | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 0 vulnerabilities |
| `npm run typecheck` | PASS | no output |
| `npm run lint` | PASS | 0 problems |
| `npm test -- --run` | PASS | 9 files, 128 tests (new: adapter 32, auth 30, organizations/review 16, route titles 10) |
| `npm run build` | PASS | `index-*.js` 368.22 kB (gzip 111.86 kB), CSS 34.71 kB |
| `PLAYWRIGHT_PORT=3441 npx playwright test e2e/app-auth.spec.ts --workers=2` | PASS | 12 passed, 30 skipped (other widths by design) |
| `PLAYWRIGHT_PORT=3441 npm run test:e2e -- --workers=2` | 185 passed, 14 failed, 165 skipped (4.3 min) | All 14 failures are two tests × 7 widths, both integration-pending (below) |
| Ad-hoc 320 px and 1024 px sweep (temporary spec, deleted): `/`, sign-in, sign-up, reset, update, invite, organization (owner + invite panel), onboarding, `/app` 404, pending org, review | PASS | no document horizontal overflow, exactly one `<h1>` each |

### Integration-pending e2e failures (accepted by coordinator; tests not altered)

- `e2e/scroll.spec.ts:118` "implemented route entry replays finite visible entrance with immediate focus; placeholders stay basic": clicks "Verify a credential" (now `/verify`) and expects `main` focused. The FS-B `VerifyPage` placeholder on this branch renders no `PublicLayout`/`<main>`.
- `e2e/foundation.spec.ts:106` "deep landing CTA resets scroll and back restores entry position": after "For verifiers" goes to `/verify` (assertion updated as above), expects an `<h1>` in the viewport; the placeholder has none. Same cause, and it should pass once FS-B's `VerifyPage` (with its `PublicLayout` and `<h1>`) is integrated.

## Risks and known gaps

- The demo adapter is not evidence of backend security (ADR-0005 §8). It hashes demo passwords with unsalted SHA-256 in sessionStorage. That is acceptable for fictional accounts only.
- Demo state is per tab (sessionStorage). A new tab starts from the seed.
- `/update-password` in Supabase mode relies on the recovery link establishing a session; this is untested until the Supabase adapter lands.
- Org switcher and review banners were tested in jsdom and visually at 320/1024/1440. No screen-reader pass was done beyond axe (no serious or critical issues on sign-in and organization pages).
- Not merged with the integration branch (FS-B/FS-C are already there); expect trivial conflicts only in `App.tsx` if the coordinator's integration branch changed it.

## Open decisions / next owner

- Coordinator: integrate, then re-run the full e2e suite. The two pending tests should pass with FS-B's `VerifyPage`.
- Owner decision (existing): whether sign-up should hide account existence in Supabase mode (email confirmation on).

## Independent review status

Not yet reviewed.

## Human approvals still needed

None for local use. Real data and deployment remain gated per ADR-0005.
