# VeriMark — Editorial Systems / 03

**Independent visual design proposal — awaiting human approval.**

This is an original, offline, interactive concept for VeriMark's complete core experience. It is a **visual design prototype, not a deployed app**. Every record, recipient, organization and result is fictional; all interactions are browser-local and do not confer authenticity. It does not connect to Supabase, Vercel, email, or any real account.

## View it immediately

1. Unzip this archive.
2. Open **`preview/index.html`** in Chrome or Edge.
3. Navigate using the prototype's own public links, issuer side navigation, and sample record links. All files are local, with no package install and no internet required.
4. See `docs/PAGE_MAP.md` for an indexed route list. Open `screenshots/overview-desktop.jpg` and `screenshots/overview-mobile.jpg` for quick visual review.

The brand, layout, interaction language, and page treatments intentionally differ from Civic Ledger Round 2. This is an alternative candidate, **not an authorized replacement**. It should be reviewed in Orca and approved before converting to production React components.

## Screens

13 linked routes: Landing, How it works, About, Verify, Credential details, Demo sign-in, Issuer overview, Credentials library, New issuance, Templates, Activity, Organization, Recipient credential. Additional states include valid/revoked/expired/replaced/unrecognized verification results and the 3-step issuance sequence.

## Design stance

- Warm off-white canvas, dark forest typography, documentary typography in public trust-sensitive surfaces.
- Compact operational UI for dashboard, tables and forms; more expressive serif used deliberately for reading moments.
- Unique indexed Verimark mark, record rules, editorial chapter numbers, coherent micro-labels.
- Finite entrance and reveal animations, hover and status feedback, and reduced-motion support.
- No meaningless metrics, unverifiable security claims, synthetic customer logos, or gratuitous motion.

## Implementation note

This artifact uses **vanilla HTML/CSS/JavaScript** so you can open it instantly and review every route without dependencies. It is **not the requested production React app**. The approved development stack remains **React.js + TypeScript + Vite, Supabase Auth/PostgreSQL/RLS, Vercel**, free-tier only. `docs/ORCA_HANDOFF.md` describes converting the approved design into production components and integrating with actual security boundaries.

## Safety and constraints

- No real credential authenticity, identity verification, QR signature, issuer vetting, authentication, backend, or data storage.
- Issuance creates only an in-memory fictional record for the current page session.
- Downloaded records are explicitly marked demo text, not signed certificates.
- Visual audits and browser interactions are not a substitute for physical device, assistive technology or backend security testing.

## Contents

- `preview/index.html`, `preview/styles.css`, `preview/app.js` — interactive self-contained design.
- `screenshots/` — route-by-route desktop and mobile captures.
- `docs/DESIGN_DIRECTION.md` — design tokens, type, motion, rationale.
- `docs/PAGE_MAP.md` — complete navigation map and test IDs.
- `docs/ORCA_HANDOFF.md` — safe integration plan and implementation boundaries.
- `docs/VERIFICATION.md` — checked behaviors, viewport coverage, limitations.
