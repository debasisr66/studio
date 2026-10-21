# Spec: Product trust and reliability

| | |
|---|---|
| Spec ID | `SPEC-TR` (requirements `TR-01` … `TR-13`) |
| Status | **Draft: awaiting owner approval** (no implementation started) |
| Owner | Debasis Ray |
| Created | 2026-10-21 |
| Parent | [PRD](../../PRD.md) §9.2, §9.6, §10.2, §13 (items 2 and 6), §15.3, Roadmap Phase 2 |
| Siblings | [test.md](test.md) (test plan and traceability) · plan, design, build and security notes are added to this folder when work starts |
| Target | Studio v1.5 (reliability pass) |

## 1. Summary

Studio pulls product metadata and releases from other GitHub repositories, renders them publicly, and lets the owner publish content from the browser. This spec closes the gaps that let **bad or stale data pass quietly**, without adding a backend, a dashboard or a new dependency.

Four goals, each mapped to requirements:

| Goal | Requirements | Gap status found in the repo |
|------|--------------|------------------------------|
| G1 Stronger schema and URL checks | TR-01 … TR-04 | **Real gaps** (see §2) |
| G2 Health coverage: freshness and release parity | TR-05 … TR-08 | **Real gaps** |
| G3 Recovery guidance | TR-09, TR-10 | **Partial**: advice is scattered |
| G4 Branch protection / required CI | TR-11, TR-12 | **Already decided and tested**; this spec records the decision and its revisit triggers |

## 2. Evidence: what exists and what is missing

Checked against `main` on 2026-10-21 (code, not documents).

| # | Finding | Evidence | Maps to |
|---|---------|----------|---------|
| F1 | The URL rule accepts hostile or sloppy input: `" https://a.com"`, `"https://a.com\n"`, `"https://a.\tcom"` and `"https://user:pw@a.com"` all pass `httpUrl` (`new URL()` trims, strips tabs and newlines, and allows credentials) | `scripts/validate-site.js` `httpUrl`; reproduced in Node | TR-01 |
| F2 | `cache.json` is validated per product but its envelope is not: `synced_at` is never checked, `stars` accepts negatives, cached repos no longer in the registry are not flagged | `validateCache` | TR-02 |
| F3 | Registry `slug` uniqueness and `category` vocabulary are not checked | `validateProducts` | TR-03 |
| F4 | Every validator rule lacks a proof that it can fail: tests use inline samples, not a fixture set | `tests/validate-site.test.js` | TR-04 |
| F5 | **A partial sync failure is invisible.** A failing product keeps its old entry and logs a `::warning::`, but the run exits 0 and stays green | `sync-products.js` lines ~101-104 | TR-05 |
| F6 | **Cache age cannot measure freshness.** `synced_at` is rewritten only when data changed ("No changes; cache.json left untouched"), so a perfectly healthy quiet week looks old. A naive "cache older than N days" check would raise false alarms | `sync-products.js` ~106-115 | TR-06 |
| F7 | Release parity compares tags only. A release whose configured download asset is missing or renamed, or a cache entry for a hidden product, passes | `findDrift` | TR-07 |
| F8 | Health output states the problem but not the fix | `health-check.js` output | TR-08 |
| F9 | Recovery advice exists only as table rows and a short runbook inside `LEARNING-GUIDE.md` (Step 9, "Runbook", troubleshooting table); no single page owns it | `docs/LEARNING-GUIDE.md` §204-260 | TR-09, TR-10 |
| F10 | Branch protection: `main` history is protected for everyone; a CI-required ruleset was applied, tested and removed because it blocks the nightly sync and keep-alive bots (GitHub does not accept the Actions app as a bypass on a personal repository). Decision documented | `docs/rulesets/README.md`, REQ-41 | TR-11, TR-12 |

Already working and **not** to be rebuilt: GET-SHA-before-PUT publishing; reads/blog/profile validation in CI; sync is read-only toward product repos; sync keeps prior cache entry when a fetch fails; rate-limit guard; daily health check of site files, tag drift and disabled workflows; keep-alive; pinned actions.

## 3. Problem

Silent failures are the risk: a malformed URL or a half-failed sync produces a site that looks fine and is subtly wrong, and nobody is told. Today the owner would learn of it from a visitor.

## 4. Goals and measures

| Goal | Measure | Target |
|------|---------|--------|
| No silent partial sync | Sync runs with ≥1 failed product that end green | **0** |
| Detect a dead sync | Time from last good sync to a red health run | **≤ 48 h** after the last successful sync run |
| Bad URL never published | Content URLs with whitespace, control characters, credentials or a non-http(s) scheme that pass CI | **0** |
| Every rule can fail | Validator rules without a failing fixture | **0** |
| Owner can self-recover | Health errors that link to a runbook fix | **100%** |
| No regression | Existing tests (102) and CSP/permission checks | all green, no new runtime dependency |

## 5. Non-goals

- Backend, database, accounts, dashboards, analytics or third-party monitoring (against the static, no-third-party model).
- Auto-healing or auto-rewriting content; recovery stays a documented owner action.
- Changing how Pages deploys (see TR-12, deferred).
- Writing to product repositories (sync stays read-only).
- Schema libraries (JSON Schema, Ajv): the repo has no npm step, and hand-written validators stay under test.

## 6. Users

| Persona | Need |
|---------|------|
| Owner / maintainer | Be told when data is wrong or stale; fix it from one page without guessing |
| Visitor | Product cards, versions and downloads that are accurate, or visibly absent, never quietly wrong |
| Contributor (future) | Rules that fail loudly with a clear message |
| Automation (sync, health, keep-alive) | Must keep working: no new blocking policy |

## 7. Requirements

Priority: **P0** = ship with the spec; **P1** = fast follow in the same release if capacity allows; **P2** = designed for, not built. Acceptance is Given/When/Then or checklist; test IDs are in [test.md](test.md).

### G1: Schema and URL checks

**TR-01 (P0): One strict URL rule.** A single shared function decides what a publishable URL is, used for every URL field in `products`, `cache`, `blog`, `reads` and `changelog`.
- [ ] Accepts `http:` and `https:` only.
- [ ] Rejects leading/trailing whitespace, any control character (including tab, CR, LF) anywhere, and embedded `user:password@`.
- [ ] Rejects strings over 2048 characters and an empty host.
- [ ] Error message names the file, entry and field.
- Constraint: `js/reads-lib.js` already normalises URLs for the browser; the CI rule must not weaken that and must not duplicate divergent logic (one source, UMD, as today).

**TR-02 (P0): Cache envelope and values.**
- [ ] `synced_at` required, ISO-8601 UTC, not in the future (tolerance 5 min).
- [ ] `stars` is a non-negative integer; `latest_release.tag` non-empty.
- [ ] A cached repo absent from the registry (or hidden) is a **warning**, not an error (cleanup nudge).
- [ ] A visible registry product with no cache entry stays a warning (today's behaviour; the site has a fallback).

**TR-03 (P1): Registry integrity.**
- [ ] `slug`, when present, is unique and URL-safe (`[a-z0-9-]+`).
- [ ] `category`, when present, is non-empty; an unknown value is a warning listing the known ones.

**TR-04 (P1): Fixture-proven rules.**
- [ ] A `tests/fixtures/` set holds one minimal bad file per validator rule and one good baseline.
- [ ] A test fails if any rule id has no fixture (rules are enumerated, not implied).

### G2: Health coverage

**TR-05 (P0): Partial sync failure is visible.**
- Given one product fetch fails and a prior cache entry exists,
- When the sync finishes,
- Then the prior entry is **kept** (unchanged behaviour), the failure is written to the step summary with the repo and reason, and the run ends **red** after other products have been written and committed.
- [ ] Rate-limit guard trips are reported as such (not as product errors).
- [ ] All-products-failed does not overwrite the cache (kept, red).
- Constraint: the commit step must still run for successful products. The ordering is a design decision (see §12, Q2).

**TR-06 (P0): Freshness = last successful sync run, not cache age.**
- Given `sync.yml` has no successful run in the last **48 h** (configurable constant),
- When the health check runs,
- Then it fails and names the last good run time.
- [ ] Uses the Actions API with the existing `actions: read` permission; no new permission or secret.
- [ ] A quiet week with green nightly runs and an unchanged `synced_at` is **healthy**.
- [ ] If the API is unreachable the check reports a note, not a failure (as for other API reads today).
- Rationale: finding F6. 48 h absorbs the observed late scheduling (03:00 UTC cron ran 07:26-08:24 UTC) plus one missed night.

**TR-07 (P1): Release parity depth.**
- [ ] For a product with `download_asset`, GitHub's latest release must contain an asset matching it, and the cached `download_url` must point at that asset.
- [ ] A cached repo that is hidden or not in the registry is reported (warning).
- [ ] A missing-from-GitHub repo (404) is reported with the repo name, not as a crash.

**TR-08 (P1): Actionable output.** Each health problem line carries a `Fix:` pointer to the matching RUNBOOK section (TR-09).

### G3: Recovery

**TR-09 (P0): One runbook.** `docs/RUNBOOK.md` with a symptom → cause → fix table and the exact commands, covering at least: stale or drifting cache; sync red (partial or total); product release missing; dispatch not firing; GitHub rate limit; scheduled workflow disabled; bad content commit (revert); expired or leaked token; site files 404.
- [ ] Each health/validator message that can occur is listed with its fix.
- [ ] `LEARNING-GUIDE.md` troubleshooting rows link here instead of duplicating.
- [ ] README links to it.

**TR-10 (P1): Safe manual re-sync.** The runbook gives the dry-run-first sequence (`DRY_RUN=true node scripts/sync-products.js`, then `gh workflow run sync.yml`) and states that recovery never overwrites valid cache data except by an explicit full sync the owner starts.

### G4: Protection policy

**TR-11 (P0): Policy recorded as a decision with revisit triggers.**
- [ ] `docs/rulesets/README.md` gains a short **Decision record** (context, decision, consequences, revisit triggers). Decision, as already applied: protect history for everyone; CI gating is a release-process rule (`gh pr checks` green before merge), not a technical lock.
- [ ] Revisit triggers listed: GitHub accepts the Actions app as a ruleset bypass on personal repos; bot commits move to pull requests that trigger CI; the repo moves to an organisation.
- [ ] PRD open question 2 is closed with a link to the record.

**TR-12 (P2): Gate deployment instead of merges.** Deploy Pages from a workflow that runs CI first, which would also stop a bad admin-screen commit from going live. Needs its own spec (bots' pushes do not trigger push workflows). Noted so no design choice here blocks it.

### Cross-cutting

**TR-13 (P0): Nothing else breaks.**
- [ ] Existing 102 tests and CI pass unchanged.
- [ ] CSP, workflow permissions (minimum, pinned) and "sync never writes to product repos" unchanged; `git diff main -- .github` shows only intended workflow edits and no new permissions.
- [ ] No new runtime dependency, no new secret, no third-party request.
- [ ] A hostile or broken `cache.json` still leaves the site rendering with fallbacks (smoke-tested).

## 8. User stories

- As the owner, I get a red run when any product failed to sync, so a stale card is never a surprise (TR-05, TR-06).
- As the owner, I follow one runbook page from the error to the fix, so recovery needs no ad hoc debugging (TR-08, TR-09).
- As the owner, I am stopped by CI before a URL with hidden characters or credentials is published (TR-01).
- As a visitor, I see the correct version and download or a clear fallback, never a quietly outdated card (TR-05, TR-07).
- As a maintainer, I can read why branch protection is set as it is and when to revisit it (TR-11).

## 9. Security and trust

- Validation only tightens; nothing loosens the CSP, URL handling in `reads-lib.js`, or the escape rules.
- Health uses the default read token and the existing `actions: read`; no new secret.
- Sync stays read-only toward product repos; "red after partial success" must not let a failing step skip the safe commit (design to prove this).
- Rejecting embedded credentials also protects against accidentally publishing a secret in a link.
- Recovery steps never ask the owner to paste a token into a file or chat.
- Residual risk accepted: CI cannot technically block the owner or the bots (TR-11).

## 10. Edge cases

| Case | Expected |
|------|----------|
| Quiet week: nothing released, nightly runs green | Healthy (TR-06) |
| Cron delayed by hours | Healthy within 48 h |
| One product repo deleted or renamed | Prior entry kept, run red, named in the summary |
| Rate limit trips mid-sync | Remaining products skipped and reported; prior entries kept |
| All fetches fail | Cache untouched, run red |
| `download_asset` configured, release has no matching asset | Parity warning (TR-07), card falls back to the release page |
| Hidden product still in cache | Warning, not an error |
| GitHub Actions API unreachable during health | Note, not failure |
| Content file has valid JSON but wrong shape | CI error with file, entry and field |

## 11. Dependencies

`scripts/validate-site.js`, `scripts/sync-products.js`, `scripts/health-check.js`, `js/reads-lib.js`, `.github/workflows/{ci,health,sync}.yml`, `docs/rulesets/`, GitHub Actions API (`actions: read`), `gh` CLI for the runbook.

## 12. Open questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Is **48 h** the right freshness limit, or should one missed night alert (≈36 h)? | Owner | No (constant, default 48 h) |
| Q2 | Should a partial sync failure turn the run red **after** committing the good products (recommended), or stay green with a warning issue? Red = an email to the owner today | Owner + design | **Yes** before TR-05 design |
| Q3 | Should embedded-credential URLs in existing content be fixed first? (Current content has none; confirmed by the TR-01 fixture run) | Engineering | No |
| Q4 | Is the 2048-character cap acceptable for reads links with long tracking queries? | Owner | No |

## 13. Rollout, phasing and release notes

| Phase | Contents | Gate |
|-------|----------|------|
| A (docs and validators) | TR-01, TR-02, TR-09, TR-11, TR-13; PRD/doc updates | Unit tests + CI green |
| B (sync and health) | TR-05, TR-06 (needs Q2) | Dry-run and one forced-failure drill on a throwaway branch |
| C (depth) | TR-03, TR-04, TR-07, TR-08, TR-10 | Tests + traceability complete |

Release note: "Studio now refuses hidden-character URLs, turns partial sync failures and a dead sync into visible alerts, and has a single recovery runbook." Process per release stays: impact → plan → design → test-first build → test → security → artefacts → PR with green CI, as in [docs/build.md](../../build.md) §15.

## 14. Traceability of change

How a requirement flows through the documents (the convention for all specs, indexed in [../README.md](../README.md)):

```
PRD section ──► SPEC-TR requirement (TR-nn) ──► test case (TC-TR-nn) ──► code / workflow ──► release docs (REQ-nn in docs/test.md, changelog)
```

| Req | PRD ref | Existing release REQ it extends | Test cases (see test.md) | Code or doc touched |
|-----|---------|--------------------------------|--------------------------|---------------------|
| TR-01 | §9.6 | REQ-32 | TC-TR-U01…U09 | `scripts/validate-site.js`, `js/reads-lib.js` |
| TR-02 | §9.2, §11.2 | REQ-35 | TC-TR-C01…C07 | `validate-site.js` |
| TR-03 | §9.1 | — | TC-TR-R01…R04 | `validate-site.js` |
| TR-04 | §10.4 | — | TC-TR-X01…X02 | `tests/fixtures/`, tests |
| TR-05 | §9.2, §13.2, §15.3 | REQ-39 | TC-TR-S01…S06 | `sync-products.js`, `sync.yml` |
| TR-06 | §10.2, §13.2 | REQ-39 | TC-TR-H01…H05 | `health-check.js` |
| TR-07 | §9.3 | REQ-39 | TC-TR-H06…H09 | `health-check.js` |
| TR-08 | §13.6 | — | TC-TR-H10 | `health-check.js` |
| TR-09 | §13.6, §19.4 | — | TC-TR-D01…D03 | `docs/RUNBOOK.md`, `LEARNING-GUIDE.md`, README |
| TR-10 | §13.6 | — | TC-TR-D04 | `docs/RUNBOOK.md` |
| TR-11 | §17, §18 Q2 | REQ-41 | TC-TR-D05…D06 | `docs/rulesets/README.md`, PRD |
| TR-12 | §16 | — | none (P2, separate spec) | — |
| TR-13 | §10, §14 | REQ-42 | TC-TR-N01…N05 | all |

On release, the matching `REQ-44…` rows are added to `docs/test.md`, `docs/security.md` gets a v1.5 log, and `content/changelog.json` gets the user-facing note.

## 15. Status log

- 2026-10-21: First draft (generic) created.
- 2026-10-21: Revised against the code: findings F1-F10, requirement IDs, traceability, decision record for G4. Awaiting owner answers to Q2 (blocking) and approval.
