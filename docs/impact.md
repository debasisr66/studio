# Impact Analysis — Studio

Releases: **v1.4 (in progress, branch `release/v1.4`)** · v1.3 (shipped) · v1.2 (shipped) · v1.1 (shipped)

---

# v1.4 — Self-hosted fonts, protected main, keep-alive, profile photo, logo

Date: 2026-10-20 · Rollback tag: `v1.3` · Order of work: **impact → plan → design → build → test → security checks → update artefacts**

## 1. Change summary

| # | Change | Type |
|---|--------|------|
| U1 | **Self-host the fonts** (Inter, JetBrains Mono): `fonts/*.woff2` with their licences; Google Fonts removed from the page and the CSP | Privacy, performance, hardening |
| U2 | **Branch protection** by two repository rulesets on `main`: history can never be rewritten or deleted; CI (`check`) is a required status check, with the repository admin (the owner's token, which the admin screen uses) and the GitHub Actions app allowed to bypass | Process control |
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
| X1 | Self-hosted fonts render differently from Google's | Low | Medium | Same font files; computed-style comparison against v1.3 | Open until tested |
| X2 | A ruleset blocks the admin screen's commits or the sync bot's commits | Medium | High | Admin role and the GitHub Actions app are bypass actors; applied only after merge; tested straight away (a forced keep-alive commit as the Actions app, a direct push as admin); one-command rollback; owner re-checks one real publish | Open until tested |
| X3 | The owner can still bypass CI (admin bypass is required so the admin screen's direct commits keep working) | Certain | Low | Honest limit, documented. The rulesets block force-push and deletion for **everyone**, and gate pull-request merges for the normal path | Accepted |
| X4 | Keep-alive adds clutter or permissions | Low | Low | At most one empty commit per 30 days; `contents: write` only in that workflow; decision logic unit-tested | Mitigated |
| X5 | Pinned hashes go stale | Medium | Low | Dependabot weekly pull requests | Mitigated |
| X6 | Editing `sync.yml` breaks the sync | Low | High | Pin only; dry run on GitHub before and after merge | Open until tested |
| X7 | A malicious or huge image is uploaded | Low | Medium | Owner-only; PNG, JPEG, WebP only (no SVG); decoded and re-encoded; size and pixel limits; CI validates `profile.jpg` | Open until tested |
| X8 | Photo reveals location or device metadata | Medium | Medium | Re-encoding through a canvas drops all metadata; documented | Mitigated by design |
| X9 | A changed photo shows stale for a few minutes | High | Low | GitHub Pages caches for up to 10 minutes; admin sees the new one immediately; documented | Accepted |
| X10 | Scheduled-run delays cause false alarms | Medium | Low | Health moved to 12:00 UTC; delays documented | Mitigated |
| X11 | Logo unreadable at favicon size | Low | Low | Checked at 128, 32 and 16 px | Open until tested |

## 6. Rollback

```bash
# rulesets first (if publishing or sync is ever blocked):
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
