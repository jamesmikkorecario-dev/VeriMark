# Orca handoff — independent design proposal

**Do not overwrite approved project documentation, replace existing prototype folders, create production infrastructure, or merge this concept into `main` without owner approval.**

## Safe import

1. Open your VeriMark local repository in Orca. Keep the current working branch and all first/second-round design prototypes intact.
2. Create a dedicated design-comparison task via the Main orchestrator. If using parallel worktrees, reserve `prototypes/design/editorial-systems/` for the importer; keep other workers read-only on these new files.
3. Copy the entire `preview/` into `prototypes/design/editorial-systems/`, preserving `index.html`, `styles.css`, and `app.js` together. Optionally import `docs/` under `docs/design/editorial-systems/`.
4. Open `prototypes/design/editorial-systems/index.html` in your local browser. No npm install is needed for the design review.
5. Compare the 13 screen states and the screenshots against Ledger Round 2. Do not finalize the design system before user approval.
6. Have a separate reviewer check keyboard paths, mobile at 320/390px, reduced-motion mode, status semantics, forms and data trust labels.

## After visual approval only

- Implement **React.js + TypeScript + Vite** with reusable components, route definitions, typed data contracts, and design tokens. Do not treat this prototype's plain DOM event-handler architecture as a production implementation pattern.
- Keep public and issuer layouts distinct. Suggested component boundaries: `PublicHeader`, `PublicFooter`, `IssuerShell`, `StatusPill`, `RecordPaper`, `CredentialFacts`, `RecordTable`, `VerificationForm`, `IssueStepper`, `RecipientCertificate`, `MotionPreferences`.
- Use Supabase Auth for sessions and server-checked roles, Supabase PostgreSQL with appropriate RLS, Edge Functions or secure server-side operations where required, and Vercel for frontend deployment. Maintain free-tier constraints; no services are provisioned by these files.
- Never rely on client-rendered visual status or JS data to authorize issuance, modify credential state, or prove issuer identity. Use trustworthy server-side enforcement and auditable lifecycle transitions.
- A verifiable QR code directs to a record; it is not cryptographic proof by itself. Avoid implying signatures or independently verified identities unless they actually exist.
- Require a privacy review of public recipient details and consent policy before production.
- Respect existing architecture, user stories, design direction approval, and CI rules. Any deviation requires an ADR / approval.

## Proposed next Main-orchestrator task

"Review the attached Editorial Systems / 03 concept as a separate visual candidate. Preserve all existing Round 1/2 prototypes. Compare page hierarchy, record reliability cues, the issuer workspace, motion, and mobile interaction with the project requirements. Present differences and proposed refinements. Do not implement the production UI or merge to `main` until I approve the design."

## Explicit limits

The preview does **not** implement Supabase integration, login security, organization vetting, role isolation, real signature/record checking, storage, email, QR decoding, signed PDF issuance, downloads of authentic credentials, or production audit logs. Browser-local examples may be lost on reload. Report these limits to the user rather than marking backend tests as passed.
