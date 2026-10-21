# Test plan: Product trust and reliability

Spec: [spec.md](spec.md) (`SPEC-TR`). Test IDs are `TC-TR-<group><nn>`. Status values: ⬜ not run · ✅ pass · ❌ fail · ➖ not applicable. Phases A and B results recorded below (128 tests pass locally); Phase C not started. H04 (API unreachable → note only) is by code inspection, not yet unit-tested. N01 and N03 are completed on the pull request / in the browser.

## Strategy

- **Test first.** Each rule gets a failing fixture or unit test before the code that satisfies it, and the test is shown to fail on the unfixed code (the repo's established practice).
- **Layers:** pure unit tests with `node --test` (validators, drift and freshness logic, sync decision logic); fixture files for validator proof (TR-04); a forced-failure drill for sync and health on a throwaway branch; browser smoke for rendering under bad data; document review for runbook and policy.
- **No new dependencies.** Fixtures are plain JSON under `tests/fixtures/`.

## Unit and fixture tests

### TR-01 URL rule (U)
| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-TR-U01 | `https://example.com/a?b=1` | accepted | ✅ |
| TC-TR-U02 | `http://example.com` | accepted | ✅ |
| TC-TR-U03 | `javascript:alert(1)` | rejected | ✅ |
| TC-TR-U04 | `data:text/html,x` | rejected | ✅ |
| TC-TR-U05 | `" https://a.com"` and `"https://a.com\n"` | rejected (whitespace) | ✅ |
| TC-TR-U06 | `"https://a.\tcom"` and a URL with a NUL or other control character | rejected | ✅ |
| TC-TR-U07 | `https://user:pw@a.com` | rejected (credentials) | ✅ |
| TC-TR-U08 | `""`, `"http://"`, a 2049-character URL | rejected | ✅ |
| TC-TR-U09 | The rule is applied to every URL field in products, cache, blog, reads and changelog; each reports file, entry and field | pass | ✅ |

### TR-02 Cache contract (C)
| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-TR-C01 | Missing `synced_at` | error | ✅ |
| TC-TR-C02 | `synced_at` not ISO-8601 UTC | error | ✅ |
| TC-TR-C03 | `synced_at` more than 5 min in the future | error | ✅ |
| TC-TR-C04 | `stars` negative or fractional | error | ✅ |
| TC-TR-C05 | `latest_release.tag` empty | error | ✅ |
| TC-TR-C06 | Cached repo not in registry, or hidden | warning only | ✅ |
| TC-TR-C07 | Known-good current `cache.json` | no error, no new warning | ✅ |

### TR-03 Registry integrity (R)
| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-TR-R01 | Duplicate `slug` | error | ⬜ |
| TC-TR-R02 | `slug` with uppercase or spaces | error | ⬜ |
| TC-TR-R03 | Empty `category` | error | ⬜ |
| TC-TR-R04 | Unknown `category` | warning listing known values | ⬜ |

### TR-04 Every rule can fail (X)
| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-TR-X01 | Each enumerated rule id has one failing fixture and the validator reports that id | pass | ⬜ |
| TC-TR-X02 | Removing a fixture makes the meta-test fail (proves the guard works) | pass | ⬜ |

## Sync tests (S), TR-05

Pure decision logic is unit-tested; the workflow behaviour is proven by a drill on a throwaway branch.

| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-TR-S01 | One product fetch fails, prior entry exists | entry kept unchanged; failure listed (repo, reason); outcome = partial failure | ✅ |
| TC-TR-S02 | One product fails, others change | others written and committed; run ends red | ✅ |
| TC-TR-S03 | Rate-limit guard trips | remaining products reported as skipped by rate limit, prior entries kept | ✅ |
| TC-TR-S04 | All products fail | cache file untouched; red | ✅ |
| TC-TR-S05 | Nothing changed, nothing failed | "No changes"; green; no commit | ✅ |
| TC-TR-S06 | Drill: point a throwaway registry entry at a missing repo, run sync with `DRY_RUN=true`, then for real on a branch | red run, summary names the repo, `main` history unchanged except good entries | ✅ |

## Health tests (H), TR-06 to TR-08

| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-TR-H01 | Last successful `sync.yml` run 10 h ago, `synced_at` 20 days old | healthy | ✅ |
| TC-TR-H02 | Last successful run 49 h ago | UNHEALTHY, names the run time | ✅ |
| TC-TR-H03 | No successful run ever (new repo or all failed) | UNHEALTHY | ✅ |
| TC-TR-H04 | Actions API unreachable | note only, not a failure | ⬜ |
| TC-TR-H05 | Threshold constant changed in one place changes the verdict | pass | ✅ |
| TC-TR-H06 | `download_asset` configured, latest release lacks a matching asset | parity problem names the product | ⬜ |
| TC-TR-H07 | Cached `download_url` points at a different asset than GitHub's | parity problem | ⬜ |
| TC-TR-H08 | Cached repo hidden or not in registry | warning | ⬜ |
| TC-TR-H09 | Product repo returns 404 | named in output, no crash | ⬜ |
| TC-TR-H10 | Every problem line carries `Fix:` with a RUNBOOK anchor that exists | pass | ⬜ |

## Documentation review (D), TR-09 to TR-11

| ID | Check | Status |
|----|-------|--------|
| TC-TR-D01 | `docs/RUNBOOK.md` covers all nine listed situations with commands | ✅ |
| TC-TR-D02 | Every health and validator message maps to a RUNBOOK row (script-checked) | ⬜ |
| TC-TR-D03 | `LEARNING-GUIDE.md` and README link to RUNBOOK; no duplicated fix steps | ✅ |
| TC-TR-D04 | Runbook commands for manual re-sync were executed once exactly as written | ⬜ |
| TC-TR-D05 | `docs/rulesets/README.md` has the decision record and revisit triggers | ✅ |
| TC-TR-D06 | PRD open question 2 closed and linked | ✅ |

## No-regression and security (N)

| ID | Check | Status |
|----|-------|--------|
| TC-TR-N01 | Existing 102 tests plus new tests pass; CI green on the pull request | ⬜ |
| TC-TR-N02 | `git diff main -- .github` shows only intended edits; no new `permissions`, secrets or unpinned actions (CI rule already enforces pins) | ✅ |
| TC-TR-N03 | Browser smoke at 375 and 1280 px: valid data renders; missing release, missing product entry and a stale cache still render with fallbacks; no console or CSP errors | ⬜ |
| TC-TR-N04 | Admin unlock and publish of a read still works (owner step) | ⬜ |
| TC-TR-N05 | Existing content passes the stricter validator with no new error (any new warning is listed) | ✅ |

## Exit criteria

All P0 rows ✅ (TR-01, 02, 05, 06, 09, 11, 13); P1 rows ✅ or deferred in writing; traceability table in [spec.md](spec.md) §14 filled with results; `docs/test.md` gets REQ-44… rows pointing here.

## Traceability summary (requirement → tests)

| Req | Tests | Priority |
|-----|-------|----------|
| TR-01 | U01-U09 | P0 |
| TR-02 | C01-C07 | P0 |
| TR-03 | R01-R04 | P1 |
| TR-04 | X01-X02 | P1 |
| TR-05 | S01-S06 | P0 |
| TR-06 | H01-H05 | P0 |
| TR-07 | H06-H09 | P1 |
| TR-08 | H10 | P1 |
| TR-09 | D01-D03 | P0 |
| TR-10 | D04 | P1 |
| TR-11 | D05-D06 | P0 |
| TR-12 | none (P2) | P2 |
| TR-13 | N01-N05 | P0 |

## Status log

- 2026-10-21: Draft created.
- 2026-10-21: Phase A run: U01-U09, C01-C07, D01/D03/D05/D06, N02, N05 pass. Test U08 caught a real edge (`https:///x` parsed as host `x`); rule fixed. Existing tests that omitted `synced_at` were updated.
- 2026-10-21: Phase B run: S01-S05 and H01-H03, H05 unit tests pass (12 failed before the code). S06 drill on a throwaway branch with a missing repo: fetch step red, commit step still ran (stale star count 99 → 1 repaired, failed product not added), run red, summary named the repo; branch deleted. Health check ran healthy against the live Actions API.
- 2026-10-21: Rewritten with IDs and cases grounded in findings F1-F10; nothing executed yet.
