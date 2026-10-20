# Branch rulesets for `main`

## In force: `history.json`

**No deletion of `main` and no force-push, for everyone including the owner** (no bypass).

```bash
gh api -X POST repos/debasisr66/studio/rulesets --input docs/rulesets/history.json     # apply
gh api repos/debasisr66/studio/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'  # inspect
gh api -X DELETE repos/debasisr66/studio/rulesets/<id>                                    # roll back
```

## Tried and deliberately NOT applied: `not-applied/ci-required.json`

A ruleset requiring the CI check (`check`) on `main`. It was applied temporarily on 2026-10-20 and tested, then removed. What the tests showed:

| Who does what | Result under the CI ruleset |
|---------------|-----------------------------|
| Owner merges a pull request whose CI is red, normally | **Refused**: "the base branch policy prohibits the merge" (only an explicit `--admin` overrides it) |
| Owner (admin) pushes straight to `main` | Allowed (admin bypass), so the admin screen would still publish |
| **The sync and keep-alive bots push straight to `main`** | **Rejected**: "Required status check \"check\" is expected" (a brand-new commit has no checks yet) |

The bots cannot be allowed through: GitHub does not accept the GitHub Actions app as a bypass actor on a personal repository ("must be part of the ruleset source or owner organization"). Keeping the rule would stop the nightly sync and the keep-alive.

Options that were rejected: a personal access token as a repository secret for the bots (a new long-lived secret that would also expire and silently stop the sync); routing bot commits through pull requests (pull requests opened by the default token do not trigger CI); a GitHub App (heavy for a one-person site).

**Decision:** protect history for everyone (in force), and keep CI gating **by process**: releases go through a pull request and are merged only after `gh pr checks` is green. A possible future improvement is to make CI gate *deployment* instead of merging (Pages deployed by a workflow that runs CI first), which would also protect against a bad commit from the admin screen; it needs its own design because the bots' pushes do not trigger push workflows.
