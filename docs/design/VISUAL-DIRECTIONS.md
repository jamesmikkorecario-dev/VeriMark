# Three original directions

Open [the comparison index](../../prototypes/design/index.html) locally. Each direction is a standalone HTML file with inline CSS/JS, no remote dependencies and six hash-addressable screens.

| Direction | Design language | Layout and hierarchy | Benefit / tradeoff |
| --- | --- | --- | --- |
| Civic Ledger | Georgia editorial headings/body, forest ink, warm paper, square borders | Horizontal masthead; asymmetric public-record layout; numbered comparison steps | Calm institutional legibility without a seal; serif density needs comprehension testing |
| Signal Desk | Courier headings and metadata, Arial body, midnight surfaces, lime actions | Two-level header; wider equal-column evidence grid; hard shadow panels; compact headlines | Strong operational scanning for issuers; dark public verification may feel technical |
| Open Commons | Trebuchet humanist type, blue-white surfaces, generous rounded panels | Friendly oversized headline, soft cards, independent guided step tiles | Approachable for campus groups; softer framing may dilute the record's seriousness |

These use system font stacks for offline portability; fallback font rendering varies by OS. Shared semantics and fixture logic keep comparisons fair, while typography, page proportions, navigation framing, surfaces, edges and step treatments vary. No competitor UI or existing brand kit was copied.

Recommendation: Civic Ledger for the first usability round. Its readable public-register structure supports comparison and reserves emphasis for record status. This is a design judgment, not validated preference or approval. Signal Desk remains a candidate if issuer efficiency dominates; Open Commons if first-time recipient comfort dominates.

Each file supports `#landing`, `#verify`, `#details`, `#dashboard`, `#issue`, `#recipient`. Compare all three at 1440px and 390px; screenshots are under `prototypes/design/evidence/`. All demonstrate exactly the same fictional issuer and record so branding does not imply different trust levels.
