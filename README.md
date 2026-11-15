# Full-Stack AI Development Starter Kit

A reusable documentation-first system for building production-minded full-stack applications with AI coding agents. **This is a template, not a completed app, production deployment, or tested repository.**

## Recommended example stack

- Frontend: React + TypeScript + Vite (use Next.js instead when server rendering/SEO is essential).
- Hosting: Vercel (production branch `main`, preview deployments for pull requests).
- Backend: Supabase Auth, Postgres, Storage, and optional Edge Functions for trusted server-side operations.
- Quality: ESLint, TypeScript, Vitest + React Testing Library, Playwright, accessibility checks.
- Git: short-lived feature branches + PRs to protected `main` by default; optional `dev` integration branch if needed.
- Package manager example: npm. Pin actual versions in `package.json` when scaffolding the application.

## Start here (in order)

1. Copy this folder's contents into a **new or existing Git repository**. Review before overwriting existing files.
2. Fill project-specific fields in `docs/product/PRD.md`, `docs/product/MVP-ROADMAP.md`, `docs/architecture/TECH-STACK.md`, `docs/delivery/ENVIRONMENTS.md` and `.env.example`.
3. Read `AGENTS.md` and `docs/ai/WORKFLOW.md`. These govern how agents work.
4. Have a lead agent propose one vertical slice using `docs/ai/TASK-TEMPLATE.md`; review before implementation.
5. Scaffold app/code separately. Then replace example commands in `AGENTS.md` and configure CI using `templates/github-actions/ci.example.yml`.
6. Require implementation, tests, reviewer report, PR, and approval before release.

## What is automatically loaded?

- `AGENTS.md`: cross-tool entry point. Supported by multiple coding agents, including omp.
- `CLAUDE.md`: lightweight compatibility note for Claude Code.
- `agents/*.md`: **portable role prompts, NOT automatically registered subagents**. The lead can read/delegate these instructions manually.
- `.claude/agents/code-reviewer.md`: Claude Code native example subagent.
- `.opencode/agents/code-reviewer.md`: OpenCode native example subagent, verified against OpenCode agent-file format as of Nov 2026; it is **not** an omp-specific config.

For Orca + omp: work from the repository root, ask the lead to read `AGENTS.md`, then invoke specialists by giving them the relevant `agents/*.md` role file. Check your installed harness's actual subagent commands before relying on automatic delegation.

## Single source of truth

| Topic | Canonical document |
| --- | --- |
| Product requirements | `docs/product/PRD.md` |
| Scope / phase order | `docs/product/MVP-ROADMAP.md` |
| Technology decisions | `docs/architecture/TECH-STACK.md` + ADRs |
| System boundaries | `docs/architecture/SYSTEM-ARCHITECTURE.md` |
| Application folders and imports | `docs/architecture/REPOSITORY-STRUCTURE.md` |
| API behavior | `docs/architecture/API-CONTRACTS.md` |
| Design tokens | `docs/frontend/DESIGN-SYSTEM.md` |
| UI components | `docs/frontend/COMPONENT-LIBRARY.md` |
| Schema and authorization | `docs/database/*` |
| Tests and release gates | `docs/quality/*` + `docs/delivery/*` |
| Agent behavior | `AGENTS.md` + `docs/ai/WORKFLOW.md` |

Do not duplicate decisions across multiple files; link to the canonical owner instead.

## First prompt for your agent

> Read `AGENTS.md`, `docs/ai/WORKFLOW.md`, `docs/product/PRD.md`, `docs/architecture/TECH-STACK.md`, and `docs/delivery/GIT-BRANCHING.md`. Identify missing project-specific decisions and propose a scoped Phase 0 plan. Do not modify code, install packages, create billable resources, push, merge, or deploy yet. Return architecture questions, a file-by-file plan, acceptance criteria, verification commands, and approval points. Do not claim tests were executed.

## References

- AGENTS.md standard: https://agents.md/
- Claude Code subagents: https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more
- OpenCode agent files: https://opencode.ai/docs/agents
- Vercel Git deployments: https://vercel.com/docs/git
- Supabase production security: https://supabase.com/docs/guides/security/production-checklist
