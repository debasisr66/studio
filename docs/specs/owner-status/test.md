# Test plan: Owner status line

Spec: [spec.md](spec.md) (`SPEC-ST`). IDs `TC-ST-<group><nn>`. ⬜ not run.

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-ST-D01 | ST-01, ST-04 | The real `content/status.json` passes the validator | no errors | ⬜ |
| TC-ST-D02 | ST-01, ST-04 | Fixtures `status-schema-version`, `status-items`, `status-label`, `status-value`, `status-updated`, `status-plain` each fail with their rule (TR-04 harness) | pass | ⬜ |
| TC-ST-D03 | ST-01 | Boundaries: 1 and 4 items pass, 0 and 5 fail; label 20 passes, 21 fails; value 40 passes, 41 fails | pass | ⬜ |
| TC-ST-D04 | ST-01 | `updated`: valid date passes; tomorrow's date and a bad format fail | pass | ⬜ |
| TC-ST-D05 | ST-01 | Plain text: `<`, `>`, `http://`, `www.` refused in labels and values | pass | ⬜ |
| TC-ST-D06 | ST-04 | The contract lists the file and every rule id; the runbook explains each rule | pass | ⬜ |
| TC-ST-D07 | ST-04 | The health check serves-list includes `/content/status.json` | pass | ⬜ |
| TC-ST-R01 | ST-02 | Valid file: one line shows each label, value, and "as of" the date; XSS payloads are inert text | pass | ⬜ |
| TC-ST-R02 | ST-02 | File missing (404): no line, the page renders, no console error | pass | ⬜ |
| TC-ST-R03 | ST-02 | Invalid shape, newer `schema_version`, over-limit value: no line, no error (unit on the renderer's check) | pass | ⬜ |
| TC-ST-S01 | ST-03 | No new storage key, cookie or host; CSP unchanged | pass | ⬜ |
| TC-ST-S02 | ST-03 | The values reach the DOM through `textContent` only (static check) | pass | ⬜ |
| TC-ST-L01 | ST-05 | With the line present: first-screen cases (375x812, 375x667, 812x375, 1280x800), reflow at 320 and 256 px, 44 px targets all pass | pass | ⬜ |

Regression: the full suites stay green; browser run stays under its time budget.

## Status log
- 2026-10-27: Draft created; nothing run.
