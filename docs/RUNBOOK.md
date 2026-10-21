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
| Sync run is red or did not run | [sync](#sync-failed-or-did-not-run) |
| Card has no Download or Updates entry | [release missing](#release-or-download-missing) |
| Product release did not reach the hub | [dispatch](#product-release-did-not-reach-the-hub) |
| Sync log says rate limit | [rate limit](#github-rate-limit) |
| `workflow "…" is disabled_inactivity` | [disabled](#scheduled-workflow-disabled) |
| CI red on content (`…url must be a clean http(s) address`, `synced_at …`) | [content](#ci-rejects-content) |
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

## Sync failed or did not run

- **Partial failure** (arrives with Phase B): the run ends red after committing the products that did sync. The step summary names each failed repo and the reason. The failed product keeps its previous card data.
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

## Bad commit on `main`

```bash
git log --oneline -10 -- content/cache.json            # find the last good commit
git revert <sha>                                       # preferred
# or restore one file:
git checkout <sha> -- content/cache.json && git commit -m "Restore cache.json from <sha>" && git push
```
A bad commit from the admin screen is caught by CI afterwards, not prevented; see the [protection decision](rulesets/README.md#decision-record).

## Token expired or leaked

Rotation and leak steps are in [LEARNING-GUIDE.md](LEARNING-GUIDE.md) ("Runbook: rotation, expiry and incidents"). Short form: revoke first, create a replacement, update the secret or unlock admin with the new token, then audit `git log --oneline -20` and `gh run list --limit 10`.

## Live site files 404

- **Why:** Pages build in progress or failed.
- **Fix:** `gh run list --limit 3`, wait 1-2 minutes, hard-refresh. If the Pages build failed, read the log and revert the commit that broke it.

## Maintenance

Add a row here whenever a new error message or failure mode is introduced; the spec's TC-TR-D02 check (Phase C) will fail if a message has no row.
