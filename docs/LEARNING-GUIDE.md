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

1. Add an entry to `content/products.json`. For a site-style product add `"url": "https://…"` and a `category`.
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

Two tokens, deliberately separate:

| Token | Purpose | Where created | Scope | Stored where |
|-------|---------|---------------|-------|--------------|
| **Dispatch token** → secret name `STUDIO_DISPATCH_TOKEN` | Lets a product repo trigger the hub sync | Fine-grained PAT | Repository access: **only `debasisr66/studio`**; permission **Contents: Read and write** (Metadata read is automatic) | GitHub Actions secret in **each product repo** |
| **Admin (CMS) token** | Lets the ⚙ admin publish blog/reads | Fine-grained PAT | Only `debasisr66/studio`; **Contents: Read and write** | Browser `localStorage('studio-admin-pat')` only |

Important correction: the permission is **Contents**, not "Actions". GitHub's dispatch API (`POST /repos/{owner}/{repo}/dispatches`) requires Contents write. If the permission dialog has no "Actions" entry that is why.

**Create a token:** profile picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token (https://github.com/settings/personal-access-tokens/new).
1. Token name, e.g. `studio-dispatch`; Expiration (e.g. 1 year).
2. Resource owner `debasisr66`.
3. Repository access: **Only select repositories** → tick `studio`.
4. Permissions → Add permissions → **Contents** → Read and write.
5. Generate token. **The value is shown once.** Copy it straight into the next command's prompt.

**If Generate does nothing:** scroll to the top for a validation error (name, expiry, repo not actually selected, no permission added); hard-refresh; try a private window or disable extensions; check for a hidden password/2FA prompt.

**Store the dispatch secret** (paste at the prompt so it never enters shell history):
```bash
gh secret set STUDIO_DISPATCH_TOKEN --repo debasisr66/PennyExpenseManager
gh secret list --repo debasisr66/PennyExpenseManager      # shows the name and updated time, never the value
```
Secrets UI: repo → Settings → Secrets and variables → Actions.

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

1. Create the admin token (Step 9, name e.g. `studio-admin`).
2. Open the site → click ⚙ → paste the token → Unlock (it is validated against `GET /user`).
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

# local
GH_TOKEN=$(gh auth token) node scripts/sync-products.js
DRY_RUN=true GH_TOKEN=$(gh auth token) node scripts/sync-products.js
python3 -m http.server 8765

# live checks
curl -s -o /dev/null -w "%{http_code}\n" https://debasisr66.github.io/studio/
curl -s https://debasisr66.github.io/studio/content/cache.json | head -20
```
