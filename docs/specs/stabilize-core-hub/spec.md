# Spec: Stabilize the core hub

| | |
|---|---|
| Spec ID | `SPEC-SH` (requirements `SH-01` … `SH-08`) |
| Status | **Approved by the owner (2026-10-21); not started** |
| Owner | Debasis Ray |
| Created | 2026-10-21 |
| Parent | [PRD](../../PRD.md) §9.1, §9.2, §10.2, §11, §13, Roadmap Phase 1 and Phase 2.5; [§22](../../PRD.md) |
| Siblings | [test.md](test.md) · Studio 2.0 order: **SH (this, first)** → RC → PC → UX |
| Target | Studio v2.0 (foundation work lands first, behind no visible change) |

## 1. Summary

Before Reads, Podcasts and the layout change, the core hub needs a safety floor so that three content and layout changes cannot take the page down or break old data silently. Most of PRD Phase 1 shipped between v1.1 and v1.5; this spec covers what is still missing, found by reading the code.

## 2. Evidence: what exists and what is missing

| # | Finding | Evidence | Maps to |
|---|---------|----------|---------|
| F1 | **One broken section can stop the whole page.** `renderAll()` calls six renderers in sequence with no isolation, and `boot()` has no `try/catch`. If `renderBlog()` throws (say, on a malformed post), `renderReads()`, `renderVersion()` and `renderProfile()` never run, and `enableAdmin()` is skipped, so the owner cannot even unlock to fix it | `js/app.js` `renderAll` (line ~224), `boot` (~70-88) | SH-01 |
| F2 | **No in-repo browser test.** 142 unit tests cover pure logic; rendering is only checked by hand or by a scratch harness that is not in the repo. Three section changes in 2.0 would be verified by memory | `tests/` has no DOM or browser test | SH-02 |
| F3 | **No content contract and no schema version.** Field rules live only inside validators and `docs/ARCHITECTURE.md` prose. 2.0 changes `reads.json` and adds `podcasts.json`; nothing says which shape a file is | `content/*.json` have no version key | SH-03, SH-04 |
| F4 | **Fallbacks are implemented but unproven in the UI.** Cards tolerate a missing cache entry, release or tagline in code, but no test renders them | `productView`, `renderProducts` | SH-05 |
| F5 | Release asset and link rules do not check the asset **host** or **size**: any clean http(s) `download_url` passes | `validateCache` | SH-06 |
| F6 | Owner operations are spread over README, LEARNING-GUIDE and RUNBOOK. "Retire or hide a product", "rename a product", and "release Studio itself" have no single page (adding a product does, in README) | grep of docs | SH-07 |
| F7 | A fetch that hangs stalls a section forever (`loadJson` has no timeout) | `loadJson` | SH-08 |

Already solid and **not** to be rebuilt: sync read-only and partial-failure safe (v1.5), URL and cache validators with fixtures, runbook, CSP, health checks, token handling.

## 3. Goals and measures

| Goal | Measure | Target |
|------|---------|--------|
| One section can never take the page down | Sections that, when forced to throw, stop another section or the admin unlock | **0** |
| Rendering is tested in CI | Sections with a browser smoke test | **100%** (Products, Updates, Reads, Podcasts, What's new, profile) |
| Every content file has a contract and a version | Content files with a documented contract and a validator rule | **100%** |
| Missing data degrades, never breaks | Smoke cases with absent cache, release, tagline or whole file that render with a fallback | **all** |
| Owner can operate without guessing | Operations in the guide that have exact commands | add, hide, rename, release, rotate, recover |

## 4. Non-goals

- A framework, bundler or npm dependency (the repo has none and keeps none).
- Remote error reporting or analytics (breaks the no-third-party model; errors go to the console and the page only).
- Offline mode or a service worker.
- Rewriting the renderers; this spec wraps and tests them.
- New user-facing features (those are RC, PC, UX).

## 5. Requirements

Priority: **P0** ships first and gates 2.0; **P1** same release if capacity; **P2** later.

**SH-01 (P0): Section isolation.**
- [ ] Each section renderer runs inside a guard. If it throws, that section shows one plain line ("This section could not load. The rest of the page is unaffected.") and the error goes to `console.error`; all other sections still render.
- [ ] `boot()` always reaches `enableAdmin()` when a token is present, whatever renderers did.
- [ ] A failed JSON fetch or parse for one file affects only the section that uses it (already true for loading; now also for rendering).
- Constraint: no inline handlers, no new global error reporting, CSP unchanged.

**SH-02 (P0): Browser smoke test in CI, dependency-free.**
- [ ] A script serves the repo statically and loads the page in headless Chrome using `--headless --dump-dom` (Chrome is pre-installed on GitHub's `ubuntu-latest`; to be confirmed in the design spike), then asserts on the resulting DOM. No npm package.
- [ ] Cases: healthy content; each section forced to fail (SH-01); cache missing; release missing; a content file missing or malformed; very long text; 375 px and 1280 px viewport widths (via `--window-size`).
- [ ] Runs in `ci.yml` as a separate step; a failure blocks the release process (by PR convention, TR-11).
- Fallback if headless Chrome proves unavailable or unstable: a documented manual checklist plus a Node `vm`-based render test of the pure render functions (design decides).

**SH-03 (P0): Content contract.** `docs/CONTRACT.md` documents every content file (`products`, `cache`, `reads`, `podcasts` once added, `changelog`, `profile`, `blog` archive): purpose, writer (owner, sync or admin), every field with type, required/optional, limits, one valid example and the matching validator rule ids (from `RULES`). A test fails if a file or rule is missing from the document.

**SH-04 (P0): Schema versions.** `content/reads.json` and `content/podcasts.json` carry `"schema_version": <int>`; the validator rejects unknown versions and requires the key once migrated; the runtime tolerates a missing or older version by applying documented defaults (never by crashing). `cache.json`, `products.json` and `changelog.json` stay unversioned (sync-written or stable) unless the contract changes.

**SH-05 (P1): Fallback behaviour proven.** Smoke cases (SH-02) cover: product without cache entry ("details syncing", no stars or language shown), release without matching asset (falls back to release page), missing tagline (uses repo description), empty sections (friendly empty states).

**SH-06 (P1): Asset and release checks.** Validator: asset `size` is a non-negative integer; `download_url` host is `github.com` (release assets resolve there); the version badge text length is bounded. Health already compares tag and asset (v1.5).

**SH-07 (P0): Owner operations guide.** `docs/OPERATIONS.md`: add a product, hide or retire a product (and what happens to its cache entry), rename or recategorise, publish reads and podcasts, release Studio itself (the PR, tag and rollback flow from `docs/build.md`), rotate tokens (link), recover (link to RUNBOOK). Every command shown has been executed once.

**SH-08 (P1): Bounded waits.** Each content fetch has an 8-second timeout (`AbortController`); on timeout the section uses its fallback and the page keeps rendering.

## 6. Security and trust

- No new network destination, secret, dependency or permission; CSP unchanged.
- Error text shown to visitors is a fixed string (never the exception message), so a malformed content file cannot inject text through the error path.
- The smoke server binds to localhost and runs only in CI or on the owner's machine.
- The contract document contains no secrets and no real tokens, only examples.

## 7. Edge cases

| Case | Expected |
|------|----------|
| A renderer throws on one malformed item | Only that section shows the fallback line; admin unlock still works |
| All content files fail to load | Page shell and fallbacks render; products show repo-name cards |
| `reads.json` has an unknown `schema_version` | CI error; runtime shows the Reads fallback line, not a crash |
| Headless Chrome exits non-zero or hangs | CI step fails with the captured output and a 60 s timeout |

## 8. Open questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Is headless Chrome on `ubuntu-latest` acceptable as the one non-Node tool in CI? (Alternative: Node `vm` render test plus manual checklist, weaker) | Owner and design spike | Yes for SH-02 design |
| Q2 | Show visitors a "section unavailable" line (recommended), or hide a failed section silently? | Owner | No |
| Q3 | Should the footer show a small "content version" for debugging? (Recommended: no) | Owner | No |

**Decisions (owner, 2026-10-21):** Q1 yes, headless Chrome in CI (design spike still confirms availability and stability); Q2 yes, show a plain "section unavailable" line; Q3 no content-version line.

## 9. Rollout and phasing

| Phase | Contents | Gate |
|-------|----------|------|
| A (safety) | SH-01, SH-08, SH-02 harness with the existing page as baseline | Existing page passes the new smoke test unchanged |
| B (contract) | SH-03, SH-04, SH-07 | Contract tests green; guide commands executed |
| C (depth) | SH-05, SH-06 | Fallback cases and asset rules proven |

SH Phase A must merge before any RC, PC or UX code.

## 10. Traceability

| Req | PRD ref | Tests (see test.md) | Code or doc touched |
|-----|---------|---------------------|---------------------|
| SH-01 | §10.2 | TC-SH-I01–I05 | `js/app.js` |
| SH-02 | §10.4, §13 | TC-SH-B01–B09 | `scripts/smoke.js`, `.github/workflows/ci.yml`, `tests/` |
| SH-03 | §11 | TC-SH-C01–C03 | `docs/CONTRACT.md`, tests |
| SH-04 | §11 | TC-SH-V01–V04 | `scripts/validate-site.js`, `js/app.js` |
| SH-05 | §9.1, §13.5 | TC-SH-B05–B08 | smoke fixtures |
| SH-06 | §9.3 | TC-SH-A01–A03 | `validate-site.js` |
| SH-07 | §13.6, §19 | TC-SH-D01–D02 | `docs/OPERATIONS.md` |
| SH-08 | §10.1 | TC-SH-T01–T02 | `js/app.js` |

## 11. Status log

- 2026-10-21: Draft created from code findings F1-F7. Awaiting answers to Q1 and approval.
- 2026-10-21: Approved by the owner with the recommended answers; decisions recorded in section 8-9 above.
