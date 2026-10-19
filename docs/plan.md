# Plan — Studio

Status key: ✅ done · ⏳ pending · 🔒 needs owner · Releases: **v1.2 (shipped 2026-10-19, tag `v1.2`)**, v1.1 (shipped 2026-10-19, tag `v1.1`)

---

# v1.2 — Guardrails (no new features)

Date: 2026-10-19 · Branch: `release/v1.2` (merged) · Rollback tag: `v1.1`

## Why

The v1.1 rating put reliability and testing at the bottom (6 and 5.5 of 10). The tests and the "protected files unchanged" check only run when someone runs them, and a failed sync or broken content file would go unnoticed. v1.2 adds a safety net and removes noise. **No visitor-facing feature is added.**

## Scope

| # | Item | Type |
|---|------|------|
| G1 | **CI check on every push and pull request**: unit tests plus site validation, read-only (`contents: read`) | Guardrail |
| G2 | **Content and site validator** (`scripts/validate-site.js`): schema checks for products, cache, blog and reads; safe URLs; referenced files exist; CSP present; no inline scripts; size budget; JS syntax | Guardrail |
| G3 | **Daily health check** (`health.yml` + `scripts/health-check.js`): the live site answers; every product's latest GitHub release matches what the cache says (detects a broken sync or dispatch). A failure turns the run red and triggers GitHub's failed-workflow email | Alerting |
| G4 | **Fix cache churn (rating item 4)**: `pushed_at` is stored as a date, so a Penny push no longer rewrites `cache.json` several times a day | Fix |
| G4b | Date display fix that G4 requires: date-only values are shown as the same calendar day in every timezone (`formatDate`, one line in `js/app.js`) | Fix |
| G5 | Update every artefact: plan, impact, design, test (traceability), build, model-use, architecture, learning guide, README | Docs |

## Out of scope

New site features, UI changes, changes to Penny or debasis-web, replacing tokens, a staging environment, automatic rollbacks, paid monitoring services.

## Safety approach ("nothing breaks")

- New work lives on `release/v1.2`; Pages deploys only from `main`.
- **`index.html` is unchanged and the page looks the same.** The only runtime edit is the date formatter (G4b): one line in `js/app.js` plus a tested helper in `js/reads-lib.js`. The only data change is `content/cache.json` (one-time format change of `pushed_at` from timestamp to date; the page already formats it as a date).
- Workflows are additive and read-only: `ci.yml` and `health.yml` use `permissions: contents: read` and no secrets. `sync.yml` is not modified.
- `scripts/sync-products.js` gets a small refactor so its logic can be unit tested; behavior is unchanged except G4. Verified by a dry run and a real local run before merge.
- Honest limits: pushes made by the sync bot do not trigger CI (GitHub does not run workflows for `GITHUB_TOKEN` pushes), so cache commits are covered by the daily health check instead. An expiring dispatch token is not detectable from the hub; the calendar reminder remains.

## Phases

| Phase | Work | Gate | Status |
|-------|------|------|--------|
| 0 | Branch `release/v1.2` from current `main` | Clean tree | ✅ |
| 1 | This plan | Reviewed | ✅ |
| 2 | `scripts/validate-site.js` + unit tests (good and bad fixtures) | Tests pass; validator passes on the real repo | ✅ 15 tests; real repo OK; broken copy rejected |
| 3 | Refactor `sync-products.js` for testability + G4/G4b; unit tests | Tests pass; dry run and local run behave as before | ✅ 6 tests; two real runs (migrate, then no-op) |
| 4 | `scripts/health-check.js` | Passes against the live site | ✅ 5 tests; healthy live; wrong URL and stale cache both fail |
| 5 | `.github/workflows/ci.yml` and `health.yml` | YAML valid; trigger manually after merge | ✅ YAML valid, read-only; ⏳ first GitHub runs after merge |
| 6 | Update all artefacts (G5) | Traceability matrix extended | ✅ |
| 7 | Verify locally, show diff summary, **owner approves merge** | Protected paths diff reviewed | ✅ approved |
| 8 | Merge, push, confirm CI and health runs are green, tag `v1.2` | Live smoke checklist | ✅ merge `a7e81db`; CI, Pages, health and sync dry run green |

## Acceptance criteria

- B1: `node --test tests/*.test.js` and `node scripts/validate-site.js` pass locally and in CI.
- B2: The validator catches each of: malformed JSON, `javascript:` URL in reads, duplicate product repo, missing referenced script, inline script, missing CSP, size over budget (proved by unit tests).
- B3: The health check fails when a cached release tag differs from GitHub's latest, and passes when they match.
- B4: A simulated "Penny pushed again the same day" run reports no change and makes no commit.
- B5: `index.html` is byte-identical to `v1.1`; the only JS changes are the tested `formatDate` helper and its one-line use; the live site is visually unchanged.
- B8: A date-only value displays as the same calendar day under UTC, America/Los_Angeles, Asia/Kolkata and Pacific/Kiritimati.
- B6: `sync.yml` is unchanged; a dry run still passes.
- B7: All artefacts reference v1.2 and agree with each other.

## Risks

| ID | Risk | Mitigation |
|----|------|------------|
| P1 | CI is red on day one because of a validator bug | Run on the real repo and fixtures before merge; fix forward on the branch |
| P2 | Health check false alarm just after a release | Runs once daily, hours after the nightly sync; the dispatch normally fixes drift within minutes |
| P3 | Email alerts are off in the owner's GitHub settings | Document how to enable "failed workflows only" notifications and a `gh run list --status failure` fallback |
| P4 | Refactor of `sync-products.js` changes behavior | Unit tests plus dry-run and local-run comparison; `sync.yml` untouched |

---

# v1.1 — HCI polish, branding, LinkedIn-style Reads (shipped)

Date: 2026-10-19 · Owner: Debasis Ray


## Goals

1. HCI-guideline UI (see [design.md](design.md)).
2. Branding: **Studio by Debasis Ray — learning never ends!**
3. Reads: add and share links like a LinkedIn post (owner-only, no backend, no third-party services).
4. Meet non-functional and security requirements, and **break nothing**: Penny, debasis-web and the sync pipeline run as before.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Who can add | Owner only, via the admin token | No new backend or abuse surface |
| Link preview | Manual title and comment | No third party sees what you read |
| Sharing out | LinkedIn share link, Copy link, native share sheet | Covers desktop and phone with no SDKs |
| Delivery | Branch `v1.1`, tag `v1.0` as rollback | Pages deploys only from `main` |

## Phases

| Phase | Work | Gate | Status |
|-------|------|------|--------|
| 0. Safety net | `git pull --rebase`; tag `v1.0`; branch `v1.1` | Tag pushed | ✅ |
| 1. Library (test first) | `js/reads-lib.js` + `tests/reads-lib.test.js` | 16/16 tests pass | ✅ |
| 2. UI | Branding, HCI pass, composer, cards, filters, share, CSP; script extracted to `js/app.js` | Loads with zero console errors and zero CSP violations | ✅ |
| 3. Verification | Browser checks at 375, 768 and desktop; XSS payloads; accessibility audit; regression on protected files | All pass (see [test.md](test.md)) | ✅ |
| 4. Docs | impact, plan, design, test, build, model-use | Reviewed | ✅ |
| 5. Merge and deploy | Merge `v1.1` to `main`, push, check Pages | Owner approval; Pages build success | ✅ (`c5b3d0f`) |
| 6. Live smoke test | Live URL, product cards, Penny and debasis-web links, nightly sync dry run | Checklist in [test.md](test.md) §6 | ✅ |
| 7. First real publish | Add one read as admin and publish | Needs owner's token | ✅ (`9acca43`) |
| 8. Tag | Tag `v1.1` | After phase 7 passes | ✅ |

## Acceptance criteria

- A1: Title, header, hero and footer carry the new branding.
- A2: Owner can post, edit and delete a read; visitors cannot see or use the composer.
- A3: Reads can be filtered by tag and searched; each card has LinkedIn share and Copy link (plus native share where supported).
- A4: Existing reads (`{title, url, note}`) still display.
- A5: `git diff main` is empty for `.github/`, `scripts/`, `content/products.json`, `content/blog.json`.
- A6: Sync dry run still passes; Penny and debasis-web links still work.
- A7: Zero CSP violations; hostile input in title, comment, tags and URL renders as inert text.
- A8: No horizontal scroll at 375 px; keyboard-only operation works end to end.

## Out of scope

Public submissions, link-preview services, comments or likes, analytics, a backend, changes to Penny or debasis-web, replacing Google Fonts.

## Next candidates (not committed)

Reading-list RSS feed; export reads as Markdown; an admin token validity check on load; self-hosting fonts to remove the last third-party request.

## Checklist for the merge step

- [x] Owner approves merge
- [x] `git checkout main && git pull --rebase && git merge --no-ff v1.1`
- [x] `git push` and confirm `gh run list` shows Pages success
- [x] Run the live smoke checklist
- [x] Add one read with the admin token; confirm it appears after the Pages rebuild
- [x] `git tag v1.1 && git push origin v1.1`
