# Routes, Screens, Permissions, and States

| Route | Role(s) | User story | Initial/loading | Empty | Error | Success |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | public | [ID] | [..] | [..] | [..] | [..] |
| `/dashboard` | signed-in | [ID] | [..] | [..] | [..] | [..] |

## Required patterns

- Deep-link and refresh behavior; auth redirects and post-login return path.
- Denied access behavior (403 vs no-disclosure 404 as appropriate).
- Suspense/skeleton choices without layout jump.
- Confirmation for destructive user actions and undo when feasible.
- Validation feedback associated with fields; preserve unsaved data when appropriate.
- Responsive widths: narrow mobile, tablet, desktop, zoomed text.
- Offline/timeout/retry state for network-dependent journeys.

No screen is considered complete based on a happy-path screenshot alone.
