# Branch rulesets for `main`

Two rulesets, kept here so they are reviewable and re-creatable. Why two, and who can do what: `docs/design.md` §11.4.

| File | What it does | Bypass |
|------|--------------|--------|
| `history.json` | No deletion of `main`, no force-push | **None**: applies to everyone, including the owner |
| `ci.json` | Required status check `check` (the CI job) | Repository admin role (id 5: the owner's token, which the admin screen uses) and the GitHub Actions app (id 15368: the sync and keep-alive bots) |

```bash
# apply
gh api -X POST repos/debasisr66/studio/rulesets --input docs/rulesets/history.json
gh api -X POST repos/debasisr66/studio/rulesets --input docs/rulesets/ci.json

# inspect
gh api repos/debasisr66/studio/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'

# roll back (instantly restores the previous behaviour)
gh api -X DELETE repos/debasisr66/studio/rulesets/<id>
```

The owner can bypass the CI ruleset on purpose: the admin screen publishes straight to `main` with the owner's token and must keep working. That is the documented trade-off, not an oversight.
