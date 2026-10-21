# Test plan: Stabilize the core hub

Spec: [spec.md](spec.md) (`SPEC-SH`). IDs `TC-SH-<group><nn>`. ⬜ not run. Test first: each case is shown failing before its code exists.

## Isolation (I), SH-01
| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-SH-I01 | Force each renderer to throw, one at a time | That section shows the fixed fallback line; every other section renders | ✅ |
| TC-SH-I02 | Force a renderer to throw with a token present | Admin unlock/gear still works | ✅ |
| TC-SH-I03 | Exception message contains `<img onerror>` | Not shown anywhere on the page | ✅ |
| TC-SH-I04 | A content file returns 404 or invalid JSON | Only its section degrades | ✅ |
| TC-SH-I05 | No new console error on a healthy page | pass | ✅ |

## Browser smoke (B), SH-02, SH-05
| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-SH-B01 | Healthy content, 1280 px | All sections present; product cards, updates, version | ✅ |
| TC-SH-B02 | Healthy content, 375 px | No horizontal overflow (scrollWidth ≤ width), bottom nav present | ✅ |
| TC-SH-B03 | CI step runs without npm and finishes under 60 s | pass | ✅ |
| TC-SH-B04 | Smoke step fails the run when a section is broken (proven by a deliberately broken branch) | red | ✅ |
| TC-SH-B05 | Product without cache entry | "details syncing" card, no stars/language | ⬜ |
| TC-SH-B06 | Release without matching asset | Download falls back to the release page | ⬜ |
| TC-SH-B07 | Product missing tagline | Repo description used | ⬜ |
| TC-SH-B08 | Empty reads, empty podcasts, empty updates | Friendly empty states | ⬜ |
| TC-SH-B09 | Very long title and comment | Wraps; no overflow | ⬜ |

## Contract and versions (C, V), SH-03, SH-04
| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-SH-C01 | Every file in `content/` appears in CONTRACT.md | pass | ✅ |
| TC-SH-C02 | Every `RULES` id appears in CONTRACT.md | pass | ✅ |
| TC-SH-C03 | Removing a file or rule from the doc fails the test | pass | ✅ |
| TC-SH-V01 | `reads.json` with a known `schema_version` | accepted | ✅ |
| TC-SH-V02 | Unknown or non-integer version | CI error | ✅ |
| TC-SH-V03 | Missing version | CI error after migration; runtime tolerates (defaults) | ✅ |
| TC-SH-V04 | Version key present in the real files after migration | pass | ✅ |

## Asset rules (A), SH-06
| ID | Case | Expected | Status |
|----|------|----------|--------|
| TC-SH-A01 | `size` negative or fractional | error | ⬜ |
| TC-SH-A02 | `download_url` host not `github.com` | error | ⬜ |
| TC-SH-A03 | Real `cache.json` passes | no new warning | ⬜ |

## Docs (D) and timeouts (T), SH-07, SH-08
| ID | Case | Status |
|----|------|--------|
| TC-SH-D01 | Each operation in OPERATIONS.md executed once, as written | ✅ |
| TC-SH-D02 | Links to RUNBOOK/LEARNING-GUIDE resolve | ✅ |
| TC-SH-T01 | A hanging content request times out at 8 s and the section falls back | ✅ |
| TC-SH-T02 | A slow-but-successful request under 8 s still renders | ✅ |

## Exit criteria
All P0 rows ✅ (SH-01, 02, 03, 04, 07); SH Phase A merged before any RC/PC/UX code; existing 142 tests unchanged and green; traceability in spec §10 filled.

## Status log
- 2026-10-21: Phase B run: `tests/spec-sh-phase-b.test.js` (11 tests, 8 failed first) plus two new smoke cases (version-less reads renders; newer `schema_version` shows the Reads fallback only). Unit tests 164 pass; smoke 15 of 15 (18 s); validator OK. D01: add, hide, retire and recategorise executed as written in OPERATIONS.md (outputs match; one extra harmless warning documented); `gh workflow run`, `gh run list` and `gh secret list` run earlier or now. D02: a new test checks every relative link and heading anchor in README and docs/ (all resolve). C04 note: TC-SH-V04 for `podcasts.json` follows with SPEC-PC; the publish-over-a-newer-file guard in the admin is by code inspection (no stubbed-API test yet).
- 2026-10-21: Phase A run: unit tests `tests/safe-lib.test.js` (11) and `scripts/smoke.js` (13 cases). Smoke cases failed on the unguarded v1.5 page (7 of 13 failed locally, 6 of 13 passed in the CI red drill) and pass with the change: 13 of 13 locally in 16 s and on GitHub's runner in 29 s. Red proof (B04): a throwaway branch with the old `app.js` made only the smoke step fail while unit tests and the validator stayed green; branch deleted. I03: the fallback is a constant string (unit-tested) and no exception text appears on the page (smoke). Cases B05-B09, C, V, A, D remain for later phases.
- 2026-10-21: Draft created; nothing run.
