# Suggested Application Code Structure

This is a **proposed structure**, not source code that already exists in this starter kit. Adapt names and paths to your chosen framework.

```text
project/
├── src/
│   ├── app/                  # app bootstrap, router, providers
│   ├── pages/                # route-level composition (thin)
│   ├── features/
│   │   └── feature-name/
│   │       ├── components/   # domain-specific UI
│   │       ├── hooks/        # feature orchestration
│   │       ├── data/         # typed queries/mutations
│   │       ├── schemas/      # validation
│   │       ├── types/        # feature types
│   │       └── tests/        # focused feature tests
│   ├── components/
│   │   ├── ui/               # design-system primitives
│   │   └── layout/           # shared shell
│   ├── lib/                  # env, safe Supabase client, errors
│   ├── styles/               # design tokens, global styles
│   └── test/                 # test fixtures, setup, mocks
├── supabase/
│   ├── migrations/           # numbered, immutable SQL migrations
│   ├── functions/            # trusted server-side functions
│   └── seed.sql              # non-sensitive development data only
├── e2e/                      # Playwright user journeys
├── docs/                     # architecture, product, delivery policy
├── agents/                   # portable role prompt definitions
└── .github/                  # PR templates and active CI when configured
```

## Dependency rules

- `pages` compose feature modules; they should not contain all business logic.
- `features` may import shared `components/ui` and `lib`, but shared primitives must not import a feature.
- Keep data access behind typed feature `data/` functions, not scattered through components.
- Prefer one feature-owned component until a reusable interface is demonstrated.
- Never share server-only code/secrets with browser imports. Supabase functions are separately deployed and reviewed.
- Group by business capability rather than many root-level generic folders as the application grows.

## Optional additions (only when justified)

`src/i18n/` for multilingual content, `src/analytics/` for privacy-safe events, `scripts/` for repeatable maintenance, `packages/` if multiple independently built apps emerge. Do not build a monorepo just to look enterprise-grade.

See `docs/architecture/SYSTEM-ARCHITECTURE.md`, `docs/frontend/COMPONENT-LIBRARY.md`, and `docs/quality/TEST-STRATEGY.md`.
