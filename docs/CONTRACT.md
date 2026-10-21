# Content contract

**Status: draft (SPEC-SH SH-03).** Documents the content files **as of v1.5**, with the Studio 2.0 changes marked *planned*. A test that fails when a file or rule is missing from this page is part of SH Phase B. Rule ids are the `RULES` list in `scripts/validate-site.js` plus the structural rules in the same file. Examples contain no real tokens.

| File | Purpose | Written by | Validator |
|------|---------|-----------|-----------|
| `content/products.json` | Which repositories to show and how | Owner (edit the file) | `validateProducts`, `productWarnings` |
| `content/cache.json` | Last synced GitHub data per product | Sync workflow only | `validateCache` |
| `content/reads.json` | Reading list and books | Owner (admin screen) | `validateReads` |
| `content/podcasts.json` | *Planned (PC-01)* podcast links | Owner (admin screen) | `validatePodcasts` (planned) |
| `content/blog.json` | Blog posts. Archive after 2.0 (*planned*: not loaded) | Owner | `validateBlog` |
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

Rules: `synced_at` required, UTC, not in the future (`cache-synced-at`, `cache-synced-future`); `stars` whole number ≥ 0 (`cache-stars`); release `tag` non-empty (`cache-release-tag`); links clean (`cache-url-clean`); an entry for a hidden or unregistered repo warns (`cache-orphan`). *Planned (SH-06):* asset `size` is a whole number ≥ 0 and `download_url` host is `github.com`. `synced_at` moves only when data changes, so its age is not a freshness signal (the health check uses the last successful sync run).

## reads.json (object)

`{ "books": [ ... ], "articles": [ ... ] }` — *planned (RC-01, SH-04):* plus `"schema_version": 2`.

Article fields: `id` (unique number), `added` (date), `url` (clean, required), `title` (required, ≤ 140), `comment` (≤ 280), `kind` (`article`, `video`, `paper`, `podcast`, `tool`), `tags` (≤ 5, each ≤ 24). *Planned:* `category` (`technical` or `other`, required after migration; browser default `other`). Rule ids: `reads-url-clean`, `reads-kind`, `reads-tags`, `reads-comment`, `reads-duplicate-id`; planned `reads-category`, `reads-schema-version`. A repeated link warns.

Book fields: `title` (required), `author`, `year`, `note`; *planned:* `category`.

## podcasts.json (planned, PC-01)

`{ "schema_version": 1, "podcasts": [ { id, added, title (required, ≤ 140), url (clean, required), show (≤ 80), comment (≤ 280), tags (≤ 5) } ] }`. Planned rule ids: `podcast-url-clean`, `podcast-title`, `podcast-schema-version`, `podcast-tags`, `podcast-comment`; duplicate URL warns (`podcast-duplicate-url`).

## blog.json

`{ "posts": [ { id, date (YYYY-MM-DD), title (required), body (required), link (optional, clean) } ] }` Rule ids: `blog-date`, `blog-title`, `blog-link-clean`. Currently zero posts. *Planned (PC-05):* kept as an unrendered archive.

## changelog.json

`{ "releases": [ { version, date, title (≤ 80, plain), items (1 to 6 plain strings, each ≤ 160, no links) } ] }`, newest first, versions strictly descending. Rule ids: `changelog-version`, `changelog-plain-text`. The newest entry is the version shown in the footer.

## profile.json and profile.jpg

`{ "photo": null | "content/<name>.jpg", "updated": null | ISO-8601 UTC }`; `updated` is null exactly when there is no photo. The JPEG is at most 200 KB, at most 1024 px on a side, at least 128 px, and must be a real JPEG.

## How this page stays true

Change a rule or a field in the same pull request as this page; add a failing fixture under `tests/fixtures/` and a [RUNBOOK](RUNBOOK.md) row for any new rule (guarded since v1.5).
