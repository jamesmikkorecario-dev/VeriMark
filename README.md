# VeriMark

Issue with confidence. Verify with trust.

VeriMark lets smaller organizations issue accountable certificates and lets recipients and third parties check the issuer's record and its current status. The working name has not been cleared for public launch.

## Status of this branch (`dev/full-stack-integration`)

A local release candidate of the full application: sign-in, organizations and roles, templates, single and CSV issuance, public verification, private recipient links with PDF certificates, revocation and replacement, activity history. It runs in two modes:

- **Demonstration** (default, no configuration): fictional data held in the browser. Use it to try every screen.
- **Supabase**: the real backend is one SQL migration (`supabase/migrations`), tested locally on PostgreSQL. **It has not been applied to a hosted Supabase project, and nothing is deployed.**

Start here: [local development](docs/delivery/LOCAL-DEVELOPMENT.md) · [architecture decision](docs/architecture/adr/0005-full-stack-release-candidate.md) · [schema and operations](docs/database/SCHEMA-AND-OPERATIONS.md) · [release-candidate report](docs/delivery/RELEASE-CANDIDATE.md) · [roadmap and status](docs/product/FULL-STACK-ROADMAP.md).

Not done, by design: deployment, a hosted database, e-mail delivery, merge to `main`. Each needs the owner's approval.

Start with [AGENTS.md](AGENTS.md), [PRD](docs/product/PRD.md), [roadmap](docs/product/MVP-ROADMAP.md), [workflow](docs/ai/WORKFLOW.md), then [development prompt](START_DEVELOPMENT_PROMPT.md).

## Source of truth

| Topic | Authority |
| --- | --- |
| Primary product requirements | [setup-inputs/PROJECT_DETAILS.md](setup-inputs/PROJECT_DETAILS.md); latest explicit user decisions prevail |
| Preserved setup procedure | [setup-inputs/PROJECT_SETUP_PROMPT.md](setup-inputs/PROJECT_SETUP_PROMPT.md); old template stop rules superseded by authorized initialization |
| Derived scope and acceptance | [PRD](docs/product/PRD.md), [stories](docs/product/USER-STORIES.md) |
| Milestones/tasks | [roadmap](docs/product/MVP-ROADMAP.md), [backlog](tasks/BACKLOG.md) |
| Stack, boundaries, contracts | docs/architecture/TECH-STACK.md, SYSTEM-ARCHITECTURE.md, API-CONTRACTS.md, ADRs |
| Authorization/schema/storage | docs/backend/AUTH-AND-PERMISSIONS.md, docs/database/ |
| Approved Editorial Systems and historical exploration | [design review](docs/design/DESIGN-REVIEW.md), [interactive comparison](prototypes/design/index.html); docs/frontend/DESIGN-SYSTEM.md |
| UI components/states | docs/frontend/COMPONENT-LIBRARY.md, ROUTES-AND-STATES.md |
| Quality/release/operations | docs/quality/, docs/delivery/, docs/operations/ |
| Agent authority | AGENTS.md, docs/ai/WORKFLOW.md, agents/ |

Editorial Systems is approved for M1. Its authoritative package is design-references/verimark-visual-design; earlier explorations remain historical. Cross-owner docs are integrated by the coordinator; report conflicts against the primary input.

## Scope and proposed implementation

MVP covers organization authorization/roles, templates, validated single/CSV issuance, private PDFs with QR links, account-free recipient access, restricted public verification, expiry/revocation/replacement, audit history and basic metrics. Issued claims are immutable. Verification confirms database recognition, not accreditation. Wallet, cryptographic credentials, LMS integrations, advanced workflows and bulk email are future scope.

M1 frontend: React + TypeScript + Vite, CSS variables/native components and React Router. Later proposed libraries: Tailwind/shadcn, TanStack Query, React Hook Form/Zod; Supabase Auth/Postgres/RLS/Storage/Edge Functions/RPC. React/TypeScript + Vite, Supabase backend/PostgreSQL/Auth and Vercel are approved mandatory constraints; FREE TIERS ONLY. Storage/Edge require technical justification; no Next.js, separate Node backend or extra cloud service without explicit approval. M1 uses approved Editorial Systems with plain CSS and reusable native React controls; additional libraries are deferred (ADR-0004). No resources are provisioned. Regions, free-tier eligibility and recovery require checks before launch. See [ADR-0003](docs/architecture/adr/0003-mandatory-stack.md).

## Running and agents

M1 configures dev, typecheck, lint, test, build and test:e2e scripts. See docs/delivery/M1-LOCAL-DEVELOPMENT.md for commands and prerequisites. No backend credentials are needed.

agents/*.md are portable role guides, not automatically registered Orca agents. .claude/ and .opencode/ are unverified adapter examples; see [native status](docs/ai/NATIVE-AGENTS.md). Automatic instruction loading is not claimed for any installed harness. Orca requires explicit task dispatch and its installed orchestration skill. Scoped local commits are allowed; remote pushes, merges and releases require explicit authorization.

M1 mobile navigation correction: see [root causes, verification and screenshots](docs/ai/handoffs/M1-NAV.md). Public header is sticky with anchored icon-only navigation; mobile issuer navigation uses a modal sidebar drawer. M1 remains awaiting owner approval.

M1 motion audit/refinement: [audit, timings, verification and review boundary](docs/ai/handoffs/M1-MOTION.md); [actual video walkthroughs](docs/quality/evidence/m1-motion/README.md). M1 remains unapproved pending owner visual review.

Final M1 anchor refinement: public How it works and hero See how it works link to /#method. Explicit same-page actions smooth-scroll with measured sticky-header offset; direct/route/history arrivals remain immediate. [Report](docs/ai/handoffs/M1-SCROLL.md) and [playback evidence](docs/quality/evidence/m1-scroll/README.md). M1 remains unapproved.
