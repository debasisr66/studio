# Studio — Architecture

Product studio hub for `debasisr66`. Live at https://debasisr66.github.io/studio/ · Repo: https://github.com/debasisr66/studio

A static GitHub Pages site (no build step, no npm, no frameworks) that showcases product repositories, keeps itself current from GitHub, and has a small CMS for reading and podcast content.

---

## 1. Big picture

```
 PRODUCT REPO (e.g. PennyExpenseManager)              HUB REPO (debasisr66/studio)
 ┌──────────────────────────────────┐                ┌───────────────────────────────────────────┐
 │ release published / README push  │                │ .github/workflows/sync.yml                │
 │            │                     │  repository_   │   triggers: cron 03:00 UTC                │
 │ .github/workflows/               │  dispatch      │             repository_dispatch           │
 │   notify-studio.yml  ────────────┼───────────────▶│             workflow_dispatch (dry_run)   │
 │   uses secret                    │ (one way only) │            │                              │
 │   STUDIO_DISPATCH_TOKEN          │                │   scripts/sync-products.js (Node, no deps)│
 └──────────────────────────────────┘                │     reads content/products.json           │
            ▲                                        │     GitHub API: repo + releases/latest    │
            │ read-only API calls                    │     (read-only on product repos)          │
            └────────────────────────────────────────┤     writes content/cache.json if changed  │
                                                     │            │ git commit + push (no force) │
                                                     │            ▼                              │
                                                     │   GitHub Pages rebuilds from main         │
                                                     └───────────────┬───────────────────────────┘
                                                                     ▼
 BROWSER  index.html ── fetches content/{products,cache,blog,reads}.json ── renders
    │
    └─ Admin (⚙, PAT in the tab only) ── GitHub Contents API ──▶ PUT content/blog.json | reads.json
```

Key property: **data flows one way**. Product repos notify the hub; the hub only *reads* product repos and never writes to them.

## 2. Repository layout

| Path | Role | Written by |
|------|------|-----------|
| `index.html` | Page markup only (strict CSP: no inline script, no inline style) | Developer |
| `css/site.css` | The stylesheet, including the `@font-face` rules | Developer |
| `fonts/` | Self-hosted Inter and JetBrains Mono (Latin and Latin Extended) with their licences | Developer |
| `assets/logo.svg` | The Studio logo (header mark and favicon) | Developer |
| `js/app.js`, `js/reads-lib.js` | Site logic and admin layer; pure, unit-tested helpers (URLs, validation, filters, dates, asset choice) | Developer |
| `js/token-store.js` | Where the admin token lives (`sessionStorage`, memory fallback, legacy purge) and the idle lock; unit-tested | Developer |
| `js/image-lib.js` | Rules for the profile photo (types, limits, crop, quality steps, JPEG reader); unit-tested | Developer |
| `content/profile.json`, `content/profile.jpg` | The profile photo manifest and the photo (the photo exists only after the owner uploads one) | Admin screen |
| `content/changelog.json` | Release notes shown by **What's new** and the footer version; newest first | Owner (git) |
| `content/products.json` | Registry: which repos to show, with overrides | Owner (edit + commit) |
| `content/cache.json` | Live GitHub data (description, stars, language, latest release) | `sync.yml` (bot) |
| `content/blog.json` | Blog posts | Admin CMS |
| `content/reads.json` | Reading list articles + books | Admin CMS |
| `scripts/sync-products.js` | Fetches and validates product data (logic exported for tests) | Developer |
| `scripts/validate-site.js` | CI: schema, URL-safety, CSP (scripts and styles), no inline styles, changelog, size and syntax checks | Developer |
| `scripts/health-check.js` | Daily: live site answers, cache matches GitHub releases, no workflow disabled | Developer |
| `scripts/keepalive.js` | Weekly: decides whether `main` is quiet enough to need a heartbeat commit | Developer |
| `.github/workflows/sync.yml` | Runs the sync | Developer |
| `.github/workflows/ci.yml` | Tests and validation on push and pull request (read-only) | Developer |
| `.github/workflows/health.yml` | Daily health check at 12:00 UTC (read-only) | Developer |
| `.github/workflows/keepalive.yml` | Weekly keep-alive (the only workflow besides the sync allowed to commit) | Developer |
| `.github/dependabot.yml` | Weekly updates for the pinned Actions | Developer |
| `docs/rulesets/` | The history ruleset (in force) and the CI-required ruleset that was tested and not applied, with the reasoning | Developer |
| `docs/brand/` | The three logo concepts and a preview sheet | Developer |
| `tests/*.test.js` | Node unit tests, no dependencies | Developer |
| `docs/notify-studio.yml` | Template for product repos | Developer |
| `docs/ARCHITECTURE.md`, `docs/LEARNING-GUIDE.md` | This documentation | Developer |

## 3. Data model

**Registry entry** (`content/products.json`, array):

| Field | Required | Meaning |
|-------|----------|---------|
| `repo` | yes | `owner/name` |
| `slug` | no | URL-safe id |
| `name`, `tagline` | no | Override GitHub name/description |
| `category` | no | Tag on the card (e.g. Productivity, Information) |
| `featured` | no | Sorted first, highlighted card |
| `hidden` | no | Excluded from site and sync |
| `url` | no | Live site; card shows **Open app** plus **Source** |
| `download_asset` | no | Wildcard (`*`) choosing which release file the **Download** button uses, e.g. `PennyExpenseManager-*.zip`. No match shows **Release** (the release page) instead of a wrong file. Omitted = first attached file |

**Cache** (`content/cache.json`): `{ synced_at, products: { "<repo>": { description, stars, language, topics, pushed_at, html_url, latest_release } } }`. `pushed_at` is a **date** (`2026-10-19`), not a timestamp, so repeated pushes on one day do not rewrite the file. `latest_release` is `null` when the repo has no GitHub Release; otherwise `{ tag, name, body, published_at, download_url, assets[{name, download_url, size}] }`.

**Blog**: `{ posts: [{ id, date, title, body, link }] }` · **Reads**: `{ books: [{ title, author, year, note }], articles: [{ title, url, note }] }`.

## 4. Sync behavior (`scripts/sync-products.js`)

1. Read the registry; abort without changes if it is missing or not an array.
2. For each non-hidden, valid entry: `GET /repos/{repo}` and `GET /repos/{repo}/releases/latest` (a 404 means "no release").
3. **Rate-limit guard:** after each call, if `X-RateLimit-Remaining < 10`, stop fetching and use what was collected.
4. **Failure isolation:** if one repo fails, log a warning and keep its *previous* cache entry. Other repos continue.
5. **Idempotent:** compare the new products object to the existing one. If identical, write nothing and set `changed=false`.
6. **Atomic:** build the full document in memory, re-parse it as validation, then write once.
7. **Dry run:** with `DRY_RUN=true` it logs the would-be file and writes nothing.
8. The workflow commits `content/cache.json` only when `changed=true`, with a plain `git push` (never force). If a push fails on divergence the run fails and the next scheduled run retries.

Triggers: nightly cron `0 3 * * *`, `repository_dispatch` type `product-updated`, and manual `workflow_dispatch` with `dry_run`. A `concurrency` group prevents overlapping runs. Permissions are `contents: write` on the hub only.

## 5. Frontend (`index.html`)

- **Render order and fallbacks:** cache + registry → registry only (name and tagline, with a notice) → friendly empty state. A failed fetch of any content file never breaks the page.
- **Security:** all text is HTML-escaped; URLs pass `safeUrl()` (http/https only); release notes use a tiny safe Markdown subset (paragraphs, bullets, bold, code).
- **Design:** dark default with light mode, tokens as CSS variables, accent `#6E56CF`, Inter + JetBrains Mono. Three columns on desktop, two on tablet, one on mobile with a sticky bottom nav (Products / Blog / Reads) and 44px touch targets.
- **Sections:** Products grid, Updates feed (latest releases), Blog, Reads (articles and books).

## 6. Admin CMS

1. ⚙ opens a modal. The token is checked against `GET https://api.github.com/user`, and the login must equal `debasisr66`.
2. The token is stored in `sessionStorage('studio-admin-pat')` only: this tab, forgotten when it closes; if the browser blocks that, in memory only. It is never in `localStorage`, cookies, the URL or the DOM, and never committed or logged. A token that an earlier version left in `localStorage` is deleted on load.
3. Edits (add/edit/delete for posts, articles, books) change an in-memory draft. The admin bar shows what is unpublished.
4. **Publish** does, per changed file: `GET` current SHA → validate JSON → skip if content is identical → `PUT` with the SHA. **One file per commit**, so a failure leaves the other file untouched. Errors are shown in a dialog, and the draft is kept.
5. Lock & sign out removes the token; so do closing the tab and 30 minutes without interaction.

## 7. Safety rules → where enforced

| Rule | Enforcement |
|------|-------------|
| GET SHA before PUT; validate JSON; one file per commit; idempotent | `publishFile()` in `index.html` |
| No force-push | `sync.yml` uses plain `git push` |
| Hub never writes to product repos | Sync uses GET only; notify flows product → hub |
| Minimal permissions | `permissions: contents: write` in `sync.yml`; sync reads public repos |
| Dry run, manual trigger | `workflow_dispatch` input `dry_run` |
| Failure isolation, rate-limit guard, atomic cache | `scripts/sync-products.js` |
| Scoped dispatch token | Fine-grained PAT limited to `debasisr66/studio` |
| Fallback rendering | `renderProducts()` and `boot()` |
| Admin token never committed | Only `sessionStorage`, key `studio-admin-pat` (`js/token-store.js`) |
| History is the backup | Every cache commit is revertible; no squashing |

## 8. Known limits and tradeoffs

- **Pages delay:** after any commit, Pages takes about 1–2 minutes to rebuild.
- **Releases only:** the sync reads `releases/latest`. A bare git tag, or a pre-release, is not shown. Publish a GitHub Release.
- **Dispatch token breadth:** GitHub's dispatch API requires **Contents: Read and write** (not "Actions"). The token is scoped to the hub repo only and stored only as a secret in product repos.
- **debasis-web:** has no notify workflow (that repo is left untouched), so its updates arrive via the nightly sync.
- **Bot commits:** the nightly sync commits to `main`, so local clones must `git pull --rebase` before pushing.
- **Client-side admin:** the token sits in the browser tab's storage while unlocked. It is limited to one tab and dies with it, and the strict CSP removes the usual ways to run attacker script, but a static site cannot hide a token from its own page. Use a dedicated fine-grained token and lock out on shared machines. See [security.md](security.md).

## 9. Guardrails (v1.2)

A read-only safety net that adds no site feature.

| Guardrail | Runs | Checks | On failure |
|-----------|------|--------|------------|
| CI (`ci.yml`) | Every push to `main`, every pull request, manually | `node --test tests/*.test.js` and `node scripts/validate-site.js` | Red run; GitHub's failed-workflow notification |
| Validator (`validate-site.js`) | Inside CI; runnable locally | Content schema, http(s)-only URLs, duplicate repos and ids, `index.html` has lang, title, viewport and a strict CSP, no inline script, referenced files exist, size budgets (`index.html` 60 KB, each JS file 80 KB / 20 KB, total 150 KB), JS syntax | Exit 1 |
| Health check (`health.yml`) | Daily 06:00 UTC (three hours after the sync), manually | Live site and its JSON files answer; every visible product's latest GitHub release equals the cache | Exit 1 |

Both workflows declare `permissions: contents: read` and use only the automatic `GITHUB_TOKEN`.

Limits worth knowing:

- Pushes made by the sync bot do not trigger CI (GitHub suppresses workflows for `GITHUB_TOKEN` pushes). The daily health check covers cache commits.
- CI does not block merging: branch protection is not enabled. It alerts; it does not gate.
- An expiring dispatch token is invisible to the hub (the nightly sync still refreshes data). Keep the calendar reminder.
- GitHub disables scheduled workflows after 60 days with no repository activity. Run `gh workflow run sync.yml` and `gh workflow run health.yml` at least monthly, or any commit resets the clock. See [impact.md](impact.md) risk V5.

## 10. Version and What's new (v1.3)

`content/changelog.json` is the single source for the version a visitor sees. The footer shows `Studio v<latest>`; the header **What's new** button and the footer version open a dialog listing every release, newest first. A dot marks an update the visitor has not opened yet (`localStorage['studio-seen-version']`, not secret; no dot if storage is blocked). Entries are plain text only (no markup or links), enforced in CI. If the file is missing or invalid the button and version are hidden and nothing else is affected.

## 11. Content-Security-Policy (strict, v1.3)

`default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com; base-uri 'none'; form-action 'none'`

No `'unsafe-inline'` or `'unsafe-eval'` anywhere. To make that possible, the stylesheet is `css/site.css`, no markup or script emits `style=`, and the two dynamic values (avatar hue, language dot colour) travel as `data-*` attributes and are applied with `element.style.setProperty`, which the CSP allows. CI rejects any regression. Since v1.4 nothing on the page comes from another host (fonts are self-hosted). Limits of a static host are in [security.md](security.md) (no `frame-ancestors`, no HSTS control).

## 12. v1.4 additions

**Fonts.** `fonts/` holds Inter and JetBrains Mono (variable fonts, Latin and Latin Extended). The Extended files matter: the rupee sign (U+20B9) is in them. The browser downloads an Extended file only when a page uses one of its characters. CI requires a licence beside every font, rejects third-party hosts and external CSS urls, and requires the Inter faces to cover U+20B9.

**Logo.** `assets/logo.svg` (concept "Lattice Ascent", chosen from three) is the header mark and the favicon. CI rejects an SVG containing script, event handlers, foreign objects or external references.

**Profile photo.** In admin mode **Change photo** opens the file chooser. `js/image-lib.js` and `js/app.js` check type (PNG, JPEG, WebP only), size (10 MB) and pixels (50 MP), decode the image in the browser, crop a centred square, scale to 512 px and re-encode as a JPEG of at most 150 KB, which removes all metadata. A preview dialog asks for confirmation. Publishing writes `content/profile.jpg` then `content/profile.json` (`{"photo": "content/profile.jpg", "updated": "<UTC>"}`) as two commits. The page shows the photo only when the manifest names one, using `?v=<updated>` so a new photo is never served stale, and keeps a monogram otherwise. CI validates both files.

**Branch protection.** One ruleset on `main`, "history protected" (no deletion, no force-push, for everyone; definition in `docs/rulesets/`). A required-CI ruleset was tested live and removed: it rejects the sync and keep-alive bots' direct pushes, and GitHub does not allow the Actions app as a bypass actor on a personal repository. CI gating is by process: releases go through a pull request and are merged only when green. See `docs/design.md` §11.4.

**Scheduled work.** GitHub starts scheduled runs hours late (the 03:00 UTC sync has run between 07:26 and 08:24 UTC), so the health check runs at 12:00 UTC. A weekly keep-alive adds one empty commit to `main` only after 30 days without a commit, so GitHub does not disable the scheduled workflows after 60 days of inactivity. The health check also fails if any workflow is not active.

**Supply chain.** `actions/checkout` and `actions/setup-node` are pinned by commit hash (currently checkout v7.0.1 and setup-node v7.1.0, after Dependabot's first two proposals were merged on 2026-10-20); Dependabot proposes updates weekly; CI rejects unpinned actions, missing permissions blocks and `contents: write` outside the sync and keep-alive workflows.

## 13. Studio 2.0 architecture (built, v2.0)

**Status 2026-10-23:** built and merged: section isolation, timeouts and the browser smoke test (SH A), the content contract and schema versions (SH B), `category` and reads schema 2 (RC A), the Technical / Others tabs and deep links (RC B), `podcasts.json` and its validator (PC A), the Podcasts section and admin with `blog.json` archived and `#blog` redirected (PC B), and the independent review gate ([REVIEW-GATE.md](REVIEW-GATE.md)). Not built: the single ordered list driving page and both navs (UX), books in one column, seed podcasts. §1-12 still describe the v1.5 shape in places (Blog, `blog.json` editing) and are folded into one description at the v2.0 release; the sections below and [CONTRACT.md](CONTRACT.md) are current.

This section describes the architecture as built in v2.0. Specs: [SH](specs/stabilize-core-hub/spec.md), [RC](specs/reads-categories/spec.md), [PC](specs/podcast-links/spec.md), [UX](specs/simple-layout/spec.md). Design detail: [design.md](design.md) §12.

```mermaid
flowchart TB
  subgraph Repo[studio repo, static files]
    IDX[index.html: sections Products, Updates, Reads, Podcasts]
    APP[js/app.js: boot, guarded renderers, admin]
    LIBS[js/reads-lib.js, js/image-lib.js, js/token-store.js: pure, tested]
    CON[content/: products, cache, reads (v2), podcasts (new), changelog, profile, blog (archive)]
    CI[CI: unit tests, validator + RULES fixtures, smoke test (new)]
  end
  GH[GitHub API: product repos, releases]
  SYNC[sync.yml: unchanged] --> CON
  GH --> SYNC
  APP --> LIBS
  APP --> CON
  CI --> Repo
```

### 13.1 What changes

| Area | v1.5 | v2.0 |
|------|------|------|
| Sections | Products, Updates, Blog, Reads | Products, Updates, Reads (Technical, Others), Podcasts: one fixed order |
| Content files | products, cache, blog, reads, changelog, profile | + `podcasts.json`; `reads.json` gains `category` and `schema_version`; `blog.json` archived, not loaded |
| Rendering | `renderAll()` sequential, unguarded | Each section guarded; failure shows a fixed line; admin always reachable |
| Layout | Fixed order, nav lists differ | One fixed ordered list drives the page and both navs (no usage tracking, nothing stored about visitors) |
| Tests | 142 unit tests | + browser smoke test (headless Chrome, no npm) and 116 new cases |
| Docs | Prose contracts | `docs/CONTRACT.md` per content file, kept in step by a test |

### 13.2 What does not change

The sync and its workflows, product repos and the one-way flow, CSP, token handling, protection rules, keep-alive, health check (plus `podcasts.json` in its list), no build step and no npm.

### 13.3 Module boundaries (to keep `app.js` small)

| Module | Owns | Does not touch |
|--------|------|----------------|
| `js/reads-lib.js` | URL rules, categories, filters, platform labels, share links | DOM, storage |
| `js/app.js` | DOM, events, fetch, admin | Rules that can be pure |

