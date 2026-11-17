# Dependency advisory investigation

Task `task_a7b86ef3bdc6`, 2026-11-18; branch `jamesmikkorecario-dev/hardening-rate`. Prior rate-audit commit `7f84927` is unchanged. Independent coordinator review requested. This follow-up owns this document and package files only; neither package file required modification.

## Finding and decision

The [official GitHub advisory GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (updated November 17) affects picomatch through 4.0.7 and lists no patched version. It describes event-loop denial of service from attacker-controlled repeated-extglob patterns. On November 18, the [official npm registry metadata](https://registry.npmjs.org/picomatch) also listed 4.0.7 as latest, with no later release in the versions list. Registry checks below confirmed that result. There is no published compatible patch to pin or override today.

The advisory references [upstream PR 194](https://github.com/micromatch/picomatch/pull/194), which remains open and describes a parsing change rather than a released security fix. Do not substitute that unmerged code or a fork for a maintained release. Older picomatch versions are also inside the advisory's affected range. npm's proposed Vite/Vitest/typescript-eslint downgrades do not establish remediation of this vulnerable code and carry unrelated compatibility costs. No force fix, downgrade, override, audit suppression or lockfile regeneration was applied. The existing minimatch override remains untouched because it addresses a separate dependency.

## Exposure and remaining blocker

Installed picomatch 4.0.7 is reached through Vite 8.3.8, Vitest 5.1.0, tinyglobby 0.2.17 and fdir 6.5.0; npm also propagates the finding through the TypeScript ESLint toolchain. The 12 high audit entries are dependency propagation of this one underlying advisory, not 12 independently identified vulnerabilities. `npm ls picomatch --omit=dev` finds no production path and the production-only audit reports zero findings.

The application ships static browser assets and Supabase RPCs, with no Node production server. Source inspection found no application picomatch/tinyglobby import or API that accepts user-supplied glob patterns. Current Vitest/ESLint configuration uses repository-controlled glob patterns. Consequently the observed path is development/build/test tooling rather than credential verification or delivery request data. This is an exposure assessment, not a proof that every transitive tool route is unreachable or that the advisory is harmless. Untrusted repository/configuration changes, CLI pattern arguments or exposed development tooling could expand exposure; a clean production-only audit does not resolve the full audit finding.

Recommendation: retain the current compatible versions, keep development servers private, avoid passing untrusted patterns to tools, and recheck the advisory and official registry before release. When an upstream patch is published, prefer an in-range transitive update; use a narrowly scoped override only if required and compatible, then run audit, build, lint and affected test suites. Until then, zero-findings full-audit acceptance is blocked on upstream remediation or explicit owner risk acceptance. No risk acceptance is inferred here and the high findings remain visible.

## Exact local evidence

| Command | Result |
| --- | --- |
| `git status --short`; `git branch --show-current` | Clean starting tree on assigned branch. |
| `npm audit --json` | Exit 1; 12 high, 0 other findings, rooted in GHSA-fc5q-39xc-vjpf; suggested broad downgrades rejected. |
| `npm view picomatch version dist-tags versions --json` | Latest 4.0.7; published versions end at 4.0.7. |
| `npm view picomatch version dist-tags --json --registry=https://registry.npmjs.org` | Exit 0; official registry latest 4.0.7. |
| `npm view tinyglobby version dependencies --json` | Exit 0; latest 0.2.17 depends on picomatch ^4.0.4 and fdir ^6.5.0. |
| `npm ls picomatch` | Exit 0; all installed paths use deduplicated 4.0.7. |
| `npm ls picomatch --omit=dev` | Empty production tree (npm exits 1 for empty match). |
| `npm audit --omit=dev --json` | Exit 0; 0 vulnerabilities. This scope is diagnostic only, not a replacement audit gate. |
| `rg -n 'glob\|picomatch\|tinyglobby' src --glob '*.ts' --glob '*.tsx'` | Only unrelated `global` test configuration matched; inspected Vite/Vitest/ESLint configs separately. Initial wildcard filenames passed directly to rg failed on Windows and were replaced by explicit file reads and glob flags. |
| `npm run build` | Exit 0; TypeScript and Vite production build passed, 335 modules transformed. Both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY explicitly blanked. |
| `git diff --check` | Passed before commit. |

No code/dependency change means no new unit/database/browser checks were needed; no hosted commands ran. Deliverable is the investigation and explicit unresolved blocker, not a claim of remediation.
