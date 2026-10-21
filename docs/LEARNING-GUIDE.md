# Studio — Learning Guide

A stepwise walkthrough of how the Studio hub was built, with every command, token and the fixes learned along the way. Read [ARCHITECTURE.md](ARCHITECTURE.md) first for the picture.

> **Token rule:** this guide shows token **names and scopes only**. Never paste a real token into a file, chat, commit or screenshot. Placeholders look like `github_pat_xxx`.

Conventions: commands run from `/Users/debasisray/CoworkProjects/studio-site` unless stated. Owner is `debasisr66`.

---

## Step 1 — Prerequisites and checks

```bash
git --version
node --version                      # 18+ (built-in fetch); this project used v25
gh auth status                      # must show "Logged in to github.com account debasisr66"
gh repo view debasisr66/studio --json name,url,visibility,defaultBranchRef
gh api repos/debasisr66/studio/pages
```

Expected: repo is PUBLIC, default branch `main`, Pages `status: built`, source `main` `/`.
**Why:** do not build until the repo exists, Pages is on, and the local folder is a git repo.

## Step 2 — Local repo and git identity

```bash
mkdir /Users/debasisray/CoworkProjects/studio-site && cd /Users/debasisray/CoworkProjects/studio-site
git init
git remote add origin https://github.com/debasisr66/studio.git
git remote -v
```

If a commit says `Author identity unknown`, set a **repo-local** identity with the GitHub noreply address (keeps a work email out of public history):

```bash
ID=$(gh api user --jq .id)
git config user.name "Debasis Ray"
git config user.email "${ID}+debasisr66@users.noreply.github.com"
```

Enable Pages once: GitHub → repo → Settings → Pages → Source `main`, root `/`.

## Step 3 — Registry and sync script

1. Create `content/products.json` (see ARCHITECTURE §3). Minimal entry:
   ```json
   { "repo": "debasisr66/PennyExpenseManager", "name": "Penny", "tagline": "…", "category": "Productivity", "featured": true, "hidden": false }
   ```
2. Create `scripts/sync-products.js` (Node, no dependencies).
3. Run it locally with your own CLI auth (no token typed anywhere):
   ```bash
   GH_TOKEN=$(gh auth token) node scripts/sync-products.js
   cat content/cache.json
   ```
   Expect `ok debasisr66/PennyExpenseManager` and a written `content/cache.json`.

Dry run (nothing written):
```bash
DRY_RUN=true GH_TOKEN=$(gh auth token) node scripts/sync-products.js
```

## Step 4 — The sync workflow

Create `.github/workflows/sync.yml` (triggers: cron, `repository_dispatch: product-updated`, `workflow_dispatch` with `dry_run`; permission `contents: write`).

After it is pushed to `main` (a workflow must exist on the default branch before it can be triggered):

```bash
gh workflow run sync.yml -f dry_run=true         # safe test: logs only, no commit
gh run list --workflow sync.yml --limit 3
gh run view <run-id> --log                       # read the output
```

## Step 5 — Build and check the site locally

```bash
python3 -m http.server 8765 &                    # serve the folder
open http://localhost:8765/
# when done:
pkill -f "http.server 8765"
```

Check: cards render, no console errors, dark/light toggle works, resize to ~375px for mobile (bottom nav visible, no horizontal scroll).

## Step 6 — Commit and push (never force)

```bash
git add -A
git commit -m "Describe the change"
git pull --rebase            # the nightly bot commits cache.json, so local main can fall behind
git push
```

If `git push` is rejected with "fetch first" / "behind": run `git pull --rebase` then push again. **Never** use `--force` or `--force-with-lease`.

Verify the deploy:
```bash
gh run list --limit 3                                    # "pages build and deployment" should be success
curl -s -o /dev/null -w "%{http_code}\n" https://debasisr66.github.io/studio/
```

## Step 7 — Add another product

1. Add an entry to `content/products.json`. For a site-style product add `"url": "https://…"` and a `category`. To control the Download button add `"download_asset": "MyApp-*.zip"` (wildcard on the release file name).
2. Refresh the cache and publish:
   ```bash
   GH_TOKEN=$(gh auth token) node scripts/sync-products.js
   git add -A && git commit -m "Add <product>" && git pull --rebase && git push
   ```
3. Optional for instant updates: add the notify workflow to that repo (Steps 8–9). Without it, updates arrive with the nightly sync.

## Step 8 — Notify workflow in a product repo

Template: [notify-studio.yml](notify-studio.yml). Triggers: `workflow_dispatch` (for testing), release published, push to `main` touching `README.md` or `CHANGELOG.md`.

Use a clone in a scratch folder so you never disturb a working copy:

```bash
D=$(mktemp -d)/penny
gh repo clone debasisr66/PennyExpenseManager "$D"      # note: no -q flag; gh does not accept it before --
cd "$D"
mkdir -p .github/workflows
cp /Users/debasisray/CoworkProjects/studio-site/docs/notify-studio.yml .github/workflows/
git config user.name "Debasis Ray"
git config user.email "$(gh api user --jq .id)+debasisr66@users.noreply.github.com"
git add . && git commit -m "Add notify-studio workflow" && git push
```

## Step 9 — Tokens

Studio uses **two tokens, one per job**. Create them separately, name them differently, store each in one place only.

| | **Admin token** (`studio-admin`) | **Dispatch token** (`studio-dispatch`) |
|---|---|---|
| Job | You publish blog posts, reads and your photo from the ⚙ screen | A product repo (Penny) tells Studio "I released something, sync now" |
| Used by | You, by hand, in the browser | A GitHub Actions workflow in the product repo, unattended |
| Stored | **Nowhere.** Pasted into the open tab; forgotten when the tab closes or after 30 minutes idle | GitHub Actions secret `STUDIO_DISPATCH_TOKEN` in **each product repo** |
| Suggested expiry | 30–90 days (you will paste a fresh one from your password manager) | 90 days to 1 year (it runs unattended) |
| Resource owner / repo | `debasisr66` / **only `studio`** | `debasisr66` / **only `studio`** |
| Permission | Repository → **Contents: Read and write** | Repository → **Contents: Read and write** |

**Be clear about what separation gives you.** Both tokens need the same permission, because GitHub's dispatch call (`POST /repos/debasisr66/studio/dispatches`) requires *Contents: write*, and a fine-grained token cannot be narrowed to one file or to dispatch only. So the separation is about **where each lives and how long it lasts**, not about power. Either one leaking lets someone change Studio's content files, which is why each is limited to the `studio` repo, kept short-lived, and revocable on its own. If you ever do not need instant updates, delete the dispatch token and secret: the nightly sync still catches releases within a day, and no long-lived secret sits in another repo.

If the permission list has no "Actions" entry: correct, the permission you need is **Contents**.

### A. Create a token (same form for both; only name and expiry differ)

Open https://github.com/settings/personal-access-tokens/new (profile picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token).

Worked example for the admin token:

| Field | Enter |
|-------|-------|
| Token name | `studio-admin` |
| Description | `Publish from the Studio admin screen` |
| Expiration | Custom → a date about 60 days away |
| Resource owner | `debasisr66` |
| Repository access | **Only select repositories** → tick `debasisr66/studio` (nothing else) |
| Permissions → Repository permissions | **Contents** → *Read and write* (Metadata: Read-only appears by itself; leave it) |
| Account permissions | none |

Click **Generate token**. The value (it starts with `github_pat_`, for example `github_pat_11ABCDEF0…`, a long string) is **shown once**: copy it into your password manager straight away. For the dispatch token repeat with name `studio-dispatch` and a longer expiry.

Before you leave the page, check the summary lists **1 repository: debasisr66/studio** and **Contents: Read and write**. A token that names the wrong repository is the most common mistake (see the errors below).

**If Generate does nothing:** scroll to the top for a validation message (name, expiry, repository not actually selected, no permission added); hard-refresh; try a private window or disable extensions; check for a hidden password or 2FA prompt.

### B. Use the admin token (Studio publishing)

1. Open https://debasisr66.github.io/studio/ and click **⚙**.
2. Paste the token and click **Unlock**. The site asks GitHub who you are and unlocks only for `debasisr66`.
3. Add or edit a read, post or your photo, then click **Publish changes**. Each file becomes one commit on `main`.
4. Wait about a minute for Pages, then refresh to see it.
5. Click **Lock & sign out**.

Where the token lives: in the browser tab's memory only (`sessionStorage`). Close the tab and it is gone; a new tab asks again; 30 minutes idle locks it. It is never in `localStorage`, cookies, the page, a commit or a log. Do **not** paste it into `gh secret set`, a file or a chat.

### C. Store the dispatch token (once per product repo)

Paste at the prompt, so it never enters your shell history and never appears on screen:
```bash
gh secret set STUDIO_DISPATCH_TOKEN --repo debasisr66/PennyExpenseManager
# expect: ✓ Set Actions secret STUDIO_DISPATCH_TOKEN for debasisr66/PennyExpenseManager
gh secret list --repo debasisr66/PennyExpenseManager      # shows the name and updated time, never the value
```
Wait for the ✓ line before testing: the time in `gh secret list` must change. The same secret is under repo → Settings → Secrets and variables → Actions.

### D. Test each token

**Dispatch token:** (this is Step 10 A)
```bash
gh workflow run notify-studio.yml --repo debasisr66/PennyExpenseManager
gh run list --repo debasisr66/studio --workflow sync.yml --limit 2
```
Pass = the Penny run is green and Studio shows a new run with event `repository_dispatch`.

**Admin token:** unlock ⚙ with it and publish one small change (for example edit a read's comment). Pass = "Published successfully" and the change appears after a refresh.

### E. Expiry, rotation and cleanup

| When | Do |
|------|----|
| One week before expiry (set a calendar reminder for each token) | Create the replacement as in A, switch to it (B or C), test (D), then delete the old one |
| After creating a replacement | Delete the old token: Settings → Developer settings → Fine-grained tokens → the token → Delete |
| You once used one token for both jobs | Create the second token, move each job to its own, then delete the shared one |
| A token may have leaked | Revoke it first, then replace it, then audit `git log --oneline -20` and `gh run list --limit 10` (see "Runbook: rotation, expiry and incidents") |

### F. Token errors seen in practice

| Message | Cause | Fix |
|---------|-------|-----|
| `Resource not accessible by personal access token` (dispatch step in the product repo) | The token is not allowed to touch `studio`: wrong repository ticked, Contents missing or read-only, or the wrong resource owner | Edit the token (same value is kept) so it lists only `debasisr66/studio` with *Contents: Read and write*; if you replaced it, run `gh secret set` again |
| The product-repo run is red and `gh secret list` shows the old time | The secret was never saved: the `gh secret set` prompt is still waiting for the paste | Finish the prompt, wait for the ✓ line, then test again |
| `HTTP 422: Workflow does not have 'workflow_dispatch' trigger` | The workflow only listens for release or push | Add `workflow_dispatch:` under `on:` and push |
| 401 or "Bad credentials" at unlock or publish | Token expired, revoked or mistyped | Create a new token (A) and paste it again |
| Unlock works but Publish fails with 403 or 404 | The admin token lacks Contents write on `studio` | Edit the token as above |

## Step 10 — End-to-end test

**A. Manual notify (no release needed):**
```bash
gh workflow run notify-studio.yml --repo debasisr66/PennyExpenseManager
gh run list --repo debasisr66/PennyExpenseManager --workflow notify-studio.yml --limit 1
gh run list --repo debasisr66/studio --workflow sync.yml --limit 2
```
Pass = Penny run succeeds and a studio "Sync product cache" run has event `repository_dispatch` (the sync may make no commit if nothing changed; that is correct).

**B. Real release (what shows on the site):**
```bash
gh release create v3.1 --repo debasisr66/PennyExpenseManager \
  --title "Penny 3.1" --notes "- What changed"        # add files at the end to attach downloads
gh release list --repo debasisr66/PennyExpenseManager
```
Then:
```bash
git pull --rebase
grep '"tag"' content/cache.json                        # expect "tag": "v3.1"
```
Wait ~1–2 min for Pages, hard-refresh https://debasisr66.github.io/studio/. Expect a `v3.1` badge, a Download button, and an entry in Updates.

A bare tag or a pre-release will **not** show: only a published GitHub Release counts.

## Step 11 — Using the admin CMS

1. Create the admin token (Step 9 A, name `studio-admin`; full walk-through in Step 9 B).
2. Open the site → click ⚙ → paste the token → Unlock (it is validated against `GET /user`). **Since v1.3 the token lives in that tab only**: it is forgotten when you close the tab, in a new tab you unlock again, and the old stored token from earlier versions was deleted, so you unlock once after upgrading.
3. Add/edit/delete posts, articles, books. Changes stay local until **Publish changes**.
4. Publish commits one file at a time. Wait for Pages, then refresh. **Lock & sign out** removes the token from the browser.

## Troubleshooting (real errors seen)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `HTTP 422: Workflow does not have 'workflow_dispatch' trigger` | Workflow only listens for release/push | Add `workflow_dispatch:` under `on:` and push |
| No "Actions" permission in the token dialog | Wrong permission; dispatch needs Contents | Add **Contents: Read and write**; also make sure repo access is not "Public repositories (read-only)" |
| Generate token button does nothing | Validation error off-screen, extension, or hidden re-auth prompt | See Step 9 |
| `Author identity unknown` | No git identity | Repo-local `git config user.name/email` (Step 2) |
| `git push` rejected, "fetch first"/"behind" | The sync bot committed `cache.json` | `git pull --rebase` then `git push`; never force |
| `cannot pull with rebase: You have unstaged changes` | Uncommitted edits | Commit (or stash) first, then pull --rebase |
| `unknown shorthand flag: 'q'` in `gh repo clone` | gh does not accept git flags before `--` | Drop `-q`, or `gh repo clone owner/repo dir -- -q` |
| `workflow sync.yml not found on the default branch` | Workflow not pushed yet | Push to `main` first |
| Site shows no Updates / no Download | Repo has no GitHub Release | `gh release create …` |
| 403/404 on the dispatch step | Wrong token scope or expired | Recreate token (Step 9), `gh secret set` again |
| Site not updated after a commit | Pages build in progress | `gh run list --limit 3`, wait 1–2 min, hard-refresh |

## Runbook — rotation, expiry and incidents

**Before expiry (set a calendar reminder one week ahead)**
1. Create a new fine-grained token with identical settings (Step 9).
2. `gh secret set STUDIO_DISPATCH_TOKEN --repo debasisr66/<product-repo>` (repeat per product repo).
3. Test: `gh workflow run notify-studio.yml --repo debasisr66/<product-repo>` and confirm a `repository_dispatch` run appears in the hub.
4. Delete the old token in Settings → Developer settings → Fine-grained tokens.

**Suspected leak (any token)**
1. Revoke it immediately: Settings → Developer settings → Fine-grained tokens → the token → Delete.
2. Create a replacement, update the secret (above) or unlock the admin with the new one.
3. Audit: `git log --oneline -20`, `gh run list --limit 10`, and check the repo's Settings → Webhooks / Actions for unexpected changes.
4. If anything bad was committed, revert it (below). Never rewrite history.

**Recover a bad commit**
```bash
git log --oneline -10 -- content/cache.json
git revert <sha>                                   # preferred, keeps history
# or restore one file from a known-good commit:
git checkout <sha> -- content/cache.json && git commit -m "Restore cache.json from <sha>" && git push
```

**Admin forgot to lock a shared machine:** clear site data for `debasisr66.github.io`, then revoke the admin token.

## Step 12 — Guardrails: tests, validation, CI and health checks (v1.2)

What they are for: catching a broken content file, a loosened security setting or a stalled sync before a visitor does.

**Run the same checks as CI, locally**
```bash
node --test tests/*.test.js          # unit tests
node scripts/validate-site.js        # content + site shell; prints OK or the exact problems
GH_TOKEN=$(gh auth token) node scripts/health-check.js    # live site + cache versus GitHub releases
```

**On GitHub**
```bash
gh workflow run ci.yml               # CI also runs by itself on every push and pull request
gh workflow run health.yml           # also runs daily at 12:00 UTC
gh run list --workflow ci.yml --limit 3
gh run list --status failure --limit 10     # what is red right now?
```

**Make failures reach you.** GitHub → Settings → Notifications → **Actions** → "Send notifications for failed workflows only" (email and/or web). If you skip this, a red run only shows in the Actions tab.

**Reading a failure** (the full symptom → fix list is in [RUNBOOK.md](RUNBOOK.md))

| Message | Meaning | Fix |
|---------|---------|-----|
| `reads.json articles[3]: url must be a clean http(s) address …` | A read has a bad, unsafe or oddly spaced link | Edit it in admin (⚙ → Edit) and publish |
| `blog.json: … is not valid JSON` | A content file was hand-edited badly | `git revert` that commit |
| `index.html: inline <script> found` | A script was put back into the page | Move it into `js/` (the CSP blocks inline scripts) |
| `index.html: CSP script-src must not allow 'unsafe-inline'` | CSP was loosened | Restore the strict policy |
| `… exceeds the …-byte budget` | A file grew a lot | Check what was added; raise the budget in `validate-site.js` only on purpose |
| `cache says v3.1, GitHub says v3.2` | The hub missed a release | `gh workflow run sync.yml`; if it recurs, check the dispatch token (Step 9 runbook) |
| `https://…/js/app.js returned 404` | Pages is down or a deploy is incomplete | `gh run list --limit 3`, wait for the Pages build |
| `index.html: style= attribute found` or `generates a style attribute` | The strict CSP forbids inline styles | Use a class in `css/site.css`, or `data-*` plus `element.style.setProperty` |
| `changelog.json[0]: items must be plain text (no markup)` | Release notes contain `<` or `>` | Rewrite as plain text |
| Admin asks for the token again | The token lives in the tab only | Expected: unlock again after closing the tab, in a new tab, or after 30 minutes idle |
| `That file isn't a usable image` / `Choose a PNG, JPEG or WebP image up to 10 MB` | The chosen file was refused (SVG, GIF, corrupt, too small, too big) | Pick a normal photo (PNG, JPEG, WebP) of at least 128 px |
| `content/profile.jpg: is not a valid JPEG` in CI | A non-JPEG was committed under that name | Re-upload through the admin screen |
| `… is not pinned by a 40-character commit hash` | A workflow uses an action by tag | Pin it by hash (copy the commit of the release) |
| `workflow "…" is disabled_inactivity` | GitHub switched a scheduled workflow off | `gh workflow enable "<name>"`, then check the keep-alive |
| Publish or a bot fails with a "repository rule violations" or "required status check" message | A ruleset is blocking a direct commit | `gh api repos/debasisr66/studio/rulesets` and delete any CI-required ruleset (only the history one should exist), then investigate |
| `Cannot force-push to this branch` / `Cannot delete this branch` | The history ruleset doing its job | Do not force-push `main`; use `git revert` |
| Dependabot opens a pull request for an action | A new version exists (the pins are by hash) | Run the workflows it touches in dry-run mode on its branch (`gh workflow run <name> --ref <branch> -f dry_run=true`), then merge if green |

**Two things that surprise people**
1. The sync bot's commits do not start CI (GitHub does not run workflows from `GITHUB_TOKEN` pushes). The daily health check covers them.
2. GitHub **disables scheduled workflows after 60 days without repository activity**. Check with `gh workflow list --all`; a stopped one shows `disabled_inactivity`. Re-enable with `gh workflow enable sync.yml`. A monthly `gh workflow run sync.yml` keeps everything alive.

**Why the cache stopped changing all day.** The sync used to store Penny's exact last-push time, so every push rewrote `cache.json` and made a commit. It now stores the date only, so a second push on the same day changes nothing. Dates such as `2026-10-19` are shown as that calendar day in every timezone.

## Step 13 — Releasing a version with release notes (v1.3 onward)

Visitors see the version in the footer and a **What's new** button. Both come from `content/changelog.json`.

1. Edit `content/changelog.json`: add a release **at the top**.
   ```json
   { "version": "1.4", "date": "2026-11-02", "title": "Short title",
     "items": ["Plain sentence a visitor would understand.", "Another one."] }
   ```
   Rules (CI enforces them): version like `1.4` or `1.4.1`, newest first, no duplicates; date `YYYY-MM-DD`; title up to 80 characters; 1–6 items of up to 160 characters; **plain text only, no links or markup**.
2. `node scripts/validate-site.js` to check it locally, then follow the release checklist in `build.md` §12.
3. Tag with the same number: `git tag v1.4 && git push origin refs/tags/v1.4`.

If you forget step 1 nothing breaks; visitors just keep seeing the previous version.

**Why the strict style rules matter.** The page's CSP no longer allows any inline style. If you add a `style="…"` attribute or a `<style>` block, CI fails with a message telling you to use a class in `css/site.css`. For a value that must be computed at runtime, put it in a `data-` attribute and apply it with `element.style.setProperty(...)` (see `paint()` in `js/app.js`).

**A refactor needs proof, not eyeballing.** For the v1.3 stylesheet move, a harness compared computed styles of every element against the previous release at three widths in two themes (see `build.md` §13). It reported 0 differences for the move itself, and the test was only trusted after it was shown to catch a deliberate 1 px change.

## Step 14 — Fonts and third parties (v1.4)

The page no longer loads anything from another site. Fonts live in `fonts/` and are declared in `css/site.css`.

- **Why:** privacy (Google no longer sees visits), resilience (no outside dependency) and a stricter security policy (`style-src` and `font-src` are `'self'` only).
- **The lesson from testing:** the first self-hosted attempt included only the Latin subset. A comparison against the previous release found a difference in Penny's release notes: the **rupee sign (₹)** is in the *Latin Extended* subset, so the browser used another font for it. Both subsets are now hosted, and CI refuses a build whose Inter faces do not cover U+20B9.
- **To change a font:** replace the file in `fonts/`, keep its licence file, run `node scripts/validate-site.js`, and compare the page against the previous release (see `build.md` §13).
- **Messages you may see:** `CSP style-src allows third-party sources` (someone added a host), `references an external resource` (a link or script from another site), `no licence file` (a font without its licence), `do not cover U+20B9` (Extended subset missing).

## Step 15 — Profile photo (v1.4)

1. Unlock admin (Step 11). A **Change photo** button appears beside "Studio by Debasis Ray".
2. Choose a PNG, JPEG or WebP image (up to 10 MB). SVG and GIF are refused on purpose.
3. A preview shows the round crop. The note says it will be public and that location and camera details are removed. Click **Use this photo**.
4. Click **Publish changes**. Two commits are made: the photo, then the manifest that shows it.
5. Visitors see it as soon as GitHub Pages rebuilds (a minute or two). Until a photo exists the page shows a monogram.

What the browser does to the file: decodes it, crops a centred square, scales to 512 × 512, and re-encodes it as a JPEG of at most 150 KB. Re-encoding drops all metadata, including GPS. The manifest (`content/profile.json`) carries a timestamp that is part of the photo's address, so a replaced photo is never served stale.

To remove the photo: set `content/profile.json` to `{"photo": null, "updated": null}`. The old image stays in git history, so do not publish a photo you would not want to remain visible there.

## Step 16 — Releasing through a pull request, and what protects `main` (v1.4)

From v1.4 a release is a pull request, so CI runs before the change reaches `main`.

```bash
git push -u origin release/vX.Y
gh pr create --base main --head release/vX.Y --title "vX.Y: summary" --body "…"
gh pr checks --watch                        # wait for the job named "check"; merge ONLY if it is green
gh pr merge --merge --delete-branch
git checkout main && git pull --rebase
git tag vX.Y && git push origin refs/tags/vX.Y
```

**What GitHub enforces on `main`:** one ruleset, "history protected": nobody, including you, can delete `main` or force-push to it. Inspect it with `gh api repos/debasisr66/studio/rulesets`.

**What is deliberately NOT enforced by GitHub: "CI must pass".** It was built and tested live, and removed. The lesson is worth keeping:

| What we tried | What happened |
|---------------|---------------|
| A ruleset requiring the CI check, with the GitHub Actions app allowed to bypass | GitHub refused: the Actions app cannot be a bypass actor on a personal repository |
| The same ruleset with only you (admin) allowed to bypass | It worked for pull requests (a red PR could not be merged normally, only with `--admin`) and for your direct pushes, **but the nightly sync and the keep-alive were rejected** ("Required status check \"check\" is expected"), because a brand-new commit has no checks yet |
| Alternatives | A personal access token for the bots (a new long-lived secret that expires and silently stops the sync); sending bot commits through pull requests (those pull requests do not trigger CI); a GitHub App (too heavy for one person) |

So CI gating is **by process** (the commands above), history is protected by GitHub, and a bad content commit from the admin screen is caught by CI afterwards (red run and email). A possible future design is to gate *deployment* instead of merging; it needs its own design.

**How the experiment was run safely** (a good pattern for any risky setting): apply it, test the thing most likely to break (the bots) straight away, keep the one-line rollback ready, and remove it before the next scheduled run. Test destructive rules (force-push, delete) on a throwaway branch with identical rules, never on `main`.

## Step 17 — Scheduled work, keep-alive and delays (v1.4)

- **Scheduled runs start late.** The 03:00 UTC sync has run between 07:26 and 08:24 UTC on every day so far. Treat cron times as approximate. The health check therefore runs at 12:00 UTC.
- **GitHub switches scheduled workflows off after 60 days without repository activity.** The weekly keep-alive adds one empty commit to `main` only when `main` has had no commit for 30 days. You will rarely see it (the sync, the admin screen and your own changes are commits too).
- **Check by hand:** `gh workflow list --all` (a stopped one shows `disabled_inactivity`), `gh workflow run keepalive.yml -f dry_run=true`. The health check also fails and names any workflow that is not active.
- **Pinned actions:** workflows refer to actions by commit hash with the version in a comment. Dependabot opens a weekly pull request when a new version exists; CI checks it like any other change.

## Command cheat sheet

```bash
# git
git status -sb                      # branch + ahead/behind
git pull --rebase                   # always before push
git push                            # never --force
git log --oneline -10
git revert <sha>
git checkout <sha> -- <file>

# gh: repo and Pages
gh repo view debasisr66/studio
gh api repos/debasisr66/studio/pages

# gh: workflows and runs
gh workflow run sync.yml -f dry_run=true
gh workflow run notify-studio.yml --repo debasisr66/<repo>
gh run list --limit 5
gh run view <id> --log

# gh: releases and secrets
gh release create vX.Y --repo debasisr66/<repo> --title "…" --notes "…"
gh release list --repo debasisr66/<repo>
gh secret set STUDIO_DISPATCH_TOKEN --repo debasisr66/<repo>
gh secret list --repo debasisr66/<repo>

# guardrails
node --test tests/*.test.js && node scripts/validate-site.js
gh run list --status failure --limit 10
gh workflow list --all

# local
GH_TOKEN=$(gh auth token) node scripts/sync-products.js
DRY_RUN=true GH_TOKEN=$(gh auth token) node scripts/sync-products.js
python3 -m http.server 8765

# live checks
curl -s -o /dev/null -w "%{http_code}\n" https://debasisr66.github.io/studio/
curl -s https://debasisr66.github.io/studio/content/cache.json | head -20
```

## Step 18 — Studio 2.0: what changes for the owner (planned; nothing here exists yet)

This step is written ahead of the build so you know what to expect. It is updated for real when each phase ships; commands marked *planned* do not work yet.

**What you will see**
- Reads has two sections, **Technical** and **Others**. When you add a read, the form asks which one. Your five current reads and the book are proposed as Technical; you confirm this before the migration.
- **Podcasts** replace **Blog**. In the admin, "Share a podcast" asks for a link and a title, with optional show name, short take and tags. The old blog editor goes away.
- The page order becomes Products, Updates, Reads, Podcasts, the same for everyone. (An earlier idea, ordering sections by what each visitor uses, was dropped: Studio has no analytics and stores nothing about visitors.)

**How each piece is built and checked (the method you already know)**

| Phase | Where to read | What to run (planned where marked) |
|-------|---------------|------------------------------------|
| Specs and impact | `docs/specs/*`, `docs/impact.md` | read and answer the open questions in `docs/plan.md` |
| Plan | `docs/plan.md` | follow the ten steps in order |
| Design | `docs/design.md` §12 | diagrams render on GitHub |
| Build and test | `docs/build.md` §18, `docs/test.md` v2.0 | `node --test tests/*.test.js`, `node scripts/validate-site.js`, `node scripts/smoke.js` (exists since SH Phase A) |
| Security | `docs/security.md` §11 | the checklist in §11.3 |
| Release | `docs/build.md` §18.5 | PR, green checks, merge, tag `v2.0`, verify live |
| Roll back | `docs/build.md` §18.6 | `git revert -m 1 <merge sha>`; tag `v1.5` is the safe point |

**Your decisions before building** are listed in `docs/plan.md` ("Owner decisions needed"). **Your hands-on steps at release:** publish one real read and one real podcast with the admin token (Step 9 B), confirm the seed podcast links, and try the page on a real phone.

**New terms:** *smoke test* (a small automatic check that the page really renders), *schema version* (a number in a content file that says which shape it has), *contract* (the written list of fields each content file may contain).

