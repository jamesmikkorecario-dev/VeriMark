# VeriMark — Editorial Systems / 03

**Status:** Unapproved, proposed visual direction. Designed as an alternative to Civic Ledger Round 2. Avoid claiming compliance or production readiness.

## Positioning

**Achievement, on the record.** A high-trust, contemporary product that feels like a carefully edited publication meets an exceptionally clear working tool. The goal is not to look technical or fashionable, but to make facts and actions feel specific, calm and accountable.

The public experience gives more breathing room to the meaning of an achievement. The issuer application makes navigation, statuses, dense lists, and task workflows legible enough for daily use. The certificate is a recognizable object, not a forged trust seal.

## Core design choices

| Element | Proposal | Purpose |
| --- | --- | --- |
| Canvas | `#F6F5F0` | Warm paper, less sterile than white |
| Primary ink | `#1D3730` | Forest-tinted black; confident reading |
| Core forest | `#143D32` | Navigation, strong action, contrast |
| Pine dark | `#0F3229` | Issuer sidebar and footer |
| Accent | `#C1E3AB` | Quiet highlight and status emphasis |
| Secondary canvas | `#E3E8DF` | Layering without indiscriminate shadows |
| Lines | `#D7DCD3` | Legible document division |
| Operational font | Segoe UI / Arial | Familiar, efficient interface text |
| Editorial font | Iowan Old Style / Palatino / Georgia | Human tone for headlines, achievements, credential |
| Minimum body size | 12–15px for dense prototype areas | Needs further accessibility/legibility scrutiny in production |
| Corners | 2–3px | Less template-like than universally rounded cards |
| Icons | Sparse, consistent thin SVG strokes | Support action meaning, not decoration |

No custom font binary is included, ensuring offline operation. In production, approved licensed/self-hosted or reliably available fonts may replace the fallbacks.

## Product systems

### Public surfaces

A restrained wordmark and indexed V device, prominent editorial headlines, record-object previews, strong copy hierarchy, and fine rules. The landing page leads with an example credential and step-based explanation instead of floating generic dashboards. Public navigation stays intentionally small.

### Issuer surfaces

Forest navigation rail with organization context; light work canvas; compact tables, filters, and record status. Dashboard begins with meaningful working data instead of giant vanity charts. Issuance goes through Prepare → Review → Complete with explicit changes of responsibility.

### Recipient and verifier surfaces

Unique record identifier and content remain dominant. Status vocabulary is explicit: **Valid record**, **Revoked**, **Expired**, **Replaced**. Color is secondary, and unknown identifiers never receive success language. A QR code is not presented as independent authenticity proof. Recipient document format is suitable for future printable/downloadable export only after separate approval and backend implementation.

## Motion principles

- `routeIn`: 480ms easing `cubic-bezier(.22,.78,.23,1)`, subtle 8px translation.
- Scroll reveals: 650ms, 16px translation, only for noncritical promotional content; all content remains in DOM.
- Button hover: 220ms background/elevation and 250ms icon movement.
- Verification demo: short 520ms pending state followed by a revealed result; no claim of network call.
- Issuance demo: 420ms confirmation feedback; redundant confirm disabled immediately.
- Reduced motion: transitions and animations removed through `prefers-reduced-motion: reduce`; the demo timers complete immediately.

No endless shimmer, motion that changes a record's validity, invasive parallax, or concealed critical information. Interaction details must be re-reviewed when ported to React.

## Deliberate departures from existing Round 2

1. A fuller landing page, with proposition, process, factual example, audience and closing action.
2. More cohesive distinction between the public and issuer shells.
3. Operational dashboard with multiple records, metrics, real filters, activity and task hierarchy.
4. A single high-value credential record design that is repeated across entry points.
5. Consistent status treatments without suggesting that badges prove cryptographic authenticity.
6. A designed sign-in entry and supporting organizational pages, avoiding dead ends.
7. Actual clickable, local, stateful demonstration with screenshots at desktop and mobile.

## Decisions reserved for the user

- Whether to approve this direction or combine it with Civic Ledger elements.
- Whether to add a fully designed dark theme after the light identity is approved.
- What brand mark is final; the V is a concept, not a registered identity.
- Actual copywriting and institutional/issuer identity disclosures.
- Which features are in MVP, and what must be delayed beyond MVP.

**No final visual design approval is implied by this artifact.**
