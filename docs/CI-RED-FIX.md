# CI Red Fix

What to do when CI is red on `main`. Since v2.0 this arrives by email as a GitHub issue titled **CI is red on main** (the steps below are copied into it), and the daily health check also names it. Nothing blocks a red merge, so this guide is the safety net. See [RUNBOOK](RUNBOOK.md#ci-is-red-on-main) and the [protection decision](rulesets/README.md#decision-record).

## What it means

The newest finished CI run on `main` failed. The live site may or may not be affected: Pages publishes `main` regardless of CI. First find out which.

<!-- steps:start -->
1. **Is the live site broken?** Open https://debasisr66.github.io/studio/ and run `GH_TOKEN=$(gh auth token) node scripts/health-check.js`. If the site is broken for visitors, revert first (step 4) and investigate after.
2. **Find the failing step.** `gh run list --workflow ci.yml --branch main --limit 3`, then `gh run view <run-id> --log-failed`. The step name tells you the kind of failure (table below).
3. **Flake or real?** If the log says "Chrome did not report a DevTools address", a timeout with no failing case, or a network error, rerun it once: `gh run rerun <run-id> --failed`. Green on rerun means a flake; note it. Red again means real.
4. **Fix forward or revert.** A small, clear fix goes in a pull request with its test first. Otherwise undo the change that caused it: `git revert -m 1 <merge-commit>` on a branch, pull request, green CI, merge. Never force-push `main`.
5. **Confirm.** CI green on `main`, `node scripts/health-check.js` says HEALTHY, and this issue closes itself on the first green run (close it by hand if it does not).
<!-- steps:end -->

## Which kind of failure

| Failing step | Likely cause | First move |
|--------------|--------------|-----------|
| Unit tests (`node --test`) | A code or doc change broke a test; a docs link points nowhere | Read the failing test name; fix the code or the link |
| Validator (`node scripts/validate-site.js`) | A content file or workflow broke a rule: bad address in `reads.json` or `podcasts.json`, a changelog item too long, a size budget, an unpinned action | The message names the file and rule; the runbook section "CI rejects content" lists each rule |
| Browser smoke test | A real page regression, or a flake (Chrome did not start, a timing case) | Run `node scripts/smoke.js` locally; `SMOKE_ONLY="<case id>"` runs one case; rerun once in CI if it looks like a flake |
| Smoke watchdog ("did not finish within 110 s") | The run is slow or a case hangs | Rerun once; if it repeats, trim cases (see docs/test.md section T) before adding more |
| Setup (checkout, Node) | GitHub outage | Rerun later; check githubstatus.com |

## If the red commit came from the admin screen

A content publish from the owner tools (reads or podcasts) commits straight to `main`. CI then rejects it afterwards. Fix the entry in the admin screen and publish again, or `git revert <commit>` for that one commit (see RUNBOOK "Bad commit on main").

## Why this is an alarm and not a lock

GitHub cannot require CI on this repository without stopping the nightly sync and the keep-alive bots (decision recorded in `docs/rulesets/README.md`). So the rule is: merge only after `gh pr checks` is green, and this alert catches the cases that slip through.

## How the alert works

The Health check workflow runs when CI finishes on `main` (and daily as a backstop). If the newest finished run failed it opens one issue with these steps (GitHub emails new issues), adds a comment while CI stays red, and closes the issue when CI is green again. It needs only `issues: write` on top of its read access. If the email does not arrive, check GitHub's notification settings for this repository (Watching: All activity or Issues).
