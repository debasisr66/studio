# Owner operations guide

**Status: draft (SPEC-SH SH-07).** Written from the procedures already in use. Every command is to be executed once as written at SH Phase B (TC-SH-D01) before this banner is removed. Items marked *planned* depend on Studio 2.0. Tokens: [LEARNING-GUIDE](LEARNING-GUIDE.md) Step 9. When something is red: [RUNBOOK](RUNBOOK.md). Field rules: [CONTRACT](CONTRACT.md).

Rules: never rewrite history; fix forward with `git revert`; tokens only at hidden prompts or in the admin tab; dry-run first.

## Daily and weekly

| When | Do |
|------|----|
| Daily (automatic) | Health check runs at about 12:00 UTC; a red run emails you |
| After a product release | Nothing: the product's notify workflow triggers the sync. Check `gh run list --workflow sync.yml --limit 3` if the card looks old |
| Weekly (automatic) | Dependabot proposes action updates; keep-alive commits only if `main` is quiet |
| Each token expiry (reminder one week before) | Rotate as in Step 9 E |

## Add a product

1. Edit `content/products.json` (pull request, or directly; CI validates either way):
   ```json
   { "repo": "debasisr66/MyApp", "slug": "my-app", "name": "My App", "tagline": "One line", "category": "Productivity", "featured": false, "hidden": false, "url": "https://debasisr66.github.io/MyApp/" }
   ```
2. Make sure the product repo has a published **GitHub Release** (a bare tag does not count).
3. `gh workflow run sync.yml`, then `gh run list --workflow sync.yml --limit 1` and reload the site.
4. For instant updates, add `notify-studio.yml` and the `STUDIO_DISPATCH_TOKEN` secret to that repo (Step 9 C).

## Hide or retire a product

- **Hide for now:** set `"hidden": true`. The card and the sync skip it. Its old cache entry stays and produces a CI *warning* (`cache-orphan`) until removed.
- **Retire:** remove the entry from `products.json`, then delete its entry from `content/cache.json` in the same pull request (the sync does not delete old entries). Remove the product repo's dispatch secret and workflow if you no longer want it to trigger Studio.

## Rename or recategorise

Edit `name`, `tagline` or `category` in `products.json`; no sync needed (these are overrides). A renamed repository needs the new `repo` value, and the old cache entry removed as above.

## Publish content (admin)

Unlock ⚙ with `studio-admin` (Step 9 B). Reads: **Share a read**, edit or delete, then **Publish changes**. Photo: **Change photo**. *Planned in 2.0:* choose the section (Technical or Others) when adding a read; **Share a podcast** replaces the blog editor. Lock when finished.

## Release Studio itself

Follow [build.md](build.md) §15 (and §18 for 2.0): branch, tests, validator, pull request, green checks, merge, tag, verify live. The changelog entry for a release goes in the release pull request only.

## Rotate or revoke tokens

[LEARNING-GUIDE](LEARNING-GUIDE.md) Step 9 E and "Runbook: rotation, expiry and incidents". Revoke first if a leak is possible.

## Recover

| Situation | Go to |
|-----------|-------|
| Card shows an old version or sync is red | [RUNBOOK](RUNBOOK.md) "Stale or drifting cache" and "Sync failed" |
| A bad commit is on `main` | [RUNBOOK](RUNBOOK.md) "Bad commit on main" (`git revert <sha>`) |
| A scheduled workflow was disabled | [RUNBOOK](RUNBOOK.md) "Scheduled workflow disabled" |
| After 2.0: the page itself looks broken | Roll back with `build.md` §18.6 (*planned*); tag `v1.5` is the safe point |

## Questions this guide must answer

Where does a new product go? Where do I hide one? What do I run when a card is stale? How do I publish? How do I ship a release and undo it? If an answer is missing, add it here in the same pull request that changed the behaviour.
