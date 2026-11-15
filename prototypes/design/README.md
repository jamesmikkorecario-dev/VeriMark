# VeriMark offline visual explorations

Open `index.html` in a browser by double-clicking it. Choose Civic Ledger, Signal Desk or Open Commons. No server, network, dependencies, login or environment file is required. Every person, issuer and record is fictional. These files are design prototypes, not production UI or actual credentials.

Direct previews:

- `ledger/index.html` — Civic Ledger
- `signal/index.html` — Signal Desk
- `commons/index.html` — Open Commons

Append `#landing`, `#verify`, `#details`, `#dashboard`, `#issue` or `#recipient` to open each of the six screens directly. Browser navigation and refresh work; refresh intentionally resets demo issuance.

Try verification with `DEMO-A8K72`, an invalid value such as `bad`, and an unknown code such as `DEMO-MISSING`. For issuance, enter a fictional recipient, review, return to editing if needed, review again and approve. The local `DEMO-LOCAL-001` record appears in details and can be checked on Verify until refresh. Repeating issuance replaces the single local fixture; there is no batch persistence. The dashboard shows the original fixture plus the local count but only the most recent row as a preview, not a complete inventory.

Recipient access needs no account. Show the local verification link or download a clearly marked fictional text summary. It is not a PDF certificate. Links are local file URLs and cannot verify anything publicly.

Every screen has an explicit review-only state selector: valid, loading, empty, invalid, not-found, expired, revoked, unable, error, success and denied. Loading and failures are simulated, with reset/retry behavior; no network request happens. Controls use native buttons, inputs and selects with visible focus. A skip link focuses main; navigation focuses the new screen.

Regenerate standalone artifacts: `node prototypes/design/build.cjs`.
Repeat browser evidence: `node prototypes/design/check.cjs`. This uses an already installed Orca agent-browser executable; override its location through `VERIMARK_BROWSER`. It neither installs packages nor downloads browsers. Screenshots and command-level JSON output are in `evidence/`. The test launches its own named browser session and closes it.

Review correction: verification/details now resolve by exact selected identifier; after local issuance the original DEMO-A8K72 still displays Alex and DEMO-LOCAL-001 displays the new fictional recipient. Unknown identifiers remain not found on details too. Recipient view intentionally shows the local issuance. The state selector additionally includes replaced, explicitly labeled a proposed lifecycle behavior; it does not perform a real replacement. Proposed status precedence is revoked > replaced > expired > valid.
