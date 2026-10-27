# Spec: Owner status line

| | |
|---|---|
| Spec ID | `SPEC-ST` (requirements `ST-01` … `ST-06`) |
| Status | **Built (2026-10-27); in review; ships as Studio 2.1 in a release PR** |
| Owner | Debasis Ray |
| Created | 2026-10-27 |
| Parent | [PRD](../../PRD.md) §7; [Content contract](../../CONTRACT.md) |
| Depends on | [SPEC-SH](../stabilize-core-hub/spec.md) (section isolation, content contract), [SPEC-UX](../simple-layout/spec.md) (first-screen budget) |
| Target | Studio 2.1 (a small release after the frozen 2.0; rollback tag `v2.0`) |

## 1. Summary

The owner can tell every visitor, in one short line, where Studio stands: for example **Studio: Steady · Next: Incubating · Owner: Thinking · as of 27 Oct**. It comes from one small file in Git that the owner edits; Studio shows it under the hero. Simplicity is the requirement: three short fields, a visible date, plain text, no history, no new page, nothing about visitors.

## 2. Decisions (owner, 2026-10-27)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Labels | The plain-English set: **Studio** (Active, Steady, Quiet, Paused), **Next** (Idea, Incubating, Building, Launching soon), **Owner** (Building, Thinking, Away until …). Labels and values are free text within limits, so nothing is locked |
| D2 | Placement | One slim line under the hero. Not a section, not in the navs |
| D3 | Staleness | The date is always shown ("as of 27 Oct"). No automatic hiding or greying in version 1 (the author's default; the owner did not choose) |
| D4 | Optional note | Not in version 1 (the author's default). Three to four items only |
| D5 | How the owner updates it | Edit `content/status.json` in Git (the GitHub web or app on a phone). An owner-tools entry is later work (ST-06) |

## 3. Requirements

**ST-01 (P0): The file.** `content/status.json` is `{ "schema_version": 1, "updated": "YYYY-MM-DD", "items": [ { "label": "…", "value": "…" } ] }`. One to four items; a label is 1 to 20 characters and a value 1 to 40, plain text (no `<`, `>`, links or `www.`); `updated` is a real date not in the future. A newer `schema_version` than the page knows hides the line. The file is documented in the contract and covered by CI.

**ST-02 (P0): The line.** When the file is present and valid, a single line under the hero shows each label in bold followed by its value, separated by dots, then "as of" and the date in the visitor's short format. It wraps on a phone. When the file is missing, unreadable or invalid, the line is simply absent and the rest of the page is unaffected.

**ST-03 (P0): Safe and private.** Every value reaches the page as text (never markup); the page re-checks the shape and the limits itself and ignores anything else. No new storage key, cookie, request, host or script; CSP unchanged. Nothing about a visitor is recorded.

**ST-04 (P1): CI rules.** The validator enforces ST-01 with named rules, each proven by a failing fixture and explained in the runbook; the health check confirms the file is served.

**ST-05 (P1): First-screen budget.** The line costs one line of height on desktop and at most two on a phone. The first-screen checks of SPEC-UX (portrait, small phone, landscape, desktop) still pass with the line present, and the layout holds at 256 px.

**ST-06 (P2): Later, not built.** An entry in the owner tools to edit the status from the phone; greying the line after a number of days; an optional note.

## 4. Security and trust

- The only new input is a file the owner commits; it passes the same CI as every content file. The page treats it as untrusted text anyway (ST-03).
- No new network call, host, storage, cookie or script. No visitor data. The CSP does not change.
- A stale or wrong status is the owner's content risk; the always-visible date is the guard.

## 5. Edge cases

| Case | Expected |
|------|----------|
| File missing (404) | No line, no error |
| Invalid JSON, wrong shape, an empty items list | No line |
| More than four items, or a value over 40 characters | CI rejects it; the page shows the first four items and trims nothing silently (it hides the line if any value breaks the limits) |
| `<img onerror>` or `<script>` as a value | Shown as inert text, or CI rejects it |
| Newer `schema_version` | No line |
| Very long values at 256 px | Wrap, no sideways scroll |

## 6. Traceability

| Req | Tests (see test.md) | Code or doc touched |
|-----|---------------------|---------------------|
| ST-01 | TC-ST-D01–D06 | `content/status.json`, `docs/CONTRACT.md` |
| ST-02 | TC-ST-R01–R03 | `index.html`, `js/app.js`, `css/site.css` |
| ST-03 | TC-ST-S01–S03 | `js/app.js` |
| ST-04 | TC-ST-D01–D08 | `scripts/validate-site.js`, `docs/RUNBOOK.md`, `scripts/health-check.js` |
| ST-05 | TC-ST-L01 (and the existing TC-UX-F01, A03 cases run with the line present) | `css/site.css`, healthy fixture |
| ST-06 | none (P2) | none |

## 7. Status log

- 2026-10-27: Draft created from the owner's idea (Mode, New product, Owner); the three labels improved to Studio, Next, Owner; approved ("go") with the better words. Defaults D3 and D4 chosen by the author.
- 2026-10-27: Built. Unit `tests/spec-st.test.js`, smoke `TC-ST-R01` to `R03`, six CI rules with fixtures, contract and runbook entries, health check serves-list. The validation lives in `js/reads-lib.js` (`validateStatusFile`, `statusView`) so CI and the page apply the same rules; `reads-lib.js` is about 28.7 of 30 KB and the total about 148.9 of 150 KB: little room left. The initial `content/status.json` carries the owner's example (Studio: Steady, Next: Incubating, Owner: Thinking), dated 27 Oct; edit it to change it. Not in 2.1: ST-06.
