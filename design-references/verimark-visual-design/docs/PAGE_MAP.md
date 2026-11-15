# Complete prototype page map

Open `../preview/index.html` first, then navigate through its links or use the hash paths shown below. No server needed.

| # | Route | Screen | Key behavior |
| ---: | --- | --- | --- |
| 1 | `#/home` | Landing | Product identity, example record, methods, audience, main CTA |
| 2 | `#/how` | How it works | Prepare → Share → Verify, honest security disclosure |
| 3 | `#/about` | About / trust approach | Product principles and claim boundaries |
| 4 | `#/verify` | Public verification | Known reference, revoked, expired, replaced, unknown, loading |
| 5 | `#/details?id=VM-2026-0482` | Public record details | Exact record ID, standing, comparison fields, record history |
| 6 | `#/login` | Demo issuer entry | Clearly simulated form; no real authentication |
| 7 | `#/dashboard` | Issuer overview | Record status KPIs, recent data, activity, task CTA |
| 8 | `#/records` | Credentials library | Search, standing filter, mobile card layout |
| 9 | `#/issue` | Issuance workflow | Prepare → Review → Complete, fictional in-memory creation |
| 10 | `#/templates` | Credential formats | Completion, participation, recognition; prefill issue form |
| 11 | `#/activity` | Organization activity | Fictional lifecycle event list |
| 12 | `#/settings` | Organization information | Read-only demo org data and trust caveats |
| 13 | `#/recipient?id=VM-2026-0482` | Recipient credential | Distinctive certificate, copy URL, fictional text download |

## Useful test references

- `VM-2026-0482` — valid fictional record / Alex Santos.
- `VM-2026-0475` — revoked fictional record / Samira Torres.
- `VM-2026-0472` — expired fictional record / Isabel Mendoza.
- `VM-2026-0460` — replaced fictional record / Mara Castillo.
- `VM-2026-9999` — unknown reference, no match.
- `VM-DEMO-0001` — new fictional record created during same-page session by the issuance workflow.

All pages are logical routes in one offline preview, not separate physical HTML documents. This permits shared navigation and working local transitions. In React, implement routes as components with appropriate route parameters.
