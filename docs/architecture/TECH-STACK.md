# Tech Stack and Decision Constraints

**Status:** Proposed — confirm before scaffolding code.

| Layer | Default choice | Why | Replace when |
| --- | --- | --- | --- |
| Frontend | React + TypeScript + Vite | simple SPA, type-safe UI | SSR/SEO/server features require a framework |
| Routing | React Router (if needed) | conventional route composition | framework router selected |
| Styling | CSS variables + CSS Modules or Tailwind (choose one) | design tokens, reuse | team has established standard |
| Forms/validation | native forms + schema validation as needed | avoids unnecessary abstraction | complexity warrants library |
| Data fetching | Supabase client + optional query cache | policy-enforced reads | complex cache/server rendering |
| Auth and data | Supabase Auth + Postgres with RLS | auth/data platform in one | regulatory/scaling needs differ |
| Trusted operations | Supabase Edge Functions as needed | keeps secrets and privileged logic off browser | other server runtime required |
| Hosting | Vercel | Git-connected previews and production | changed cost/performance constraints |
| Unit/component tests | Vitest + React Testing Library | fast UI/service feedback | stack changes |
| Browser tests | Playwright | critical end-to-end journeys | stack changes |
| CI | GitHub Actions | PR checks | other Git provider |

## Constraints

- Expected hosting budget: [e.g. strictly free, no paid provisioning without approval].
- Region/data residency: [..]
- Privacy classification: [public/internal/sensitive + examples]
- Expected users/traffic: [assumption, not fabricated prediction]
- Repository/package manager: [..]
- Dependency policy: add only for a demonstrated need; use lockfiles and security maintenance.

Every major deviation needs an ADR in `docs/architecture/adr/`.
