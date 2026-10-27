# Review: CI-RED Red CI alert (health workflow trigger, issue with fix steps)

Process: [REVIEW-GATE.md](../REVIEW-GATE.md); not a gated phase, requested by the owner (2026-10-27) because the change adds a workflow permission (`issues: write`) and a `workflow_run` trigger. Reviewer: the model the owner named, Claude Haiku 5.5, which the gate accepts as the minimum. The reviewer was given the files, the change description and the threat list, and not the author's conclusions. It ran the unit tests and the validator.

| Item | Value |
|------|-------|
| Scope | `.github/workflows/health.yml`, `scripts/validate-site.js` (workflow permission rules), `scripts/health-check.js`, `scripts/ci-red.js`, `docs/CI-RED-FIX.md`, `docs/RUNBOOK.md`, `tests/ci-red.test.js` |
| Author model | Claude Sonnet 5.5 |
| Reviewer model | Claude Haiku 5.5 (separate agent, fresh context, read-only) |
| Reviewed commit | c13122d (first review); fixes re-checked at a8c2ac0; the quoted-YAML fix and the validator note came after the re-check |
| Reviewer verdict | APPROVE WITH CONDITIONS |
| Owner acknowledgement | pending |

First verdict: `VERDICT: APPROVE WITH CONDITIONS` ("fix findings 1 and 2 (concurrency group, run-number ordering) and add a test for each. Fix finding 3 with a job-level permissions test, and tighten W04"). Re-check verdict (a8c2ac0), copied verbatim: `VERDICT: APPROVE WITH CONDITIONS` ("close the quoted-key/value gap (finding A) with a test, or record it as a known limitation in the validator comment. Finding C is a one-line cleanup"). Finding A was fixed with a test and the limit on aliases recorded in the validator after that; not re-checked.

## Findings

| # | Severity | Where | Scenario (reviewer, shortened) | Fix | Status |
|---|----------|-------|-------------------------------|-----|--------|
| 1 | Medium | `health.yml` | Two red runs close together both list no issue and both open one | `concurrency: group: health, cancel-in-progress: false` | Fixed, TC-CIR-R01; re-check: fixed |
| 2 | Medium | `ci-red.js`, `health-check.js` | Sorting by finishing time lets an older push that finishes red later open an issue while main is green | sort by `run_number` (push order) | Fixed, TC-CIR-R02; re-check: fixed |
| 3 | Medium (latent) | `validate-site.js` | Only the top-level `permissions:` block was read; a job-level write or write-all passed | scan every `permissions:` key at any depth | Fixed, TC-CIR-R03, R06 (flow style, added by the author); re-check: fixed |
| 4, 5 | Low | tests | W04 and the name alternative in W01 were vacuous | removed; TC-CIR-R04 asserts no `ref:`, `persist-credentials: false`, the CI name | Fixed; re-check: fixed |
| 6 | Low | tests | cancelled-run handling and the Actions-only gate untested end to end | covered for cancelled runs (I04); the gate is a one-line condition | Partly open (the gate has no test) |
| 7 | Low | `CI-RED-FIX.md` | `git revert -m 1` fails on a non-merge commit | both commands in the doc, TC-CIR-R05 | Fixed; re-check: fixed |
| 8 | Low/info | health.yml | extra "Still red" comments; fork PRs named main start a harmless health run; keep no credentials | `persist-credentials: false` | Fixed (credentials); the rest accepted |
| A | Low (new) | validator | quoted keys or values (`"contents": write`, `contents: "write"`, `"write-all"`) were not read | strip quotes before matching; TC-CIR-R07 | Fixed after the re-check; not re-checked |
| B | Info | validator | YAML aliases and anchors are not followed | none: needs commit access to main to introduce | Accepted, recorded as a known limit in the validator |
| C | Info | test comment | referenced this file before it existed | this file | Fixed |

## Checked and found sound (reviewer)

No untrusted code runs with the write-capable token: `workflow_run` checks out the default branch, no `ref:`, no event field in any shell command; issue text is plain; `issues: write` is the minimum; only the exact title is touched and pull requests are excluded; green with no issue writes nothing; cancelled runs are ignored; every API failure returns a string and never throws; the commands in the doc are valid and non-destructive.

## Not checked

Live GitHub behaviour (the default checkout for `workflow_run`, whether GitHub emails issues opened by the Actions bot, concurrency queue semantics, rate limits) and running the health check against the live API. The red path has not run on the real repository.

## Re-review

Done once, at a8c2ac0, by the same agent (verdict above).
