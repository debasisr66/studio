# Impact Analysis — Studio

Releases: **v2.0 (in progress)** · **v1.6 (intermediate, 2026-10-22)** · v1.5 (shipped 2026-10-21) · v1.4 (shipped 2026-10-20) · v1.3 (shipped) · v1.2 (shipped) · v1.1 (shipped)

---

# v2.0 — Studio 2.0 (in progress): stabilise, Reads split, Podcasts, simpler layout

Date: 2026-10-21 · Rollback tag: `v1.5` · Specs: [SPEC-SH](specs/stabilize-core-hub/spec.md), [SPEC-RC](specs/reads-categories/spec.md), [SPEC-PC](specs/podcast-links/spec.md), [SPEC-UX](specs/simple-layout/spec.md) · PRD: §22 · Order of work: **PRD → specs → impact (this) → plan → design → build → test → security → artefacts**

## 1. Change summary

| # | Change | Spec | Type |
|---|--------|------|------|
| S1 | Section isolation, bounded fetch waits | SH-01, SH-08 | Stability |
| S2 | Dependency-free browser smoke test in CI (headless Chrome) | SH-02, SH-05 | Test coverage |
| S3 | Content contract document and `schema_version` on changed files | SH-03, SH-04 | Contract |
| S4 | Asset host and size rules; owner operations guide | SH-06, SH-07 | Validation, docs |
| R1 | Reads: `category` (technical or other) on every read and book; two sub-items with deep links; migration | RC-01 … RC-08 | Feature, data |
| P1 | Podcasts replace Blog: new `podcasts.json`, section, composer, validators; `#blog` redirect; blog archived | PC-01 … PC-07 | Feature, retirement |
| U1 | One fixed order (Products, Updates, Reads, Podcasts), one section pattern, matching navs, stable links | UX-01 … UX-04 | Layout |
| U2 | Accessibility and first-screen clarity pass | UX-05, UX-06 | Quality |

## 2. What is touched and what is not

| Component | Touched? | Notes |
|-----------|----------|-------|
| `index.html` | **Yes, heavily** | Blog section, nav and bottom nav replaced; Reads markup reworked; footer reset note |
| `css/site.css` | Yes | Tabs, podcast cards, section pattern; within the size budget (now 18.6 of 30 KB) |
| `js/app.js` | **Yes, heavily** | Isolation guard, Reads tabs, podcasts renderer and editor, hash routing, layout order; now 37 of 80 KB |
| `js/reads-lib.js` | Yes | `categoryOf`, filters by category, platform labels; stays pure and tested |
| `content/reads.json` | **Yes (migration)** | Adds `category` and `schema_version`; ids, urls, titles, comments, tags unchanged |
| `content/podcasts.json` | **New** | Empty or seeded by the owner |
| `content/blog.json` | Kept, no longer loaded | Archive (zero posts); still validated and served |
| `scripts/validate-site.js`, `tests/fixtures/`, `docs/RUNBOOK.md` | Yes | New rules (category, schema version, podcast rules, asset host/size), each with a fixture and runbook row |
| `scripts/smoke.js`, `.github/workflows/ci.yml` | New step | Only workflow edit: a smoke-test step in `ci.yml`; permissions unchanged |
| `scripts/health-check.js` | Minor | Still checks `blog.json` is served; add `podcasts.json` |
| `scripts/sync-products.js`, `sync.yml`, `keepalive.yml`, products, cache, profile, changelog (data except new entry) | **No** | The sync and the Penny/debasis-web flow are untouched |
| Product repos (Penny, debasis-web) | **No** | Studio only reads them |
| CSP | **No** | Same policy; no new host, no inline code |

## 3. Blast radius and what could break

| Area | Risk if wrong | Mitigation |
|------|---------------|-----------|
| Products grid and Updates (the core) | Regression from heavy `app.js` edits | SH smoke test lands first and runs on every later change; visual comparison against the frozen v1.5 build as in earlier releases |
| Old links and bookmarks (`#blog`, `#reads`) | Dead links | Redirects and deep-link tests (PC-05, UX-04) |
| Reads data | Lost or mislabelled reads | Migration test compares before and after; owner confirms classification; additive keys so v1.5 code still renders it |
| Admin publishing | Publishing path breaks for reads or podcasts | Stubbed-API publish tests plus one real owner publish per release (as TC-TR-N04) |
| Navs disagree or a section loses its anchor | Confusing or dead links | Both navs generated from one list; anchor and nav tests in the smoke test (UX-03, UX-04) |
| `app.js` growth | Slower or harder to maintain | New logic goes in small pure modules; budgets enforced in CI |
| CI becomes flaky | Smoke test blocks merges | 60 s timeout; deterministic content; fallback checklist if Chrome proves unstable (SH Q1) |
| Visitors' habits | Blog readers (none today) lose a section | Blog archive kept; changelog explains the change |

## 4. Data compatibility

| File | Change | Old code (v1.5) on new data | New code on old data |
|------|--------|-----------------------------|----------------------|
| `reads.json` | + `category`, + `schema_version` | Ignores extra keys | Missing category → "Others" at runtime (CI rejects it) |
| `podcasts.json` | New | Ignored | Missing file → section fallback |
| `blog.json` | Unchanged, unrendered | Still renders (rollback works) | Not loaded |

## 5. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|------------|--------|-----------|--------|
| V3 | Headless Chrome unavailable in CI | Low | Medium | Spike first; documented fallback | Open: spike |
| V4 | Scope: four specs in one release | Medium | Medium | Phase gates; UX Phase A can ship alone; SH first | Planned |
| V5 | `podcast` kind in Reads overlaps the new section | Medium | Low | Stop offering it; keep accepting it | Specified (PC-06) |
| V6 | Old shared `#blog` links | Low | Low | Redirect | Specified |

## 6. Rollback

Tag `v1.5` is the rollback point. Because content changes are additive, `git revert` of the 2.0 merge restores the previous site and it renders the migrated `reads.json` correctly; `blog.json` is intact. The stored layout key is ignored by old code. Health and CI keep running throughout (no workflow permission changes).

## 6b. Addendum: SPEC-QA, Quick add (2026-10-23)

Added by the owner after RC and PC Phase B went live: [SPEC-QA](specs/quick-add/spec.md), planned before SPEC-UX Phase A. Scenario: the owner copies an article's link by instinct; one tap opens a box that takes it; the token is asked for only when posting; the admin locks itself after a successful publish.

| Area | Change | Risk | Mitigation |
|------|--------|------|------------|
| `index.html` | One new dialog (Add to Studio); the token prompt becomes a form with a username field and an autofill-friendly password field | Markup mistakes break the existing prompt or composers | Existing composers untouched; smoke cases cover prompt, sheet, both composers |
| `js/app.js` (about +4 KB of the 80 KB budget) | Sheet logic, just-in-time unlock, post-and-publish, auto-lock, `#add` routing (`#add=` was dropped with QA-09), draft key | The most sensitive code in the site: unlock, publish, lock | Tests first, shared validators and the guarded publish reused (no copy of any rule); independent review for both phases (G4, G5) |
| `js/reads-lib.js` | Pure helpers: `extractLink`, `extractTitle`, `suggestKind`, `parseAddFragment` (dropped with QA-09) | Parsing untrusted pasted text and fragments | Unit tests on hostile and oversized inputs; every value ends in the existing `normalizeUrl` and validators |
| `js/token-store.js`, `lock()` | Lock after every successful publish | A lock that fires too early or never | Success path only; failure keeps the session and the draft; tests for both |
| Storage | One new **owner-only** `sessionStorage` key for the in-progress draft (no token in it); the PRD target "no new storage key" is amended to "no storage about visitors; one owner-only draft key" | A reviewer or visitor sees the draft key as "tracking" | Written only after the owner uses the sheet; never for visitors; cleared on success and Cancel; test that a visitor session has no such key |
| Clipboard | Read only on a tap of **Paste from clipboard** | Silent clipboard reads | Not read on load or open (test counts calls); browser prompts apply |
| Content files, validators, CI, workflows, CSP, fonts | Unchanged | none | `git diff main -- .github content` shows nothing |
| Docs | New spec and test plan, plan, design §12.10, security §11.11, review gate, PRD §22, OPERATIONS and LEARNING-GUIDE recipes (written at build time) | Drift | Doc tests (`TC-QA-H03`, `TC-QA-F06`), CONTRACT unaffected |

**Data and compatibility:** none. No content file, schema or rule changes; the existing composers and the publish guards keep working, so old data and old pages are unaffected.

**Rollback:** revert the merge commit of the phase (SPEC-QA is additive); nothing to migrate back.

**Risk register (QA):**

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|------------|--------|------------|--------|
| Q1 | One-tap token fill does not appear in **Chrome on the owner's iPhone** even after the prompt becomes a real login form | Medium | Low (convenience only) | Owner device check O01; add the token to the password manager by hand (username `studio-admin`); fallback is to paste the token after the link is posted (the clipboard is free by then) | Open until O01 |
| Q7 | The Home Screen icon opens in Safari, or drops `#add`, instead of Chrome | Medium | Low | Chrome as default browser; fallbacks: a Chrome bookmark, or a Shortcut with `googlechromes://`; checks O04, O07 | Open until O04 |
| Q2 | Auto-lock after publish forces a new token entry for the next item | High | Low | Intended (security first); autofill makes it one tap; owner agreed | Accepted |
| Q3 | iOS discards the tab while the owner fetches the token | Medium | Medium (draft lost) | Draft key (QA-07); the link is usually still on the clipboard | Mitigated |
| Q4 | A crafted `#add=` link prefills something misleading | Low | Low | Prefill only, banner, validation, never auto-submit, the owner must press Post and give the token | Not applicable: QA-09 dropped 2026-10-23 |
| Q5 | The sheet becomes a second, divergent add path | Medium | Medium | Reuses the same validators and publish flow; parity test TC-QA-K05; SPEC-UX decides whether to keep the old composers | Mitigated |
| Q6 | A bug in lock or unlock leaves the admin open or locks mid-publish | Low | High | Tests for success and failure paths; independent review G4 | Open until review |

## 7. Out of scope for 2.0

Analytics, usage tracking or ordering sections by use (dropped by the owner on 2026-10-21), embedded audio, RSS or platform lookups, a third Reads sub-item, owner-configurable section order, a rewrite of the renderers.

---

# v1.4 — Self-hosted fonts, protected main, keep-alive, profile photo, logo

Date: 2026-10-20 · Rollback tag: `v1.3` · Order of work: **impact → plan → design → build → test → security checks → update artefacts**

## 1. Change summary

| # | Change | Type |
|---|--------|------|
| U1 | **Self-host the fonts** (Inter, JetBrains Mono): `fonts/*.woff2` with their licences; Google Fonts removed from the page and the CSP | Privacy, performance, hardening |
| U2 | **Branch protection** on `main`: a *history* ruleset (no deletion, no force-push, for everyone) is applied. A *CI-required* ruleset was built and tested but **not kept**: it blocks the sync and keep-alive bots | Process control |
| U3 | **Keep-alive** (`keepalive.yml` + `scripts/keepalive.js`): if `main` has had no commit for 30 days, add one empty commit so GitHub does not disable the scheduled workflows; the health check also fails if any workflow is disabled | Reliability |
| U4 | **Pin Actions by commit hash** in all workflows; **Dependabot** proposes weekly updates | Supply-chain hardening |
| U5 | Health check moved to **12:00 UTC**: observed scheduled runs start 4–5 hours late (the 03:00 sync ran at 07:26–08:24 UTC), so 06:00 could precede the sync | Fix |
| U6 | Admin **idle lock** logic moved into the tested module (it was the one untested piece of the session code) | Test coverage |
| P1 | **Profile photo**: the owner uploads a photo in the admin screen; it is cropped square, resized to 512 px, re-encoded as JPEG (metadata removed) and published to `content/profile.jpg`; the home page shows it, with a monogram when none exists | Feature |
| L1 | **Studio logo** (abstract "Lattice Ascent", option 2 chosen by the owner) as the header mark and the favicon; the other two concepts are kept in `docs/brand/` | Brand |
| W1 | Changelog entry v1.4 (visible in **What's new**) and all artefacts updated | Docs |

## 2. What is touched and what is not

| Component | Touched? | Notes |
|-----------|----------|-------|
| `index.html`, `css/site.css` | Yes | Fonts, header logo, hero photo area, favicon, preload |
| `fonts/` | New | Two variable `woff2` files and two licence files |
| `assets/logo.svg` | New | The chosen logo |
| `js/app.js` | Yes | Profile upload and display, binary publish, idle-lock use |
| `js/token-store.js` | Yes | Adds the idle-lock helper (still dependency-free) |
| `js/image-lib.js` | New | Pure, unit-tested image rules (type, size, crop, quality steps) |
| `scripts/validate-site.js`, `health-check.js` | Yes | Font and third-party rules, profile image rules, workflow-state check |
| `scripts/keepalive.js` | New | Decision logic, unit-tested |
| `.github/workflows/ci.yml`, `health.yml` | Yes | Pinned actions; health: later schedule and `actions: read` |
| `.github/workflows/sync.yml` | **Yes, one line per action** | Only the pinned action hashes; permissions, triggers and steps unchanged; proved by a dry run on GitHub |
| `.github/workflows/keepalive.yml`, `.github/dependabot.yml` | New | Keep-alive is the only new workflow with `contents: write` |
| Repository settings | Yes | Two rulesets on `main` (applied last, tested, with a one-command rollback) |
| `content/products.json`, `blog.json`, `reads.json`, `cache.json` | No | |
| `content/profile.jpg` | New (after the owner uploads) | Created by the admin screen, not by this release |
| Penny and debasis-web repos, notify workflow, tokens, secrets | No | |

## 3. Data and storage compatibility

- No change to any JSON schema. The only new data file is the optional `content/profile.jpg`; the page works without it.
- No new browser storage keys.
- Fonts: if a font file ever fails to load, the page falls back to system fonts (layout shifts slightly, nothing breaks).

## 4. Blast radius

- **Visitors:** the same page with a logo, optionally a photo at the top, and fonts from the same address. Net privacy gain: Google no longer sees visits.
- **Owner:** a new **Change photo** control appears in admin. Publishing already works the same way. The rulesets must not block the admin screen or the nightly sync (see X2).
- **Pipeline:** `sync.yml` is edited (hash pinning only). A mistake here would stop the sync, so it is verified on GitHub before the change is relied on.
- **Repository process:** after the rulesets, release changes go through a pull request and wait for CI.

## 5. Risk register (v1.4)

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|-----------|--------|
| X1 | Self-hosted fonts render differently from Google's | Low | Medium | Same font files; computed-style comparison against v1.3 | **Materialised and closed**: Latin-only changed the rupee sign; both subsets now hosted; 24 cases, 0 differences; CI guards coverage |
| X2 | A ruleset blocks the admin screen's commits or the sync bot's commits | Medium | High | Applied only after merge; tested straight away; one-command rollback | **Materialised and handled**: the CI-required ruleset did block the bots (`Required status check "check" is expected`); removed within minutes, before any scheduled run; only the history ruleset remains; bot and admin paths re-tested OK |
| X3 | CI cannot technically block the owner's merges or the bots' direct pushes | Certain | Low | Honest limit, documented. History cannot be rewritten or deleted by anyone; CI gates the normal path **by process** (pull request, merge only when green) | Accepted |
| X4 | Keep-alive adds clutter or permissions | Low | Low | At most one empty commit per 30 days; `contents: write` only in that workflow; decision logic unit-tested | Mitigated |
| X5 | Pinned hashes go stale | Medium | Low | Dependabot weekly pull requests | Mitigated |
| X6 | Editing `sync.yml` breaks the sync | Low | High | Pin only (diff is one line); verified hash; dry run on GitHub after merge | Open until the GitHub dry run |
| X7 | A malicious or huge image is uploaded | Low | Medium | Owner-only; PNG, JPEG, WebP only (no SVG); decoded and re-encoded; size and pixel limits; CI validates `profile.jpg` | **Closed** (TC-P05, TC-V25) |
| X8 | Photo reveals location or device metadata | Medium | Medium | Re-encoding through a canvas drops all metadata; documented | Mitigated by design |
| X9 | A changed photo shows stale for a few minutes | High | Low | The manifest's timestamp is part of the photo URL, so a new photo is a new URL | **Closed** (design improved) |
| X10 | Scheduled-run delays cause false alarms | Medium | Low | Health moved to 12:00 UTC; delays documented | Mitigated |
| X11 | Logo unreadable at favicon size | Low | Low | Checked at 128, 32 and 16 px | Closed with a note: at 16 px the grid blurs but the amber cell and tile remain |

| X12 | An editing slip leaves the page unstyled | Low | High | CI rule requires the colour tokens and light theme; the visual comparison caught the slip before anything was deployed | Closed (TC-V28) |
| X13 | The header overflows at widths nobody tested (**live v1.3 does**, 621 to 640 px) | Medium | Low | Fixed; a 26-width sweep is now part of testing | Closed (TC-E01) |

## 6. Rollback

```bash
# the history ruleset (only if it ever has to go):
gh api repos/debasisr66/studio/rulesets --jq '.[]|"\(.id) \(.name)"'
gh api -X DELETE repos/debasisr66/studio/rulesets/<id>

# then the release itself:
git revert -m 1 <v1.4-merge-commit> && git push
```

No data migration: a v1.3 page ignores `content/profile.jpg` and the new files.

---

# v1.3 — Safer admin session, version tracking, What's new

Date: 2026-10-19 · Rollback tag: `v1.2` · Step 1 of 6 in the agreed order: **impact → plan → design → build → test → security checks → update**

## 1. Change summary

| # | Change | Type |
|---|--------|------|
| H1 | Admin token moves from `localStorage` to `sessionStorage`: it is forgotten when the tab closes. Any token left in `localStorage` by earlier versions is deleted on load. If the browser blocks `sessionStorage`, the token lives in memory only | Security hardening |
| H2 | Fully strict CSP: the stylesheet moves from an inline `<style>` to `css/site.css`, every inline `style=` attribute is replaced by classes, so `style-src` no longer needs `'unsafe-inline'` | Security hardening (refactor) |
| V1 | The current version is shown in the footer, read from one source (`content/changelog.json`) | Feature |
| V2 | A **What's new** button (header) and the footer version open a dialog listing releases in plain language; a dot marks unseen updates | Feature |
| V3 | `content/changelog.json` plus validator rules and unit tests | Data + guardrail |
| S1 | New `docs/security.md` (threat model and review log); all artefacts updated | Docs |

## 2. What is touched and what is not

| Component | Touched? | Notes |
|-----------|----------|-------|
| `index.html` | **Yes** (largest change since v1.1) | CSS removed from the file, inline styles removed, What's new button, footer version |
| `css/site.css` | New | The stylesheet, moved verbatim except for classes replacing inline styles |
| `js/app.js` | Yes | Token store, What's new, dynamic styling through script instead of attributes |
| `js/reads-lib.js` | No | Unchanged in v1.3 |
| `js/token-store.js` | New | Admin token storage, extracted so it can be unit-tested |
| `content/changelog.json` | New | Owner-maintained release notes |
| `scripts/validate-site.js` + tests | Yes | New rules: strict style CSP, no inline `<style>` or `style=`, changelog schema, stylesheet in the size budget |
| `.github/workflows/*` | **No** | CI runs the new rules automatically |
| `scripts/sync-products.js`, `health-check.js` | No | |
| `content/products.json`, `blog.json`, `reads.json`, `cache.json` | No | |
| Penny and debasis-web repos, notify workflow, tokens, secrets | No | |

## 3. Data and storage compatibility

| Item | Before | After |
|------|--------|-------|
| Admin token | `localStorage['studio-admin-pat']` | `sessionStorage['studio-admin-pat']` (per tab); legacy `localStorage` copy deleted on load |
| Last version seen | n/a | `localStorage['studio-seen-version']` (not secret; a per-viewer convenience) |
| Theme | `localStorage['studio-theme']` | unchanged |
| Content JSON schemas | | unchanged; `changelog.json` is new |

## 4. Blast radius

- **Visitors:** a new header button and a footer version; the page must look otherwise identical. The CSS refactor is the one change that can alter appearance for everyone, so it is proven by an element-by-element computed-style comparison against v1.2 at three widths in both themes (see test plan), not by eye alone.
- **Owner:** must re-enter the admin token once after this release (the old stored token is deliberately discarded), and again in every new tab or after closing the tab. This is the intended behavior change.
- **Other apps and pipeline:** none. Sync, health, notify, Penny and debasis-web are untouched.
- **If the stylesheet fails to load:** the page would show unstyled content (it used to be inline). Same host and same deploy as `index.html`, so a partial deploy is the only realistic cause; the health check fetches the key files daily.

## 5. Risk register (v1.3)

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|-----------|--------|
| W1 | CSS extraction changes how something looks | Medium | Medium | Computed-style diff against v1.2 (3 widths × 2 themes × 4 states) | **Closed**: 0 differences after the extraction; final differences only in header, footer and one dialog paragraph (test.md TC-V02, V03) |
| W2 | A dynamic value (avatar colour, language dot) breaks because inline styles are blocked | Medium | Low | Applied through script (allowed by CSP) from data attributes | **Closed**: all painted, no violations (TC-S10) |
| W3 | Stricter CSP blocks something unexpected | Low | High | Zero-violation checks on every flow, including admin flows with a stubbed GitHub response | **Closed** (TC-S09, TC-K11) |
| W4 | Owner is surprised to be signed out | High | Low | Stated in the release notes, the unlock dialog and the learning guide | Accepted |
| W5 | Token in a tab is still readable by script that runs on this origin | Low | High | Unchanged by design (static site, no backend). Strict CSP with no inline script or style is the mitigation; residual risk documented in `security.md` | Accepted |
| W6 | Changelog forgotten at release time | Medium | Low | Release checklist step in `build.md`; validator checks the file's shape, not freshness | Accepted |
| W7 | "New" dot becomes noise | Low | Low | Cleared once the dialog is opened; no dot if storage is unavailable | Mitigated by design |
| W8 | A changelog entry carries markup or a hostile link | Low | Medium | Text only, always escaped; no links allowed in entries; validator enforces length and type | Mitigated and tested (TC-S11) |
| W9 | A new accessibility gap in the added controls | Medium | Medium | Read the browser's accessibility tree for every new control | Found and fixed one (DEF-07: unnamed header button on phones) |

## 6. Rollback

```bash
git revert -m 1 <v1.3-merge-commit> && git push
```

No data migration. The v1.2 page cannot read `sessionStorage` tokens, so after a rollback the owner simply unlocks again.

---

# v1.2 — Guardrails

Date: 2026-10-19 · Rollback tag: `v1.1`

## 1. Change summary

| # | Change | Type |
|---|--------|------|
| G1 | `ci.yml`: unit tests + site validation on every push and pull request (read-only) | New workflow |
| G2 | `scripts/validate-site.js`: schema, URL-safety, CSP, inline-script, referenced-file, size-budget and JS-syntax checks | New script |
| G3 | `health.yml` + `scripts/health-check.js`: daily check that the live site answers and the cache matches each product's latest GitHub release | New workflow + script |
| G4 | `scripts/sync-products.js`: logic split into testable functions; `pushed_at` stored as a date, which ends the repeated cache commits | Refactor + fix |
| G5 | `formatDate` moved into `js/reads-lib.js` and used by the page: date-only values are shown as the same calendar day in every timezone (needed by G4; also fixes blog and read dates for visitors west of Greenwich) | Fix |
| G6 | Artefacts updated | Docs |

Since the v1.1 tag, `main` also carries the already-live `download_asset` registry option (choose the release file behind the Download button).

## 2. What is touched and what is not

| Component | Touched? | Notes |
|-----------|----------|-------|
| `index.html` | **No** | Byte-identical to v1.1 |
| `js/app.js` | One line | `fmtDate` now points at `RL.formatDate` |
| `js/reads-lib.js` | Additive | New `formatDate` |
| `scripts/sync-products.js` | Yes | Refactor + `pushed_at` to day; same outputs otherwise (verified by two real local runs: first migrates, second is a no-op) |
| `scripts/validate-site.js`, `scripts/health-check.js` | New | Read-only |
| `.github/workflows/ci.yml`, `health.yml` | New | `permissions: contents: read`, no secrets |
| `.github/workflows/sync.yml` | **No** | Verified by diff |
| `content/cache.json` | One-time | `pushed_at` changes from timestamp to date (`2026-10-19T07:56:02Z` → `2026-10-19`) |
| `content/products.json`, `blog.json`, `reads.json` | No | |
| Penny and debasis-web repos, notify workflow | No | |
| Tokens and secrets | No | The new workflows use only the automatic read-only `GITHUB_TOKEN` |

## 3. Data compatibility

- Page code (v1.1) formats `pushed_at` as a date, so a date-only value renders correctly even without G5; G5 only removes a one-day shift for western timezones.
- Rolling back to v1.1 against the new cache format is safe for the same reason. Rolling forward again needs no migration.

## 4. Blast radius

- **Visitors:** pages look the same. The only visible effect is that dates stay correct in every timezone.
- **Operations:** the new workflows can only turn a run red and send GitHub's failed-workflow notification. They never write to the repository, never gate a merge (branch protection is not enabled), and cannot block publishing.
- **Sync pipeline:** unchanged trigger, schedule and permissions; commits become less frequent.
- **Cost:** a few seconds of runner time per push and per day, free on a public repository.

## 5. Risk register (v1.2)

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|-----------|--------|
| V1 | CI red on day one from a validator bug | Low | Low (alert only) | Ran on the real repo, on fixtures, and on a deliberately broken copy | Mitigated |
| V2 | Health check false alarm just after a release | Low | Low | Runs 3 hours after the nightly sync; dispatch normally syncs within minutes | Accepted |
| V3 | Failure emails switched off in the owner's GitHub account | Medium | Medium | Learning guide shows how to enable "failed workflows only"; `gh run list --status failure` as a fallback | Open (owner action) |
| V4 | Refactor changes sync behavior | Low | High | 4 unit tests; two real runs and a dry run compared | Mitigated |
| V5 | **GitHub disables scheduled workflows after 60 days with no repository activity** | Medium | High (nightly sync and daily health check both stop, quietly) | Not solved by v1.2. Interim: run `gh workflow run sync.yml` and `gh workflow run health.yml` monthly, or any commit resets the clock. A keep-alive is a candidate for a later release | **Open, documented** |
| V6 | CI does not run for the sync bot's commits (GitHub does not trigger workflows from `GITHUB_TOKEN` pushes) | Certain | Low | Daily health check covers cache commits | Accepted |
| V7 | An expiring dispatch token cannot be seen from the hub | Medium | Low (nightly sync still updates) | Calendar reminder (learning guide, Step 9) | Accepted |

## 6. Rollback

```bash
git revert -m 1 <v1.2-merge-commit> && git push     # removes workflows, scripts and the refactor
gh workflow disable "Health check"                  # optional: stop the daily run immediately
```

No data migration to undo: a v1.1 page reads the new cache correctly.

---

# v1.1 — HCI polish, branding, LinkedIn-style Reads (shipped)

Date: 2026-10-19 · Branch: `v1.1` (merged) · Rollback tag: `v1.0`

## 1. Change summary

| # | Change | Type |
|---|--------|------|
| C1 | Branding: "Studio by Debasis Ray — learning never ends!" (title, header, hero, footer, meta) | UI text |
| C2 | HCI / accessibility pass (focus, labels, dialog behavior, contrast, touch targets, reduced motion, skeletons) | UI |
| C3 | Reads: LinkedIn-style composer, edit, tag filter, search, share (LinkedIn, copy link, native share) | Feature |
| C4 | Security: Content-Security-Policy, `noopener noreferrer`, tag/URL sanitising, 30-minute admin idle lock | Hardening |
| C5 | Inline script moved from `index.html` to `js/app.js` (needed so CSP can forbid inline scripts) | Refactor |
| C6 | Defect fixes found during testing: horizontal overflow on phones from long URLs in release notes; raw `[text](url)` Markdown in release notes; very long release notes collapsed | Fix |

## 2. What is touched and what is not

| Component | Touched? | Notes |
|-----------|----------|-------|
| `index.html` | Yes | Markup and CSS; script extracted |
| `js/app.js` | New | Former inline script, plus new features |
| `js/reads-lib.js` | New | Pure helpers, no DOM access |
| `tests/reads-lib.test.js` | New | 16 Node tests, no dependencies |
| `content/reads.json` | **Schema extended, file unchanged** | Additive optional fields only |
| `content/blog.json`, `products.json`, `cache.json` | No | `git diff main` is empty for these |
| `.github/workflows/sync.yml`, `scripts/sync-products.js` | No | Verified by diff and a dry run |
| `docs/notify-studio.yml` | No | |
| PennyExpenseManager repo and its workflow | No | No commits, no secrets changed |
| debasis-web repo | No | Read-only, as before |
| Tokens and secrets | No | `STUDIO_DISPATCH_TOKEN` unchanged; no new tokens |
| GitHub Pages config | No | Still `main`, root |

## 3. Data compatibility

`content/reads.json` articles keep their original shape `{title, url, note}`. New optional fields: `id`, `added`, `kind`, `tags[]`, `comment`.

- Old entries render unchanged: `comment` falls back to `note` (`entryView` in `js/reads-lib.js`).
- Editing an old entry writes `comment` and removes `note`. Unedited entries are never rewritten.
- `books` is untouched. `blog.json` is untouched.
- Rolling back to `v1.0` against a v1.1-written `reads.json` is safe: v1.0 ignores unknown fields and shows `title`/`url`/`note` (new entries have no `note`, so they would show title only).

## 4. Blast radius

- **Public site:** nothing changes until `v1.1` is merged to `main`. Pages deploys from `main` only.
- **Other apps:** Penny and debasis-web are separate repositories and sites. They share nothing with Studio at runtime. The only link is the one-way notify workflow, which is unchanged.
- **Sync pipeline:** unchanged. It writes only `content/cache.json`; the site reads it the same way.
- **Admin publishing:** the publish routine (`publishFile`) is carried over unchanged. It still writes one file per commit, after a SHA read and JSON validation.

## 5. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|-----------|--------|
| R1 | CSP blocks something needed (fonts, GitHub API) | Medium | High (broken page) | CSP allows only Google Fonts and `api.github.com`; page loaded with zero violations in the browser pane | Mitigated; recheck after deploy |
| R2 | Script extraction breaks load order | Low | High | `reads-lib.js` loads before `app.js`; verified loads and runs | Mitigated |
| R3 | New fields confuse old readers | Low | Low | Additive schema; legacy rendering tested | Mitigated |
| R4 | Stored XSS via title, comment, tags or URL | Medium | High | All output escaped; URL scheme allowlist; CSP forbids inline script; payload tests pass | Mitigated |
| R5 | Admin token exposure | Low | High | Unchanged storage (`localStorage` only), new 30-minute idle lock, no token in DOM or logs | Mitigated; residual risk is browser storage |
| R6 | Third-party leakage of reading habits | Low | Medium | No metadata service, no third-party favicons; LinkedIn is contacted only when the visitor clicks Share | Mitigated by design |
| R7 | Layout regressions on small screens | Medium | Medium | Checked at 375, 768 and desktop; an existing overflow defect was found and fixed | Mitigated |
| R8 | Merge conflict with the nightly sync bot | Medium | Low | `git pull --rebase` before push; the bot only touches `cache.json` | Accepted |
| R9 | Admin publish path not exercised end to end | Medium | Medium | The code path is unchanged from v1.0; exercised live with the owner's token on 2026-10-19 (`9acca43`) | Closed (see `test.md` TC-M01) |
| R10 | Google Fonts remains a third-party request | Low | Low | Existing behavior; no new third parties added | Accepted |

## 6. Rollback

```bash
git revert <merge-commit>          # preferred: keeps history
# or return the site to the pre-change state from the tag:
git checkout v1.0 -- index.html && rm -rf js && git commit -m "Roll back to v1.0 UI" && git push
```

No data migration exists, so there is nothing to undo in `content/`.
