# HTTP/browser security hardening

Task: task_575bdfdbd46e. Status: ready for coordinator independent review, 2026-11-18.
Owner: dispatched HTTP worker. Branch: jamesmikkorecario-dev/hardening-http-codex.
Base: bd640e4. Worktree: C:/Users/James/orca/workspaces/VeriMark/hardening-http-codex.
This scoped report follows the handoff template; editing the shared template is outside ownership.

## Goal and changes

Prevent HTTP storage of verification, recipient, invitation, workspace and authentication documents without changing SPA routing or hashed asset caching. Only vercel.json, supabase/tests/http-security.test.ts and this report are changed. No API, migration, environment, dependency or UI changes.

The previous no-store/no-referrer rules covered only exact /receive and /invite paths. The global rule now sets Cache-Control: no-store and Referrer-Policy: no-referrer. This covers /verify and public-ID deep links (avoiding stale status documents), /app and nested tenant pages, all four authentication routes, trailing slashes, unknown SPA routes and /index.html. It also covers the landing document, a small performance tradeoff for a safe default that cannot omit a future sensitive route. The later /assets/(.*) rule retains public, max-age=31536000, immutable for Vite build assets. No new cache lifetime or public-field policy is introduced.

The no-referrer default prevents outbound and same-origin referrer disclosure across SPA transitions from the initially loaded document. Fragment tokens already stay out of HTTP requests, but referrer policy alone does not remove secrets from history, browser storage, copied URLs, logs or JavaScript. No claim is made that HTTP no-store disables browser history or clears application state. The downloaded shell contains no server-rendered recipient record: records arrive from Supabase separately.

## Controls retained and limitations

| Control | Audit result |
| --- | --- |
| CSP scripts | self only; no unsafe-inline or unsafe-eval for scripts |
| CSP styles | **self only** (since the coordinator follow-up below). React `style` props and `Navigation` write styles through CSSOM, which CSP does not govern; the one markup-style write (`Navigation.tsx` restoring `body`'s style with `setAttribute`) now uses `style.cssText`. Inline `<style>` elements and style attributes are refused. |
| CSP connections | self and HTTPS Supabase subdomains; no new destinations, WebSocket or custom-domain support added |
| CSP resources | self fonts; self/data/blob images support current local previews; object-src none; base-uri and form-action self |
| Framing | frame-ancestors none and X-Frame-Options DENY retained |
| MIME | X-Content-Type-Options nosniff retained |
| Devices / isolation | accelerometer, camera, display capture, geolocation, gyroscope, HID, magnetometer, microphone, payment, serial and USB disabled; `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `frame-src 'none'`, `upgrade-insecure-requests` |
| HTTPS | existing HSTS two-year includeSubDomains retained; domain/subdomain readiness remains a deployment check |

Vercel headers govern frontend responses only, not cross-origin Supabase Auth/PostgREST responses. These changes cannot force no-store on RPC results, revoke a bearer link, prevent screenshots or solve public enumeration. Backend response caching and intermediary behavior need separate runtime verification before release. No RLS changes were needed; the existing DB authorization negatives still run in the DB suite.

## Coordinator follow-up: `'unsafe-inline'` removed (2026-11-18)

The original recommendation here (keep `'unsafe-inline'` and first migrate React style attributes to static CSS) rested on a wrong premise: React applies `style` props through CSSOM (`element.style`), which CSP does not restrict. A separate, quota-interrupted worker attempt (`jamesmikkorecario-dev/hardening-http`, `d9db9e2`, not merged) found that the only markup-style write in app code is `Navigation.tsx` restoring `body`'s original style with `setAttribute`. That attempt's caching and referrer choices were weaker than this branch's global `no-store`/`no-referrer` and were not adopted. Its stricter CSP/cross-origin headers and its production-build browser spec were ported, with `'unsafe-inline'` removed entirely rather than narrowed to `style-src-attr`.

`e2e/http-security.spec.ts` builds the app into a temporary directory, serves it with `vite preview` plus the `vercel.json` headers for each path, aborts every non-local request and records `securitypolicyviolation` events. Under the strict policy it observed **zero violations** across public, verification, recipient, invitation, auth, workspace, certificate PDF download and mobile navigation flows, and confirmed that inline scripts, injected `<style>` elements and style attributes are refused while CSSOM styling works. This is Chromium evidence for a local emulation of the header rules, not Vercel runtime evidence; Firefox/Safari CSP behavior and the Supabase adapter under CSP remain untested. No D-010 through D-014 product defaults changed.

## Evidence and boundary

All checks used VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY set to empty strings in PowerShell before execution. No .env files were copied and no hosted/remote commands ran.

| Actual command | Result |
| --- | --- |
| npm ci | PASS: 290 packages added, 291 audited; npm reported 12 high severity vulnerabilities; no dependency edits permitted or made |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run test:db | PASS: 12 files, 203 tests; includes 27 new HTTP config assertions and existing database authorization/parity tests |
| npm run build | PASS: 335 modules, static production output generated |
| git diff --check | PASS |
| Unit and browser suites | NOT RUN: no source/UI behavior changed; local Vite does not implement Vercel headers |
| Deployed HTTP/CSP enforcement | NOT RUN: deployment/cloud access unauthorized |

An initial attempted Python edit could not run because Python was unavailable; Node performed the edit successfully. No file changes resulted from that failed command.

The new tests parse the checked-in JSON, use only its existing regex sources, check document route/query/fragment variants, restrictive CSP/device/framing/MIME headers, asset override order and unchanged SPA fallback. They are configuration assertions, not a Vercel routing emulator, browser CSP enforcement test or deployed CDN evidence. Build success does not prove CSP compatibility at runtime.

Before an approved deployment can be accepted, an operator must inspect actual GET responses on the deployment for /verify, a fictional /verify/:id, /receive, /invite, /app and a nested route, /sign-in, /sign-up, /reset-password, /update-password and /index.html, including trailing slash and query variants. Confirm no-store and no-referrer after redirects/rewrites; confirm assets retain immutable caching and correct MIME types; record cache headers and CSP with a real browser loading those routes and exercising sign-in, template previews and PDF generation without unexpected CSP violations. Use only fictional data and never log capability fragments or Auth codes. Check Supabase RPC/Auth response cache behavior separately. A Vite response is not substitute evidence.

The configuration format and source/header rules were checked against [Vercel's official vercel.json reference](https://vercel.com/docs/project-configuration/vercel-json#headers) on 2026-11-18. Platform matching, rewrite interaction and final effective CDN headers remain runtime release gates.

## Handoff and remaining work

Coordinator independent review is requested on the delivered diff; no helper workers were started. Remaining risks: broad Supabase connection allowlist (`https://*.supabase.co`; narrowing to the exact project origin needs the production project decision), unverified platform headers/CSP behavior, untested non-Chromium CSP behavior and the install-time dependency audit findings. The inline-style allowance was removed in the coordinator follow-up above. No push, merge, deployment, cloud operation or production approval is implied.
