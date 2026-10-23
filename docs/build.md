# Build and Publish — Command Reference

Current release line: **v1.6** (an intermediate release on the way to v2.0, whose build is §18); v1.5, v1.4 and v1.3 are tagged. From v1.4 releases go through a **pull request** (see §15). Branch names must differ from tag names: a branch called `v1.1` and a tag `v1.1` made `git push origin v1.1` ambiguous (fix: `git push origin refs/tags/v1.1`).

Reference only. There is no build step: the repository is the site. Pages serves `main`, root `/`. Run from `/Users/debasisray/CoworkProjects/studio-site`.

## 1. Before you start

```bash
git status -sb                      # clean? ahead or behind?
git pull --rebase                   # the nightly sync bot commits cache.json
gh auth status
```

## 2. Work on a branch

```bash
git tag v1.0 && git push origin v1.0        # rollback point (done once per release)
git checkout -b release/v1.4               # never reuse a tag name for a branch
```

## 3. Test locally

```bash
node --test tests/*.test.js                  # unit tests (45)
node scripts/validate-site.js                # content + site checks (same as CI)
GH_TOKEN=$(gh auth token) node scripts/health-check.js   # live site + cache vs GitHub releases
node --check js/app.js                       # syntax check
python3 -m http.server 8765                  # then open http://localhost:8765/
pkill -f "http.server 8765"                  # stop it

# nothing protected may change:
git diff main --stat -- .github scripts content/products.json content/blog.json content/reads.json docs/notify-studio.yml

# sync still works (writes nothing):
DRY_RUN=true GH_TOKEN=$(gh auth token) node scripts/sync-products.js
```

## 4. Commit

Stage explicit paths, so stray local files are never swept in:

```bash
git add index.html js tests docs
git commit -m "v1.1: <summary>"
```

## 5. Merge and publish

```bash
git checkout main
git pull --rebase
git merge --no-ff v1.1
git push
```

## 6. Verify the deploy

```bash
gh run list --limit 3                                          # "pages build and deployment" → success
curl -s -o /dev/null -w "%{http_code}\n" https://debasisr66.github.io/studio/
curl -s https://debasisr66.github.io/studio/js/app.js | head -3
gh workflow run sync.yml -f dry_run=true && gh run list --workflow sync.yml --limit 1
```

Then hard-refresh the live site and run the smoke checklist in [test.md](test.md) §6.

## 7. Tag the release

```bash
git tag v1.1
git push origin v1.1
```

## 8. Roll back

```bash
git revert -m 1 <merge-commit-sha>           # undo the merge, keep history
git push

# or restore the old UI files from the tag:
git checkout v1.0 -- index.html
git rm -r js
git commit -m "Roll back to v1.0 UI"
git push
```

Never force-push. Never rewrite the sync bot's commits.

## 9. Day-to-day

```bash
# add a product: edit content/products.json, then
GH_TOKEN=$(gh auth token) node scripts/sync-products.js
git add content && git commit -m "Add <product>" && git pull --rebase && git push

# trigger a hub sync by hand
gh workflow run sync.yml

# test the Penny → Studio notification
gh workflow run notify-studio.yml --repo debasisr66/PennyExpenseManager
gh run list --repo debasisr66/studio --workflow sync.yml --limit 2

# publish a Penny release (what Updates shows)
gh release create vX.Y --repo debasisr66/PennyExpenseManager --title "Penny X.Y" --notes "- change"

# tokens
gh secret list --repo debasisr66/PennyExpenseManager
gh secret set STUDIO_DISPATCH_TOKEN --repo debasisr66/PennyExpenseManager    # paste at the prompt
```

Token scopes and the rotation runbook are in [LEARNING-GUIDE.md](LEARNING-GUIDE.md) (Step 9 and "Runbook").

## 10. Admin publishing (in the browser)

1. Create a fine-grained token: only `debasisr66/studio`, **Contents: Read and write**.
2. Open the site, click ⚙, paste the token, Unlock.
3. Reads → **Share a read…** → fill in → **Post** → **Publish changes**.
4. Wait 1–2 minutes for Pages, then refresh. **Lock & sign out** when done (it also locks itself after 30 minutes idle).

## 11. Guardrails (v1.2)

```bash
# run exactly what CI runs
node --test tests/*.test.js && node scripts/validate-site.js

# run the workflows on GitHub by hand and read the result
gh workflow run ci.yml
gh workflow run health.yml
gh run list --workflow ci.yml --limit 3
gh run list --workflow health.yml --limit 3
gh run view <run-id> --log

# anything failing right now?
gh run list --status failure --limit 10

# keep scheduled workflows alive (GitHub disables them after 60 days without repository activity)
gh workflow run sync.yml && gh workflow run health.yml
gh workflow list --all                      # a disabled workflow shows as "disabled_inactivity"
gh workflow enable sync.yml                 # re-enable if needed
```

Failure emails: GitHub → Settings → Notifications → **Actions** → enable "Send notifications for failed workflows only" (email and/or web). Without it, red runs are only visible in the Actions tab and with `gh run list --status failure`.

Merge steps for a release: see §5–7. Tag with the full ref if a branch of the same name exists: `git push origin refs/tags/v1.2`.

## 12. Release checklist (v1.3 onward)

1. Branch `release/vX.Y` from an up-to-date `main`.
2. Write or update impact → plan → design before building.
3. Build test-first; keep `node --test tests/*.test.js` and `node scripts/validate-site.js` green.
4. **Add the release to `content/changelog.json`** (newest first; plain text; 1–6 items; no links or markup). CI rejects a malformed file. This is what the footer version and the What's new button show.
5. Run the checks in `test.md`, including the security checklist in `security.md`.
6. Update every artefact (plan, impact, design, test, build, model-use, security, architecture, learning guide, README).
7. Ask for approval, merge with `--no-ff`, push, confirm CI, Pages and a manual health run are green.
8. Tag with the version in the changelog, using the full ref: `git push origin refs/tags/vX.Y`.

## 13. Visual comparison against a previous release (optional harness)

Used in v1.3 to prove a refactor changed nothing. It lives outside the repo (scratch area), not in version control:

```bash
mkdir -p /tmp/vr/base && git archive v1.2 | tar -x -C /tmp/vr/base     # frozen previous release
mkdir -p /tmp/vr/new  && cp -R index.html css js content /tmp/vr/new/   # current tree
cp -R content /tmp/vr/base/content                                       # same data in both
# serve /tmp/vr, load both in same-origin frames at 375/768/1280 px (dark, light), compare computed styles per element
```

Normalise the scroll-spy `aria-current` attribute before comparing (it depends on timing), and prove the harness can fail with a deliberate change made through script (a style element is blocked by the strict CSP).

## 14. Admin session notes (v1.3)

The admin token now lives in the tab only: unlock again after closing the tab, in a new tab, or after 30 minutes idle. After upgrading from v1.2 the old stored token is deleted, so unlock once.

## 15. Release by pull request (v1.4 onward)

CI gets a real run before anything reaches `main`. GitHub does not enforce "CI must pass" (see §16), so the rule is: merge only after `gh pr checks` is green.

```bash
git push -u origin release/vX.Y
gh pr create --base main --head release/vX.Y --title "vX.Y: summary" --body "What changed, what was tested, what is pending"
gh pr checks --watch                               # waits for the CI job named "check"
gh pr merge --merge --delete-branch                # merge commit keeps the history readable; blocked if CI is not green
git checkout main && git pull --rebase
git tag vX.Y && git push origin refs/tags/vX.Y     # full ref: never ambiguous with a branch name
```

Never merge a red pull request: nothing technical stops you, so the discipline is the control.

## 16. Branch protection

One ruleset is in force (definition in `docs/rulesets/history.json`): no deletion and no force-push on `main`, for everyone. A CI-required ruleset was tested and **not applied** because it blocks the sync and keep-alive bots (`docs/rulesets/README.md`, `docs/design.md` §11.4).

```bash
gh api repos/debasisr66/studio/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'      # should list only: main: history protected
gh api repos/debasisr66/studio/rules/branches/main --jq '.[].type'                              # deletion, non_fast_forward
gh api -X DELETE repos/debasisr66/studio/rulesets/<id>                                          # remove one (rollback)
```

If a bot or the admin screen ever fails with a "repository rule violations" message, delete any ruleset that is not the history one, then investigate.

CI gating is by process: merge a pull request only after `gh pr checks` is green (§15). Dependabot pull requests are checked the same way, and the workflows they change can be run in dry-run mode on their branch first:

```bash
gh workflow run sync.yml --ref <dependabot-branch> -f dry_run=true
gh workflow run keepalive.yml --ref <dependabot-branch> -f dry_run=true
gh workflow run health.yml --ref <dependabot-branch>
```

## 17. Keep-alive, fonts, photo

```bash
# keep-alive (weekly by itself); manual runs
gh workflow run keepalive.yml -f dry_run=true       # reports only
gh workflow run keepalive.yml -f force=true         # adds one empty commit now
node scripts/keepalive.js                           # decision locally (reads the last commit date)

# health now includes workflow states; it runs at 12:00 UTC daily
gh workflow run health.yml && gh workflow list --all

# fonts: replace a file, keep its licence, then
node scripts/validate-site.js                       # enforces licences, size, rupee coverage, no third-party hosts

# visual comparison, sweep many widths (not three): see section 13; include 621-860 px
```

Photo: owner unlocks admin → **Change photo** → choose a PNG, JPEG or WebP → **Use this photo** → **Publish changes**. Two commits appear: `cms: update profile photo` and `cms: show profile photo`. To remove the photo, set `content/profile.json` back to `{"photo": null, "updated": null}` (the old image stays in git history).

## 18. Studio 2.0 build and release flow (in progress; commands marked "planned" do not exist yet)

Reference for the sequence in [plan.md](plan.md). Rollback tag: `v1.5`. Each phase is one branch and one pull request (§15). Branch names must differ from tag names.

### 18.1 Start of every phase

```bash
cd /Users/debasisray/CoworkProjects/studio-site
git checkout main && git pull --rebase
git checkout -b v2/<spec>-<phase>          # e.g. v2/sh-a, v2/rc-a, v2/pc-b, v2/ux-b
node --test tests/*.test.js                # baseline must be green (235 after PC Phase B)
node scripts/validate-site.js              # OK, 0 errors
```

### 18.2 Test-first loop

```bash
node --test tests/<new>.test.js            # show the new tests failing first
# build until green, then:
node --test tests/*.test.js && node scripts/validate-site.js
node scripts/smoke.js                      # real since SH Phase A: local server + headless Chrome over DevTools, 111 cases, ~70 s locally and about half that in CI (set SMOKE_ONLY="text" to run matching cases, never in CI; CHROME_BIN to choose a browser; SMOKE_WATCHDOG_MS bounds the run, default 110 s; cases slower than 2 s print their time)
python3 -m http.server 8080                # manual look at http://localhost:8080 at 375 and 1280 px, both themes
```

### 18.2b Phone preview before merge (SPEC-QA; sandbox)

```bash
rm -rf /tmp/sbx-out && node scripts/make-sandbox.js . /tmp/sbx-out        # site files only, admin pointed at the sandbox repository, title "SANDBOX · …"
git clone https://github.com/debasisr66/studio-sandbox.git /tmp/sbx-repo
cp -R /tmp/sbx-out/. /tmp/sbx-repo/ && cd /tmp/sbx-repo && git add -A && git commit -m "Sandbox copy of <branch>" && git push
# live in about a minute at https://debasisr66.github.io/studio-sandbox/ (separate token limited to that repository; never the real token)
```
The sandbox is a throwaway copy: it can be overwritten at any time and nothing in it is authoritative. Delete its token when the phase is done.

### 18.3 One-time data migration (RC Phase A; done 2026-10-22, PR #14)

Done as one commit with the code. The scripts below were **not** written; the migration was a one-off edit, and the before/after proof is a permanent test (`tests/spec-rc-phase-a.test.js`, `TC-RC-M01` to `M03`) against two frozen fixtures, `tests/fixtures/reads-before-rc-a.json` and `reads-after-rc-a.json`. Tests must never compare against the live `content/` files: the owner publishes at any time. The block shows the originally planned shape.

```bash
cp content/reads.json /tmp/reads.before.json
node scripts/migrate-reads-v2.js           # planned: adds category (owner-confirmed list) and schema_version
node scripts/compare-reads.js /tmp/reads.before.json content/reads.json   # planned: ids, urls, titles, comments, tags, kinds identical
git add content/reads.json && git commit -m "content: add category and schema_version to reads (v2 migration)"
```
The migration scripts are throwaway tools run once; they live in the PR for review and are removed after the release, or kept under `scripts/` only if the owner wants.

### 18.4 Pull request per phase (same as §15)

```bash
git push -u origin v2/<spec>-<phase>
gh pr create --base main --title "v2.0 <spec> <phase>: summary" --body "Spec, requirements covered, tests (counts), what was verified, what is pending"
gh pr checks --watch
gh pr merge --merge --delete-branch        # only when green and the owner approved
git checkout main && git pull --rebase
```
After each merge: `gh run list --limit 4`, open the live site, `GH_TOKEN=$(gh auth token) node scripts/health-check.js`.

### 18.5 Release (after step 9 of the plan)

```bash
git checkout main && git pull --rebase
node --test tests/*.test.js && node scripts/validate-site.js           # final gate
git tag -a v2.0 -m "v2.0: stabilised core, Reads split, Podcasts, simpler layout"
git push origin refs/tags/v2.0
gh run list --limit 4
curl -s https://debasisr66.github.io/studio/content/changelog.json | head -20    # confirms the 2.0 entry is live
```
The changelog entry (`content/changelog.json`, version `2.0`) and the artefact updates are part of the final release PR, not earlier phases, so visitors see "What's new" only when 2.0 is real.

### 18.6 Rollback

```bash
git revert -m 1 <merge-commit-of-the-phase-or-release>    # preferred, keeps history
git push
# or inspect the previous release without changing anything:
git diff v1.5 -- index.html js css content/reads.json
```
Because data changes are additive, v1.5 code renders the migrated `reads.json`; `blog.json` is intact; the stored layout key is ignored by old code. Never force-push (ruleset forbids it).

### 18.7 Draft release notes (not committed to content until the release PR)

Changelog entry draft for `content/changelog.json` (plain text, at most 6 items, 160 characters each):
- "Reads now has two sections, Technical and Others."
- "The Blog is now Podcasts: links to podcasts and episodes worth hearing."
- "The page is simpler: one clear order and the same navigation on every screen."
- "The page is more dependable: one part failing no longer affects the rest."

