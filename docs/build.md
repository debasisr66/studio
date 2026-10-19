# Build and Publish — Command Reference

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
git checkout -b v1.1
```

## 3. Test locally

```bash
node --test tests/*.test.js                  # unit tests (16)
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
