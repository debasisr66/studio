# Content contract

**Status: enforced (SPEC-SH SH-03, v2.0 SH Phase B; reads schema 2 from v2.0 RC Phase A).** Documents the content files as of the current build, with later Studio 2.0 changes marked *planned*. CI fails if a file in `content/` or a rule id is missing from this page (`checkContractDoc`). Rule ids are the `RULES` list in `scripts/validate-site.js` plus the structural rules in the same file. Examples contain no real tokens.

| File | Purpose | Written by | Validator |
|------|---------|-----------|-----------|
| `content/products.json` | Which repositories to show and how | Owner (edit the file) | `validateProducts`, `productWarnings` |
| `content/cache.json` | Last synced GitHub data per product | Sync workflow only | `validateCache` |
| `content/reads.json` | Reading list and books | Owner (admin screen) | `validateReads` |
| `content/podcasts.json` | Podcast links. Validated since v2.0 PC Phase A; shown in the Podcasts section since PC Phase B. A newer `schema_version` than the page knows shows that section's fallback line and blocks publishing over it | Owner (admin screen: Share a podcast) | `validatePodcasts` |
| `content/blog.json` | Blog posts. An unrendered archive since v2.0 PC Phase B: the page no longer loads it; CI still validates it and the health check still confirms it is served | Owner (file only; there is no editor) | `validateBlog` |
| `content/status.json` | The owner status line under the hero (SPEC-ST); optional: no file means no line | Owner (edit the file in Git) | `validateStatus` (rules in `js/reads-lib.js`) |
| `content/changelog.json` | What's new and the visible version | Owner, in the release PR | `validateChangelog` |
| `content/profile.json`, `content/profile.jpg` | Profile photo manifest and image | Owner (admin screen) | `validateProfileManifest`, `validateProfileImage` |

**Shared rules.** Every URL is a *clean http(s) address*: no spaces or control characters, no `user:pass@`, host written out, at most 2048 characters (`isPublishableUrl`). Text is plain; the page escapes it. Dates are `YYYY-MM-DD`.

## products.json (array)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `repo` | string `owner/name` | yes | Unique (case-insensitive); rule ids `product-repo-format`, `product-repo-duplicate` |
| `slug` | string | no | `[a-z0-9]+(-[a-z0-9]+)*`, unique (`product-slug-format`, `product-slug-unique`) |
| `name`, `tagline` | string | no | Fall back to the repo name and description |
| `category` | string | no | Not empty (`product-category-empty`); unknown value warns (`product-category-unknown`) |
| `featured`, `hidden` | boolean | no | `hidden` removes the card and skips the sync |
| `url` | clean http(s) | no | "Open app" link (`product-url-clean`) |
| `download_asset` | string wildcard | no | e.g. `PennyExpenseManager-*.zip`; `*` matches any characters |

Example: `{ "repo": "debasisr66/PennyExpenseManager", "slug": "penny", "name": "Penny", "category": "Productivity", "featured": true, "download_asset": "PennyExpenseManager-*.zip" }`

## cache.json (object, written by sync)

`{ "synced_at": ISO-8601 UTC, "products": { "<owner/name>": { description, stars, language, topics[], pushed_at (date), html_url, latest_release: null | { tag, name, body, published_at, download_url, assets[ { name, download_url, size } ] } } } }`

Rules: `synced_at` required, UTC, not in the future (`cache-synced-at`, `cache-synced-future`); `stars` whole number ≥ 0 (`cache-stars`); release `tag` non-empty (`cache-release-tag`); links clean (`cache-url-clean`); an entry for a hidden or unregistered repo warns (`cache-orphan`). SH-06: every asset requires a numeric, non-negative integer `size` (`cache-asset-size`); both `latest_release.download_url` (the release-page fallback, `cache-release-host`) and each asset `download_url` (`cache-asset-host`) must be clean HTTP(S) URLs with parsed hostname exactly `github.com` (case-insensitive, no subdomains or trailing dot). Existing URL length and credential restrictions still apply. Release `tag` is at most 64 UTF-16 code units (`cache-release-tag-length`), an implementation bound chosen because SH-06 does not give a number; no new tag format is required. `synced_at` moves only when data changes, so its age is not a freshness signal (the health check uses the last successful sync run).

A release with `assets: []` still links to its GitHub release page; `latest_release` may remain null or absent.

## reads.json (object)

`{ "schema_version": 2, "books": [ ... ], "articles": [ ... ] }`

`schema_version` (rule `reads-schema-version`) is the version of this file's shape: required, an integer, currently `2` (`1` was the shape before categories). The admin screen writes it first on every publish. A browser tolerates a missing or older value (documented defaults: a missing `category` shows as `other`) but refuses to show or edit a **newer** one (Reads shows its fallback line and nothing can be published over the file). CI accepts exactly `2`. History: `1` (v1.5 and SH Phase B) → `2` (RC Phase A, adds `category` to every read and book; the migration was additive, so v1.5 code still renders the file).

Article fields: `id` (unique number), `added` (date), `url` (clean, required), `title` (required, ≤ 140), `comment` (≤ 280), `kind` (`article`, `video`, `paper`, `podcast`, `tool`), `tags` (≤ 5, each ≤ 24), `category` (`technical` or `other`, required; the closed list is `CATEGORIES` in `js/reads-lib.js`; browser default for a missing or unknown value is `other`). Rule ids: `reads-url-clean`, `reads-kind`, `reads-tags`, `reads-comment`, `reads-duplicate-id`, `reads-category`, `reads-schema-version`. A repeated link warns.

Book fields: `title` (required), `author`, `year`, `note`, `category` (same closed list, required; rule `reads-category`).

## podcasts.json (object)

`{ "schema_version": 1, "podcasts": [ { id, added, title (required, ≤ 140), url (clean, required), show (≤ 80), comment (≤ 280), tags (≤ 5, each ≤ 24) } ] }`

Only `title` and `url` are required; `id` (unique when present), `added` (`YYYY-MM-DD`), `show`, `comment` and `tags` are optional. A link may point to a show or to an episode. `schema_version` is required, an integer, currently `1` (`podcast-schema-version`); a browser will tolerate a missing or older value and refuse a newer one, the same as `reads.json`. Currently zero podcasts (the owner supplies the seed links; none are invented).

Rule ids: `podcast-url-clean`, `podcast-title`, `podcast-schema-version`, `podcast-tags`, `podcast-comment`, `podcast-show`, `podcast-duplicate-id`; a repeated link only warns (`podcast-duplicate-url`, compared with the query string kept, so two YouTube videos are different links).

The platform label on a card comes from a closed host list in `js/reads-lib.js` (`platformOf`: Spotify, Apple Podcasts, YouTube; any other host shows its plain domain).

## blog.json

`{ "posts": [ { id, date (YYYY-MM-DD), title (required), body (required), link (optional, clean) } ] }` Rule ids: `blog-date`, `blog-title`, `blog-link-clean`. Currently zero posts. Kept as an unrendered archive (PC-05, built in PC Phase B): not fetched by the page, not editable in the admin screen, `#blog` links go to `#podcasts`.

## status.json

`{ "schema_version": 1, "updated": "YYYY-MM-DD", "items": [ { "label", "value" } ] }`. One to four items; a label is 1 to 20 characters and a value 1 to 40, plain text (no `<`, `>`, links or `www.`); `updated` is a real date that is not tomorrow or later and is always shown on the page ("as of …"). A file that breaks any rule hides the line on the page and fails CI. Suggested words: Studio (Active, Steady, Quiet, Paused), Next (Idea, Incubating, Building, Launching soon), Owner (Building, Thinking, Away until …). Rule ids: `status-schema-version`, `status-items`, `status-label`, `status-value`, `status-updated`, `status-plain`. To change the status: edit the file on GitHub (web or the phone app), set `updated` to today, commit.

## changelog.json

`{ "releases": [ { version, date, title (≤ 80, plain), items (1 to 6 plain strings, each ≤ 160, no links) } ] }`, newest first, versions strictly descending. Rule ids: `changelog-version`, `changelog-plain-text`. The newest entry is the version shown in the footer. SH-06 version-badge bound: each changelog `version` is at most 64 UTF-16 code units before the renderer adds its fixed label (`changelog-version`); the existing numeric version format is unchanged.

## profile.json and profile.jpg

`{ "photo": null | "content/<name>.jpg", "updated": null | ISO-8601 UTC }`; `updated` is null exactly when there is no photo. The JPEG is at most 200 KB, at most 1024 px on a side, at least 128 px, and must be a real JPEG.

## How this page stays true

Change a rule or a field in the same pull request as this page; add a failing fixture under `tests/fixtures/` and a [RUNBOOK](RUNBOOK.md) row for any new rule (guarded since v1.5).
