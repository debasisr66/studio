# Studio runbook: when something is wrong

One page, symptom → cause → fix. Owner: Debasis Ray. Spec: [SPEC-TR](specs/product-trust-reliability/spec.md) (TR-09, TR-10). Setup and token creation steps are in [LEARNING-GUIDE.md](LEARNING-GUIDE.md) (Step 9).

**Golden rules**
1. Never rewrite history; fix forward with `git revert`. `main` cannot be force-pushed (ruleset).
2. Recovery never overwrites valid cache data unless you start a full sync yourself.
3. Never paste a token into a file, a commit or a chat. Tokens live in GitHub secrets or in the admin tab only.
4. Dry-run first, real run second.

**First look (30 seconds)**
```bash
gh run list --status failure --limit 10          # what is red right now?
gh run list --workflow sync.yml --limit 5        # did the nightly sync run, and pass?
node scripts/validate-site.js                    # content and shell checks, locally
GH_TOKEN=$(gh auth token) node scripts/health-check.js   # live site and cache against GitHub
```

## Quick index

| Symptom | Section |
|---------|---------|
| Card shows an old version, or `cache says vX, GitHub says vY` | [stale](#stale-or-drifting-cache) |
| Sync run is red or did not run; health says `last successful sync was N hours ago` | [sync](#sync-failed-or-did-not-run) |
| Card has no Download or Updates entry | [release missing](#release-or-download-missing) |
| Product release did not reach the hub | [dispatch](#product-release-did-not-reach-the-hub) |
| Sync log says rate limit | [rate limit](#github-rate-limit) |
| `workflow "…" is disabled_inactivity` | [disabled](#scheduled-workflow-disabled) |
| CI red on content (`…url must be a clean http(s) address`, `synced_at …`) | [content](#ci-rejects-content) |
| CI red at **Browser smoke test** (`FAIL TC-SH-…`) | [smoke](#browser-smoke-test-fails) |
| A bad commit is on `main` | [bad commit](#bad-commit-on-main) |
| Token expiring, expired or leaked | [tokens](#token-expired-or-leaked) |
| `…returned 404` for the live site | [site down](#live-site-files-404) |

## Stale or drifting cache

- **Why:** the hub missed a release (dispatch not fired), or a sync failed and kept the previous entry on purpose. `synced_at` only changes when data changed, so an old `synced_at` alone is **not** a problem.
- **Check:** `GH_TOKEN=$(gh auth token) node scripts/health-check.js`
- **Fix:**
```bash
DRY_RUN=true GH_TOKEN=$(gh auth token) node scripts/sync-products.js   # shows what would change, writes nothing
gh workflow run sync.yml                                               # real run; commits only if something changed
gh run watch                                                           # follow it
```
- **If it keeps happening:** see [dispatch](#product-release-did-not-reach-the-hub).

## Health check messages (daily run)

| Message | Section |
|---------|---------|
| `returned 404` / site file errors | [live site 404](#live-site-files-404) |
| `cache says vX, GitHub says vY`, `not in cache.json at all` | [stale](#stale-or-drifting-cache) |
| `repository not found on GitHub` | [sync](#sync-failed-or-did-not-run): the repo was renamed, made private or deleted; edit `content/products.json` |
| `configured download_asset … matches no asset`, `cached download … differs from GitHub` | [release or download missing](#release-or-download-missing) |
| `workflow "…" is …` | [disabled](#scheduled-workflow-disabled) |
| `last successful sync was N hours ago`, `no successful run on record` | [sync](#sync-failed-or-did-not-run) |
| `CI is red on main: the newest finished run failure …` | [CI is red on main](#ci-is-red-on-main): the steps are in [CI-RED-FIX.md](CI-RED-FIX.md) and arrive by email as an issue; CI is not a required check, so this is the alarm |
| `warning: … is in cache.json but hidden or not in the registry` | Note only; remove the entry when convenient |

Each health problem line ends with `Fix: docs/RUNBOOK.md#<section>`.

## Sync failed or did not run

- **Partial or total failure:** the run ends **red after committing the products that did sync** (GitHub emails you). The run's summary page lists each failed repo, whether it was an error or a rate-limit skip, and the reason. A failed product keeps its previous card data; if every product failed the cache file is left untouched.
- **Health says `last successful sync was N hours ago` (over 48) or `no successful run on record`:** the sync has not succeeded recently. Open `gh run list --workflow sync.yml --limit 5`: red runs mean fix the named product; no runs mean the workflow is [disabled](#scheduled-workflow-disabled). Note: a manual *dry run* that succeeds also counts as a success.
- **Did not run:** scheduled runs start late (observed 4-5 hours) and are switched off after 60 inactive days ([disabled](#scheduled-workflow-disabled)). A quiet green history is fine.
- **Fix:** read the failing step (`gh run view <id> --log-failed`), fix the cause (repo renamed or deleted → edit `content/products.json`; rate limit → wait), then `gh workflow run sync.yml`.

## Release or download missing

- **Why:** the product repo has no published GitHub Release, or the configured `download_asset` pattern matches no asset.
- **Fix:** `gh release create vX.Y --repo debasisr66/<product> …`, or correct `download_asset` in `content/products.json` (the card falls back to the release page meanwhile), then `gh workflow run sync.yml`.

## Product release did not reach the hub

- **Why:** the product repo's `notify-studio.yml` did not fire or its token expired (403/404 on the dispatch step).
- **Fix:** recreate the dispatch token (LEARNING-GUIDE Step 9), `gh secret set STUDIO_DISPATCH_TOKEN --repo debasisr66/<product-repo>`, then test with `gh workflow run notify-studio.yml --repo debasisr66/<product-repo>` and confirm a `repository_dispatch` run in the hub. The nightly sync repairs the gap within a day regardless.

## GitHub rate limit

- **Why:** unauthenticated or heavy API use. The sync stops fetching when the remaining limit is low and keeps previous entries.
- **Fix:** wait (limit resets hourly), then `gh workflow run sync.yml`. Local runs: pass `GH_TOKEN=$(gh auth token)`.

## Scheduled workflow disabled

- **Why:** GitHub disables scheduled workflows after 60 days without repository activity. The weekly keep-alive prevents this by committing when `main` is quiet.
- **Fix:** `gh workflow enable "<name>"`, then run it once: `gh workflow run <file>`. If the keep-alive itself was disabled, enable it first.

## CI rejects content

| Message | Cause | Fix |
|---------|-------|-----|
| `…url must be a clean http(s) address (no spaces, control characters or login details)` | A link has a leading or trailing space, a hidden character, `user:pass@`, a non-http(s) scheme, or is over 2048 characters | Edit the entry (admin ⚙ → Edit, or the JSON) so it is a plain `https://…` link |
| `cache.json: synced_at is required and must be an ISO-8601 UTC time` | Cache hand-edited or truncated | Restore from the last good commit (see [bad commit](#bad-commit-on-main)) or re-run the sync |
| `cache.json: synced_at (…) is in the future` | Clock or hand edit | Restore, or re-run the sync |
| `cache.json[…]: stars must be a whole number, 0 or more` | Cache hand-edited | Restore or re-run the sync |
| `warn … cached repo is hidden or not in the registry` | Warning only; a product was hidden or removed | Optional: remove that entry from `content/cache.json` |
| other messages | | LEARNING-GUIDE Step 12, "Reading a failure" |

Every content rule CI enforces, with what to do (each is proven by a failing fixture in `tests/fixtures/`):

| File | Message contains | Fix |
|------|------------------|-----|
| products.json | `repo must look like`, `duplicate repo` | Use `owner/name`; one entry per repository |
| products.json | `duplicate slug`, `slug must be lowercase` | Slugs are unique and use lowercase letters, digits and hyphens |
| products.json | `category must not be empty` | Give the product a category or remove the key |
| products.json | `unknown category` (warning) | Typo, or add the new category to `KNOWN_CATEGORIES` in `scripts/validate-site.js` on purpose |
| products.json, cache.json, blog.json, reads.json | `clean http(s) address`, `html_url`, `link must be` | Plain `https://` link: no spaces, hidden characters or `user:pass@` |
| cache.json | `synced_at is required`, `in the future`, `stars must be a whole number`, `latest_release.tag is required` | Restore from the last good commit or re-run the sync |
| cache.json | `hosted on github.com`, `size must be a non-negative integer`, `latest_release.tag must be at most 64 characters` | Restore or re-run sync; release and asset links must use exactly the GitHub hostname; asset sizes must be numeric integers ≥ 0; shorten an oversized release tag at its source |
| cache.json | `hidden or not in the registry` (warning) | Remove that entry from `content/cache.json` when convenient |
| blog.json | `date must be YYYY-MM-DD`, `title is required` | Fix the post in the JSON (the blog is an archive; there is no editor since PC Phase B) |
| reads.json | `schema_version must be` | The file's shape version is missing, wrong, or newer than this page. Restore it from the last good commit, or set `"schema_version": 2` as the first key. The admin screen writes it for you on every publish |
| reads.json | `category must be one of` | A read or book has no `category`, or a value other than `technical` or `other` (typo, capital letter). Set it in the JSON (`"category": "technical"`) or edit the entry in admin and publish; the admin fills it for new entries |
| reads.json | `kind must be one of`, `tags must be an array`, `comment must be text`, `duplicate id` | Edit the read in admin (⚙ → Edit); at most 5 tags, 280-character comment |
| podcasts.json | `podcasts.json: schema_version must be` | The file's shape version is missing, wrong or newer than this page. Restore from the last good commit or set `"schema_version": 1` as the first key |
| podcasts.json | `podcast url must be a clean` | A podcast link has a space, hidden character, `user:pass@`, a non-http(s) scheme or is over 2048 characters; make it a plain `https://…` link |
| podcasts.json | `podcast title is required` | Every podcast needs a title of 1 to 140 characters |
| podcasts.json | `podcast tags must be`, `podcast comment must be`, `podcast show must be` | At most 5 tags of 24 characters, a take of at most 280 characters, a show name of at most 80 |
| podcasts.json | `podcast duplicate id` | Two entries share an `id`; change one |
| podcasts.json | `same link as an earlier podcast` (warning) | The same link appears twice; remove one when convenient |
| changelog.json | `version must look like`, `plain text` | Versions like `1.5`, at most 64 characters; release notes are plain text without `<` or `>` |

## Browser smoke test fails

- **What it is:** CI loads the real page in headless Chrome against small fixture sites and checks that every section renders, that one broken section or file does not affect the rest, and that the page fits a phone. A line `FAIL TC-SH-<id> <case>` names the case and the reason underneath.
- **Run it yourself:** `node scripts/smoke.js` (needs Google Chrome; `SMOKE_ONLY="Reads"` runs only matching cases; `CHROME_BIN=/path/to/chrome` picks a browser).
- **A section case fails** (`expected the fallback line…`, `did not render`): a recent change to `js/app.js`, `index.html` or a renderer broke isolation or that section. Fix the renderer; do not weaken the case. The fixtures are in `tests/fixtures/site/`.
- **`the page never finished loading`:** the page stopped before `boot()` finished, usually a JavaScript error; run the page locally and read the console.
- **`console errors:`** a new error appeared on a healthy page; fix the cause.
- **`Chrome not found`:** install Chrome, or set `CHROME_BIN`. On GitHub's runner Chrome is preinstalled; a missing Chrome there means the runner image changed.
- **Cleanup message such as `ENOTEMPTY`:** harmless temp-folder cleanup; the script ignores it (fixed in v2.0 SH Phase A).

## CI is red on main

Follow [CI-RED-FIX.md](CI-RED-FIX.md). The same steps are emailed as a GitHub issue titled **CI is red on main** the moment CI fails on `main` (the Health check workflow runs when CI finishes, and daily). The issue closes itself when CI is green again. First question: is the live site broken for visitors; if yes, revert first.

## Bad commit on `main`

```bash
git log --oneline -10 -- content/cache.json            # find the last good commit
git revert <sha>                                       # preferred
# or restore one file:
git checkout <sha> -- content/cache.json && git commit -m "Restore cache.json from <sha>" && git push
```
A bad commit from the admin screen is caught by CI afterwards, not prevented; see the [protection decision](rulesets/README.md#decision-record). Since v2.0 the daily health check also fails with `CI is red on main` when the newest finished CI run on `main` failed, so a red main cannot sit unnoticed.

## Token expired or leaked

Rotation and leak steps are in [LEARNING-GUIDE.md](LEARNING-GUIDE.md) ("Runbook: rotation, expiry and incidents"). Short form: revoke first, create a replacement, update the secret or unlock admin with the new token, then audit `git log --oneline -20` and `gh run list --limit 10`.

## Live site files 404

- **Why:** Pages build in progress or failed.
- **Fix:** `gh run list --limit 3`, wait 1-2 minutes, hard-refresh. If the Pages build failed, read the log and revert the commit that broke it.

## Maintenance

Add a row here whenever a new error message or failure mode is introduced; the spec's TC-TR-D02 check (Phase C) will fail if a message has no row.
