# Owner operations guide

**Status: verified 2026-10-21 (SPEC-SH SH-07, TC-SH-D01).** Each product procedure below was executed once as written (with `debasisr66/studio` as a stand-in repository, then undone) and the output matched. Items marked *planned* depend on Studio 2.0. Tokens: [LEARNING-GUIDE](LEARNING-GUIDE.md) Step 9. When something is red: [RUNBOOK](RUNBOOK.md). Field rules: [CONTRACT](CONTRACT.md).

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
3. `node scripts/validate-site.js` prints **OK** with one harmless warning, `no cached data yet for <repo> (the next sync will add it)`. Preview with `DRY_RUN=true GH_TOKEN=$(gh auth token) node scripts/sync-products.js` (it prints `ok <repo>` and `DRY RUN: would write content/cache.json`), then `gh workflow run sync.yml`, `gh run list --workflow sync.yml --limit 1` and reload the site; the warning disappears after the sync.
4. For instant updates, add `notify-studio.yml` and the `STUDIO_DISPATCH_TOKEN` secret to that repo (Step 9 C).

## Hide or retire a product

- **Hide for now:** set `"hidden": true`. The card and the sync skip it. Its old cache entry stays and produces a CI *warning* (`cached repo is hidden or not in the registry`, rule `cache-orphan`) until removed.
- **Retire:** remove the entry from `products.json`, then delete its entry from `content/cache.json` in the same pull request (the sync does not delete old entries). `node scripts/validate-site.js` then prints `OK: 0 error(s), 0 warning(s)`. Remove the product repo's dispatch secret and workflow if you no longer want it to trigger Studio.

## Rename or recategorise

Edit `name`, `tagline` or `category` in `products.json`; no sync needed (these are overrides). A category outside the known list only warns: `unknown category "X" … (known: Productivity, Information, Tools, …)`; add it to `KNOWN_CATEGORIES` in `scripts/validate-site.js` if it is intentional. A renamed repository needs the new `repo` value, and the old cache entry removed as above.

## Publish content (admin)

The ⚙ (bottom corner) opens **Add to Studio**; the token is asked for only when you post (below). To edit or delete existing items, press **Only unlock for editing** in that sheet (or post once), or paste the token at the prompt: username `studio-admin`. Reads: **Share a read** (choose the **Section**, Technical or Others; it starts on the one you used last, else the tab you are viewing), edit or delete, then **Publish changes**. Podcasts: **Share a podcast** (link and title, optionally show, take and tags), edit or delete, then **Publish changes**. Photo: **Change photo**. Lock when finished.

**Add to Studio (Quick add, SPEC-QA Phase A).** Open it from the ⚙, from the **Add to Studio** button in the owner bar, or from the address `…/#add`. It works with no token. Paste (or type) the link, **Paste from clipboard** reads the clipboard only when you tap it (a link on its own, or share text with a title line, both work), choose **Read** or **Podcast** (Spotify and Apple Podcasts links are suggested as Podcast), fill the title, then press **Post and publish**. The token prompt appears only then, over the sheet (username `studio-admin`, the token as the password: a password manager can fill it). On success the page publishes the one file and **locks itself at once** ("Published and locked"); the same happens after **Publish changes**. A failed or refused publish stays unlocked, shows the reason and keeps your text. **Post as draft** adds the item to the page for a later **Publish changes**. Your unfinished text is kept for this tab only (one key in the tab's `sessionStorage`, never the token) and cleared by Cancel or a successful publish.

**iPhone recipe, Chrome (QA-08).** Nothing is installed; the icon is a plain bookmark to `…/#add`.
1. Make Chrome the default browser: Settings, the Chrome app, **Default Browser App**, Chrome. (A Home Screen icon without a web-app manifest opens in the *default* browser.)
2. In Chrome open `https://debasisr66.github.io/studio/#add`, tap Share, **Add to Home Screen** (third-party browsers can do this since iOS 16.4). Name it "Add to Studio".
3. To use it: copy a link (Share, Copy, or long-press the address bar, Copy Link), tap the icon, tap **Paste from clipboard** (iOS may ask to allow paste), fill the title, **Post and publish**, fill the token, done: it is locked again.
4. Token autofill: add the token by hand in Chrome's password manager (or the iPhone Passwords app if it is the AutoFill provider) for `debasisr66.github.io`, username `studio-admin`, if the browser never offers to save it. Whether Face ID or the passcode is asked first is that password manager's own setting.
5. **Fallbacks, in order:** (a) a Chrome bookmark to the same address in the toolbar or bookmarks (two taps); (b) an iPhone **Shortcut** on the Home Screen with the action *Open URLs* set to `googlechromes://debasisr66.github.io/studio/#add` (Chrome's own scheme for https links; whether the `#add` survives is checked by owner test TC-QA-O04).
6. If the icon opens Safari, step 1 was missed. If it opens Chrome without the sheet, use fallback (a) or (b).

**Phone preview before merge.** `docs/build.md` §18.2b builds a throwaway copy in `debasisr66/studio-sandbox` (page title starts with "SANDBOX"; its token form's username is `studio-admin-sandbox`, so the password manager keeps the two tokens apart). Use a separate token limited to that repository; never the real one.

Publish is deliberately cautious: if a content file could not be loaded when the page opened, or GitHub's copy differs from the one the page loaded (another device published, or Pages has not caught up), nothing is written and you are told to wait a minute, reload and try again. Changes not yet published are lost on reload, so note anything you need first. There is no blog editor any more; `content/blog.json` is an archive.

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
| The page itself looks broken after a 2.0 change | Roll back with `build.md` §18.6 (*planned*); tag `v1.5` is the safe point (it brings the Blog back; `podcasts.json` and the new `reads.json` keys are ignored by old code); `v1.6` is the last tag before Podcasts |

## Questions this guide must answer

Where does a new product go? Where do I hide one? What do I run when a card is stale? How do I publish? How do I ship a release and undo it? If an answer is missing, add it here in the same pull request that changed the behaviour.
