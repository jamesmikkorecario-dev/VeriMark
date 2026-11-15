# VeriMark design system — PROVISIONAL

Human visual selection is pending. No finalized production tokens, approved theme or production component styling exist. See docs/design/VISUAL-DIRECTIONS.md and DESIGN-DECISIONS.md (relative links below) for rationale. The three standalone prototypes are the actual exploration sources, not a commitment to their CSS values.

| Exploration | Provisional palette (background / surface / text / action) | Typography and layout source |
| --- | --- | --- |
| Civic Ledger | #f2efe6 / #fffdf6 / #233c38 / #205b48 | Georgia editorial headings/body, Arial navigation; square edges, asymmetric register; [prototype](../../prototypes/design/ledger/index.html) |
| Signal Desk | #111c2b / #1c2b3e / #ecf4ff / #b8ee78 | Courier New headings/metadata, Arial body; equal evidence columns, stacked header, hard shadows; [prototype](../../prototypes/design/signal/index.html) |
| Open Commons | #edf3fc / #ffffff / #1f315a / #364daf | Trebuchet MS humanist headings/body; rounded panels, independent step tiles; [prototype](../../prototypes/design/commons/index.html) |

These exact values describe experiments only. Their complete prototype-local variables (muted, border, focus, radius, fonts) are inline in each HTML file and generated in prototypes/design/build.cjs. System font fallbacks vary by OS. No production dark-mode promise follows from Signal Desk's dark exploration.

## Shared proposed behavior

Textual lifecycle status, semantic labeled controls, visible focus, readable comparison fields, no misleading QR proof/accreditation claims, and account-free guarded recipient access apply across directions. Prototype body text is 17px; display headings vary by direction and viewport. Prototype grids stack below 700px; panels/buttons/edges intentionally differ. These are exploration values, not approved production font, spacing or breakpoint tokens. Motion is nonessential and reduced-motion preference must be respected.

## Approval gate

Compare six screens per direction at desktop and mobile, test comprehension with representative issuers/verifiers/recipients, and obtain human choice. Then define production semantic tokens, typography/spacing scale, breakpoint rationale, focus/contrast pairs and component variants; verify accessibility before promotion. Civic Ledger is recommended for testing only. Read [visual directions](../design/VISUAL-DIRECTIONS.md), [decisions](../design/DESIGN-DECISIONS.md), [component contract](COMPONENT-LIBRARY.md), [states](ROUTES-AND-STATES.md) and [accessibility plan](ACCESSIBILITY.md).

The mandatory implementation stack is React.js + TypeScript, Vite, Supabase/PostgreSQL/Auth and Vercel, free tiers only. Standalone HTML prototypes remain authorized isolated exploration and introduce no alternative production backend, framework or hosting. Storage/Edge require justification; no Next.js, separate Node backend, extra cloud, paid service, provisioning or deployment is implied. No stack conflict was identified for these local artifacts; Vercel eligibility, auth SMTP and backup constraints require canonical delivery review before production work.
