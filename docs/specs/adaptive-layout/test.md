# Test plan: Simpler layout, adaptive by use

Spec: [spec.md](spec.md) (`SPEC-UX`). IDs `TC-UX-<group><nn>`. ⬜ not run. The scoring and storage rules live in a pure module (`js/layout-lib.js`) so most cases are Node unit tests written first; the rest use the browser smoke test (SPEC-SH SH-02).

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-UX-S01 | UX-01 | Order in the DOM: hero, Products, Updates, Reads, Podcasts (defaults) | pass | ⬜ |
| TC-UX-S02 | UX-01 | Products and Updates never move whatever the stored data says | pass | ⬜ |
| TC-UX-S03 | UX-01 | Default adaptive order is Reads then Podcasts | pass | ⬜ |
| TC-UX-P01 | UX-02 | Every section has heading, one-line description, empty state | pass | ⬜ |
| TC-UX-P02 | UX-02 | Admin add action appears only when unlocked, one per section | pass | ⬜ |
| TC-UX-P03 | UX-02 | Touch targets ≥ 44 px at 375 px; no overflow | pass | ⬜ |
| TC-UX-P04 | UX-02 | Two-column Reading list/Books layout is gone | pass | ⬜ |
| TC-UX-N01 | UX-03 | Header and bottom nav show the same four links | pass | ⬜ |
| TC-UX-N02 | UX-03 | Nav order equals page order, also when reordered | pass | ⬜ |
| TC-UX-N03 | UX-03 | `aria-current` follows the section in view | pass | ⬜ |
| TC-UX-N04 | UX-03 | Keyboard: skip link, tab order matches visual order | pass | ⬜ |
| TC-UX-N05 | UX-03 | What's new, theme toggle, logo unchanged | pass | ⬜ |
| TC-UX-U01 | UX-04 | `record('reads')` adds 1 to the decayed score and stamps the day | pass | ⬜ |
| TC-UX-U02 | UX-04 | Unknown unit ignored | pass | ⬜ |
| TC-UX-U03 | UX-04 | Counted events: nav open, sub-item switch, filter/search, outbound open, copy/share | pass | ⬜ |
| TC-UX-U04 | UX-04 | Scrolling or merely viewing does not count | pass | ⬜ |
| TC-UX-U05 | UX-04 | Stored shape ≤ 1 KB even after thousands of events (clamped) | pass | ⬜ |
| TC-UX-U06 | UX-04 | Corrupt, hostile or oversized stored value → treated as empty | pass | ⬜ |
| TC-UX-V01 | UX-05 | Use the page heavily: zero new network requests and zero new hosts | pass | ⬜ |
| TC-UX-V02 | UX-05 | Only the one `studio-use-v1` key (plus the existing seen-version key) is written; no cookie | pass | ⬜ |
| TC-UX-V03 | UX-05 | Storage blocked or throwing → default order, no console error | pass | ⬜ |
| TC-UX-V04 | UX-05 | Stored data never appears in a URL or the DOM | pass | ⬜ |
| TC-UX-V05 | UX-05 | CSP unchanged (validator rule still green) | pass | ⬜ |
| TC-UX-R01 | UX-06 | Score decays: an event 30 days old counts half | pass | ⬜ |
| TC-UX-R02 | UX-06 | Leader below 3 → default order | pass | ⬜ |
| TC-UX-R03 | UX-06 | Leader ≥ 3 and ≥ 1.5× runner-up → reorders | pass | ⬜ |
| TC-UX-R04 | UX-06 | Leader ≥ 3 but under 1.5× → default | pass | ⬜ |
| TC-UX-R05 | UX-06 | Computed at load only: events during the visit do not move sections | pass | ⬜ |
| TC-UX-R06 | UX-06 | Same rule picks the Reads default sub-item | pass | ⬜ |
| TC-UX-R07 | UX-06 | Exactly equal scores → default order (deterministic) | pass | ⬜ |
| TC-UX-R08 | UX-06 | Old counts fade: a section unused for ~6 months loses its lead | pass | ⬜ |
| TC-UX-C01 | UX-07 | Layout shift from the reorder = 0 (order set before first render of those sections) | pass | ⬜ |
| TC-UX-C02 | UX-07 | No animation added; `prefers-reduced-motion` honoured | pass | ⬜ |
| TC-UX-C03 | UX-07 | Reorder does not change scroll position on load | pass | ⬜ |
| TC-UX-L01 | UX-08 | `#products`, `#updates`, `#reads`, `#podcasts` reach the right section in default and reordered states | pass | ⬜ |
| TC-UX-L02 | UX-08 | `#reads/technical` and `#reads/others` | pass | ⬜ |
| TC-UX-L03 | UX-08 | `#blog` → Podcasts | pass | ⬜ |
| TC-UX-L04 | UX-08 | Unknown hash does nothing harmful | pass | ⬜ |
| TC-UX-L05 | UX-08 | Anchors work with storage blocked | pass | ⬜ |
| TC-UX-T01 | UX-09 | Footer note and Reset button present | pass | ⬜ |
| TC-UX-T02 | UX-09 | Reset clears the key; next load shows defaults; message confirms | pass | ⬜ |
| TC-UX-T03 | UX-09 | Reset works with storage blocked (no error) | pass | ⬜ |

Owner walk-through (no analytics, so judged by eye): within 5 seconds a first-time visitor can say what Studio is, find Penny, and find the latest release; Reads and Podcasts are one tap from the nav. Recorded as a checklist in `docs/test.md`.

Regression: 142-test suite, RC and PC suites, health and CI green; page weight within budgets.

Exit criteria: P0 rows ✅ (UX-01 to UX-08); owner Q1 answered before UX-04 design.

## Status log
- 2026-10-21: Draft created; nothing run.
