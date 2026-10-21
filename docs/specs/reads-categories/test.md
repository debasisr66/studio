# Test plan: Reads with Technical and Others

Spec: [spec.md](spec.md) (`SPEC-RC`). IDs `TC-RC-<group><nn>`. ⬜ not run. Unit tests first (pure helpers in `js/reads-lib.js`), then browser smoke (SPEC-SH SH-02).

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-RC-D01 | RC-01 | `categoryOf({})`, unknown value, `null` | `other` | ⬜ |
| TC-RC-D02 | RC-01 | `categoryOf` with `technical` / `other` | same value | ⬜ |
| TC-RC-D03 | RC-01 | `filterReads` respects category plus tag plus search together | correct subset | ⬜ |
| TC-RC-D04 | RC-01 | Counts per category ignore tag/search filters | whole-sub-item counts | ⬜ |
| TC-RC-U01 | RC-02 | Two tabs exist with counts; `role=tablist`, `aria-selected` | pass | ⬜ |
| TC-RC-U02 | RC-02 | Click, Left/Right arrow, Home/End switch sub-item and move focus correctly | pass | ⬜ |
| TC-RC-U03 | RC-02 | Switching clears tag and search | pass | ⬜ |
| TC-RC-U04 | RC-02 | Default Technical; Others when Technical empty | pass | ⬜ |
| TC-RC-U05 | RC-02 | Empty sub-item shows an empty state | pass | ⬜ |
| TC-RC-U06 | RC-02 | 375 px: tabs fit, no overflow; touch targets ≥ 44 px | pass | ⬜ |
| TC-RC-U07 | RC-02 | Dark and light themes: tab contrast ≥ 4.5:1 | pass | ⬜ |
| TC-RC-U08 | RC-02 | No match here but a match in the other sub-item shows the hint | pass | ⬜ |
| TC-RC-L01 | RC-03 | `#reads` | default sub-item | ⬜ |
| TC-RC-L02 | RC-03 | `#reads/others`, `#reads/technical` | that sub-item | ⬜ |
| TC-RC-L03 | RC-03 | `#reads/xyz`, `#reads/__proto__` | ignored | ⬜ |
| TC-RC-L04 | RC-03 | Switching updates the hash without scrolling the page | pass | ⬜ |
| TC-RC-E01 | RC-04 | Composer requires a section; error is inline and announced | pass | ⬜ |
| TC-RC-E02 | RC-04 | Last chosen section is the next default in the session | pass | ⬜ |
| TC-RC-E03 | RC-04 | Editing can move an entry between sub-items | pass | ⬜ |
| TC-RC-E04 | RC-04 | XSS payloads in title/comment/tags still inert | pass | ⬜ |
| TC-RC-M01 | RC-05 | Migration keeps ids, urls, titles, comments, tags, kinds identical (before/after compare) | pass | ⬜ |
| TC-RC-M02 | RC-05 | All 5 reads and the book carry the owner-confirmed category | pass | ⬜ |
| TC-RC-M03 | RC-05 | Old (v1.5) code renders migrated data (extra keys ignored) | pass | ⬜ |
| TC-RC-V01 | RC-06 | Missing category | CI error (`reads-category`) | ⬜ |
| TC-RC-V02 | RC-06 | Unknown category | CI error | ⬜ |
| TC-RC-V03 | RC-06 | Missing or unknown `schema_version` | CI error (`reads-schema-version`) | ⬜ |
| TC-RC-V04 | RC-06 | Both rules have fixtures and runbook rows (TR-04 guard) | pass | ⬜ |
| TC-RC-S01 | RC-07 | Share, copy, native share unchanged | pass | ⬜ |
| TC-RC-S02 | RC-07 | Counts stay whole-sub-item while filtering | pass | ⬜ |
| TC-RC-B01 | RC-08 | Books appear under articles in their sub-item | pass | ⬜ |
| TC-RC-B02 | RC-08 | Two-column layout gone at all widths; no overflow | pass | ⬜ |
| TC-RC-X01 | RC-09 | Adding a value to `CATEGORIES` in a test double yields a third tab with no other code change | pass | ⬜ |

Regression: all existing reads tests (filter, share, normalise, composer, admin) and the 142-test suite stay green; CSP clean; no new third-party request.

Exit criteria: P0 rows ✅ (RC-01 to RC-06); owner Q2 answered before M-tests run on real data.

## Status log
- 2026-10-21: Draft created; nothing run.
