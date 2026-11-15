# VeriMark

Issue with confidence. Verify with trust.

VeriMark is a planned platform for smaller organizations to issue accountable certificates and let recipients and third parties check issuer records and lifecycle status. This repository is an initialization foundation, not an implemented or deployed service. The working name has not been cleared for public launch.

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
| Design approval proposals | [docs/design/](docs/design/) and [prototypes/design/](prototypes/design/) (planned coordinator-owned deliverables); docs/frontend/DESIGN-SYSTEM.md |
| UI components/states | docs/frontend/COMPONENT-LIBRARY.md, ROUTES-AND-STATES.md |
| Quality/release/operations | docs/quality/, docs/delivery/, docs/operations/ |
| Agent authority | AGENTS.md, docs/ai/WORKFLOW.md, agents/ |

Design approval is pending. Prototypes and tokens are proposals. Cross-owner docs are integrated by the coordinator; report conflicts against the primary input.

## Scope and proposed implementation

MVP covers organization authorization/roles, templates, validated single/CSV issuance, private PDFs with QR links, account-free recipient access, restricted public verification, expiry/revocation/replacement, audit history and basic metrics. Issued claims are immutable. Verification confirms database recognition, not accreditation. Wallet, cryptographic credentials, LMS integrations, advanced workflows and bulk email are future scope.

Working stack: React + TypeScript + Vite, Tailwind + shadcn/ui, React Router, TanStack Query, React Hook Form + Zod; Supabase Auth/Postgres/RLS/Storage/Edge Functions/RPC. Vercel is proposed, not provisioned. Budgets, regions and provider terms require checks before launch.

## Running and agents

No package.json is configured. Install/dev/lint/typecheck/unit/E2E/build scripts are **not configured**. Do not enable example CI or install packages during initialization.

agents/*.md are portable role guides, not automatically registered Orca agents. .claude/ and .opencode/ are unverified adapter examples; see [native status](docs/ai/NATIVE-AGENTS.md). Automatic instruction loading is not claimed for any installed harness. Orca requires explicit task dispatch and its installed orchestration skill. Scoped local commits are allowed; remote pushes, merges and releases require explicit authorization.
