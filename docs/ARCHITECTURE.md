# Studio — Architecture

Product studio hub for `debasisr66`. Live at https://debasisr66.github.io/studio/ · Repo: https://github.com/debasisr66/studio

A static GitHub Pages site (no build step, no npm, no frameworks) that showcases product repositories, keeps itself current from GitHub, and has a small CMS for blog and reading content.

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
    └─ Admin (⚙, PAT in localStorage) ── GitHub Contents API ──▶ PUT content/blog.json | reads.json
```

Key property: **data flows one way**. Product repos notify the hub; the hub only *reads* product repos and never writes to them.

## 2. Repository layout

| Path | Role | Written by |
|------|------|-----------|
| `index.html` | Entire site: HTML, CSS, JS, admin layer | Developer |
| `content/products.json` | Registry: which repos to show, with overrides | Owner (edit + commit) |
| `content/cache.json` | Live GitHub data (description, stars, language, latest release) | `sync.yml` (bot) |
| `content/blog.json` | Blog posts | Admin CMS |
| `content/reads.json` | Reading list articles + books | Admin CMS |
| `scripts/sync-products.js` | Fetches and validates product data | Developer |
| `.github/workflows/sync.yml` | Runs the sync | Developer |
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
| `url` | no | Live site; card shows **Visit site** plus **Source** |

**Cache** (`content/cache.json`): `{ synced_at, products: { "<repo>": { description, stars, language, topics, pushed_at, html_url, latest_release } } }`. `latest_release` is `null` when the repo has no GitHub Release; otherwise `{ tag, name, body, published_at, download_url, assets[{name, download_url, size}] }`.

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
2. The token is stored in `localStorage('studio-admin-pat')` only. It is never committed or logged.
3. Edits (add/edit/delete for posts, articles, books) change an in-memory draft. The admin bar shows what is unpublished.
4. **Publish** does, per changed file: `GET` current SHA → validate JSON → skip if content is identical → `PUT` with the SHA. **One file per commit**, so a failure leaves the other file untouched. Errors are shown in a dialog, and the draft is kept.
5. Lock & sign out removes the token from `localStorage`.

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
| Admin token never committed | Only `localStorage`, key `studio-admin-pat` |
| History is the backup | Every cache commit is revertible; no squashing |

## 8. Known limits and tradeoffs

- **Pages delay:** after any commit, Pages takes about 1–2 minutes to rebuild.
- **Releases only:** the sync reads `releases/latest`. A bare git tag, or a pre-release, is not shown. Publish a GitHub Release.
- **Dispatch token breadth:** GitHub's dispatch API requires **Contents: Read and write** (not "Actions"). The token is scoped to the hub repo only and stored only as a secret in product repos.
- **debasis-web:** has no notify workflow (that repo is left untouched), so its updates arrive via the nightly sync.
- **Bot commits:** the nightly sync commits to `main`, so local clones must `git pull --rebase` before pushing.
- **Client-side admin:** the PAT sits in browser storage. Use a dedicated fine-grained token, and lock out on shared machines.
