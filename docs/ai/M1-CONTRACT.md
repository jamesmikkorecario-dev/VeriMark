# M1 implementation contract

Authority: owner's Master Full-Stack Implementation Prompt, 2026-11-15. M1 only: React/Vite foundation, Editorial Systems public landing and issuer demonstration workspace. No live auth, verification, issuance, persistence or cloud changes. This M1 is a new authorized frontend delivery slice, not the identically numbered historical roadmap phase.

Integration branch: feat/full-stack-implementation, initialized from 9d28106, approved references committed at e2d0080. Primary checkout must remain on main. All workers use Orca-created isolated worktrees from this contract commit. Preserve all design artifacts and setup inputs.

## Ownership and dependencies

- A foundation: package.json/lock, root index.html, tsconfig*, vite.config.ts, eslint.config.js, vitest.config.ts, playwright.config.ts, src/main.tsx, src/app/**, src/test/**, e2e/**, .gitignore additions, vercel.json. Own tooling and routing tests. Do not edit B/C paths.
- B design: src/components/ui/**, src/styles/**, src/components/ui.test.tsx. No page/layout CSS. Export from src/components/ui/index.tsx. Own shared components and tests.
- C experiences: src/pages/**, src/components/layout/**, src/data/**. Own landing/dashboard/layout CSS and tests. Do not edit A/B files.
- Coordinator: documentation, integration, independent review, combined checks and browser/visual evidence. Sequential integration A then B then C.

## Stable imports and routing

A imports global src/styles/index.css, and BrowserRouter routes under src/app/App.tsx. C exports default components from src/pages/LandingPage.tsx, DashboardPage.tsx, DeferredPage.tsx, NotFoundPage.tsx. Landing and Deferred include PublicLayout; Dashboard includes IssuerWorkspaceLayout. Routes: / landing, /workspace dashboard, /workspace/:section deferred workspace shell, /preview/:section deferred public shell, * not found. DeferredPage reads useParams and useLocation; clearly says unavailable in M1 and offers working return links. Navigation to future features always uses these explicit placeholders, never pretends to authenticate or verify. Direct URL loading works through Vite and a local-only Vercel rewrite configuration (no deployment).

B exports Button (native button props; variant primary/outline/light/ghost; size sm/md), ButtonLink (React Router Link props, same variant/size), Brand (to?: string, inverse?: boolean), Icon (name: arrow/menu/close/grid/records/template/activity/settings/search/plus/check/chevron/lock/external; size?: number), StatusPill (status valid/revoked/expired/replaced), SectionLabel (children), Panel (native div props), PageContainer (native div props), FormField (id, label, hint?, error?, children), TextInput (native input props), Select (native select props), EmptyState (title, children?, action?), ErrorState (title?, children?, onRetry?), LoadingState (label?). All exports typed and accessible; no other component required by C. C can implement its own credential object using record-paper classes. Do not depend on unstated API props.

CSS: B owns global resets/tokens/shared component classes only; preserve prototype token names (--canvas, --paper, --ink, --forest, --forest2, --surface, --surface2, --muted, --line, --mint, --serif, --sans, --ease). C owns public/workspace classes in src/pages/pages.css imported by its page modules. Avoid wholesale prototype app.js conversion; compose typed React components. CSS may adapt approved styles for faithful presentation. No external fonts or image services needed.

Dependencies: React, React DOM, React Router; CSS variables/plain CSS for fidelity and minimal scope. Defer proposed Tailwind/shadcn, Query and form libraries until demonstrated need. Tooling: TypeScript, Vite, ESLint, Vitest/Testing Library/jsdom, Playwright and axe-core browser audits. A pins stable versions after checking official docs/registry compatibility; npm lockfile. Node local tooling is not an extra backend.

## Acceptance and verification

App runs on port 3000 when free; never kill unrelated processes. Commands: npm run typecheck, npm run lint, npm test -- --run, npm run build, npm run test:e2e. A may initially report dependent modules unavailable; B/C can use temporary external tooling but must not commit packages/config outside ownership. Coordinator runs full checks on integration.

Landing preserves hero credential, major explanatory/audience/closing sections, header/footer. Dashboard preserves sidebar/context/header, summary, fictional records and activity. Mark all fictional records and workspace clearly; no success claims about real backend. Search/filter/reset and mobile menus should work. Dialog-style drawers require focus containment, Escape, restoration and inert/blocked background; navigation disclosure may instead use a nonmodal accessible pattern. Route changes update title and focus main; preserve browser history.

Browser checks at 320,390,768,1024,1440,1920: overflow, menu, keyboard, direct links/history, filtering/empty state, reduced motion; automated axe plus representative screenshots, inspect against reference desktop/mobile. No screen-reader or production security claims from browser audits. State components get meaningful tests. Workers locally commit and report SHA, exact checks, limitations using own handoff docs/ai/handoffs/M1-A.md (or B/C). Do not push, merge main, provision, deploy, alter references, or spawn helpers. Stop after assigned scope and use worker_done.
