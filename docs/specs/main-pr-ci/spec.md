# SPEC-MP — Pull requests and CI enforced on `main` (Studio)

**Status:** APPROVED 2026-11-18 — D1 **B**, D2 **strict**, D3 **admin bypass**, D4 **pin to Actions**, D5 **auto-delete on**, D6 **all methods** (owner's decisions, all as recommended). Independent review folded in (§13) · **Date:** 2026-11-18 · **Repo:** `debasisr66/studio` (public, user-owned)
**Goal:** match Penny's `main` (PR required, `check` green and up to date, no force-push or deletion, 0 approvals, merged branches deleted) **without breaking** the three direct writers to `main`, above all the Penny → Studio sync.

---

## 1. Bottom line

Recommend **Option B: a private GitHub App ("studio-bot") owned by you, installed on `studio` only, with Contents: read and write.** Sync and keep-alive mint a 1-hour token from it and push; the App and the repo-admin role are the only bypass actors on a **new** ruleset that requires a PR and `check`. The existing history ruleset stays untouched, so force-push and deletion remain blocked for everyone, including the App and you.

Side benefits: the workflows' built-in `GITHUB_TOKEN` drops to **read-only**, and bot commits start triggering CI (today they do not, because `GITHUB_TOKEN` pushes never start workflows).

This reverses the 2026-10-20 decision in `docs/rulesets/README.md`, which rejected an App as "heavy for a one-person site". What changed: you now want Penny parity. Cost is a one-time ~10-minute setup and one long-lived secret (the App private key).

## 2. Current state (verified 2026-11-17/18)

| Item | State |
|---|---|
| Ruleset 25458711 "main: history protected" | active; `deletion` + `non_fast_forward`; **no bypass**; target `~DEFAULT_BRANCH` |
| Classic branch protection | none |
| Pages | legacy, `main` `/` |
| CI | `ci.yml` job **`check`** on push to main, every PR, manual |
| Repo settings | merge, squash, rebase all allowed; `delete_branch_on_merge` **false** |
| Writer 1: `sync.yml` | `GITHUB_TOKEN` `contents: write`; commits `content/cache.json`, `git push`; daily 03:00 UTC, `repository_dispatch: product-updated` (Penny), manual |
| Writer 2: `keepalive.yml` | `GITHUB_TOKEN` `contents: write`; empty commit only if `main` idle ≥ 30 days (or `force`) |
| Writer 3: CMS (`js/app.js`) | Contents API `PUT` to `main` with **your** token; you are repo admin |
| Guardrail | `scripts/validate-site.js` allows `contents: write` only in `sync.yml`, `keepalive.yml` |
| Prior test (2026-10-20) | CI-required ruleset rejected bot pushes; GitHub refused the **GitHub Actions** app as a bypass actor on a personal repo ("must be part of the ruleset source or owner organization") |

## 3. Facts checked against GitHub Docs (2026-11-18)

| # | Claim | Source | Status |
|---|---|---|---|
| F1 | Bypass list may include repository admins, write/maintain roles, **GitHub Apps**, Dependabot | Docs: Creating rulesets for a repository | Documented |
| F2 | REST `actor_type`: Integration, OrganizationAdmin, RepositoryRole, Team, **DeployKey**, User; `bypass_mode`: `always`, `pull_request`, `exempt`; `pull_request` not valid for DeployKey | REST: Repository rules | Documented |
| F3 | The GitHub Actions app / `GITHUB_TOKEN` as a bypass actor | not documented | **Refused in our own 2026-10-20 test** |
| F4 | Your own App installed on your repo is accepted as a bypass actor | inferred from F1 + the refusal text | **Unverified — proven at step 4 of the rollout with the ruleset in `disabled` mode (no effect) before it goes live** |
| F5 | Deploy keys as bypass: in the API enum, not in the UI's list | REST vs Docs page | Documented in API only |
| F6 | `GITHUB_TOKEN` events do not start workflows (except `workflow_dispatch`, `repository_dispatch`) | Docs: GITHUB_TOKEN | Documented |
| F7 | App-token pushes **do** start push workflows | Docs: GITHUB_TOKEN (recommends an App token when you want follow-on runs) | Documented; also observed at step 4 |
| F8 | Required check can be pinned to a source app (`integration_id`); `strict` = branch must be up to date | REST + Available rules | Documented |
| F9 | `evaluate` (dry-run) mode is GitHub Enterprise only | REST | Documented — so we use `disabled` as the safe staging mode |

## 4. Options

| | A. Keep history only (status quo) | **B. GitHub App bypass (rec.)** | C. Deploy key bypass | D. Move the cache off `main` |
|---|---|---|---|---|
| What | No change; CI gating by process | App token for bots; App + admin bypass new PR+CI ruleset | SSH deploy key (write) as secret; DeployKey bypass | Sync writes cache to a release asset; site/health read it; keep-alive via API |
| PR + `check` enforced for others | No | **Yes** | Yes | Yes (bots no longer write `main`) |
| Sync/Penny path | unchanged | token source changes only | checkout via SSH | rewritten |
| New secret | none | App private key (no expiry, revocable, repo- and contents-scoped, mints 1 h tokens) | SSH private key (no expiry, write to whole repo) | none |
| Bot commits run CI | No | **Yes** | Yes | n/a |
| `GITHUB_TOKEN` | write | **read-only** | read-only | read-only |
| Attribution | github-actions[bot] | `studio-bot[bot]` | none (any key holder) | n/a |
| Doc support | — | UI + API | API only (F5) | — |
| Effort / risk | none | ~10 min your setup + small PR | small; less mature path | **large; touches site, health, smoke, validator (freeze-list items)** |
| Rollback | — | delete 1 ruleset | delete 1 ruleset | revert large PR |

Also rejected again: a PAT secret (expires, user-wide scope); bot PRs with auto-merge (`GITHUB_TOKEN` PRs do not run CI; would still need an App).

**Why B over C:** same blast radius, but B is UI-documented, short-lived tokens, named audit trail, and the key can be revoked in one place. C saves the App setup but relies on an API-only bypass type and gives no attribution.

## 5. Decisions needed

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Approach | A / **B** / C / D | **B** |
| D2 | Require branch up to date (`strict`) | yes (Penny parity) / no | **Yes.** Cost: PRs open across a sync need "Update branch" (sync commits most days). |
| D3 | CMS path | **admin bypass `always`** / route CMS through PRs | **Admin bypass.** CMS unchanged. Trade-off: your own direct pushes also skip CI, exactly as today; CI now runs on them afterwards. |
| D4 | Pin `check` to GitHub Actions (`integration_id` 15368) | yes / no | **Yes**, so no one can fake a green `check` with a commit status. |
| D5 | Turn on "Automatically delete head branches" | yes / no | **Yes** (Penny parity). |
| D6 | Merge methods allowed by the PR rule | all three / squash+merge | **All three** (no behaviour change). |

## 6. Design (Option B)

**New ruleset `main: PR + CI`** (file `docs/rulesets/pr-ci.json`; history ruleset untouched):
- target `~DEFAULT_BRANCH`; rules: `pull_request` (0 approvals, all review toggles off, merge methods per D6) and `required_status_checks` (`check`, integration 15368, `strict` per D2).
- bypass: `RepositoryRole` 5 (admin) `always`; `Integration` <studio-bot App ID> `always`.

**Secret placement:** the key and App ID live in a GitHub **Environment `studio-bot`** restricted to the `main` branch, not as plain repo secrets. Only jobs declaring `environment: studio-bot` that run from `main` can read it; a workflow on any other branch cannot (reviewer M1). The App is never given the `workflows` permission, so it cannot change workflow files.

**Workflows** (`sync.yml`, `keepalive.yml`) — token minted **late and only when needed** (reviewer H2):
- checkout stays on the default token, with `persist-credentials: false`; `permissions: contents: read`.
- fetch / decide steps unchanged (sync keeps `GH_TOKEN: GITHUB_TOKEN` for reading products; `!cancelled()` isolation kept).
- new step `actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510 # v3.3.0` (`permission-contents: write`), with the **same `if:`** as the commit step. So a dry run or a no-change run needs no secret, and a key problem cannot fail the fetch.
- push via explicit remote with the token in `env:`: `git push "https://x-access-token:${TOKEN}@github.com/${GITHUB_REPOSITORY}.git" HEAD:main`. Token never written to `.git/config`, never present while `sync-products.js` runs.
- sync: one `git pull --rebase` and retry if the push is refused as non-fast-forward (a CMS commit landed mid-run; today this just fails).
- commit identity becomes `studio-bot[bot]`.

**Validator and tests** (reviewer M6):
- `WRITE_ALLOWED` becomes empty: no workflow may hold `contents: write`. Error text updated.
- rewrite `tests/validate-site.test.js:305-310` (today it asserts sync/keepalive *may* have write) to assert they are refused.
- new checks: real `sync.yml` and `keepalive.yml` declare `contents: read`; only those two reference `STUDIO_BOT_PRIVATE_KEY`, and only with `environment: studio-bot`.

**Docs that become false and are corrected** (reviewer M5): `ci.yml:4` comment, `health-check.js` comments, `docs/rulesets/README.md` (decision superseded), `RUNBOOK.md` (new: "sync push rejected", "check deadlock → admin bypass", "CI red on a bot commit"), `OPERATIONS.md` (App key rotation), and the "bot pushes don't trigger CI / CI not required" lines in `ARCHITECTURE.md`, `design.md`, `impact.md`, `security.md`, `LEARNING-GUIDE.md`. Tests are grepped for these strings first.

**Behaviour change, accepted:** bot commits now run CI; a failing bot commit opens the existing "CI is red on main" issue (the next green run closes it). Pages still publishes `main` whatever CI says — same as today.

## 7. Freeze list (must not change) and the check that proves it

| Frozen | Proof |
|---|---|
| Ruleset 25458711 JSON | `gh api …/rulesets/25458711` diff before/after = empty (bar `updated_at`) |
| Pages config | `gh api …/pages` before/after identical |
| `scripts/sync-products.js`, `scripts/keepalive.js`, `content/cache.json` schema | PR diff touches none of them (`git diff --stat` file allow-list) |
| CMS `js/app.js`, site files | not in PR diff |
| Penny `notify-studio.yml`, `STUDIO_DISPATCH_TOKEN` | not touched (different repo) |
| `ci.yml` job name `check` | unchanged in diff |

## 8. Rollout (each ⚑ = your explicit approval)

1. ⚑ Merge this spec via PR (normal PR, gate not yet live).
2. ⚑ **You** create and install the App, create Environment `studio-bot` (branch `main` only), add the variable and secret there (§10). I confirm the environment, variable and secret exist (names only, via API). The key itself can only be exercised from `main`, so it is proven in step 4, straight after the step-3 merge (reviewer H4).
3. ⚑ PR: workflows + validator + tests + docs + `pr-ci.json`. CI green; Opus review; merge **between 12:00 and 22:00 UTC** (well clear of the 03:00 sync, which GitHub starts up to ~09:00 UTC).
4. Immediately, gate still off (reviewer H1): keep-alive `force=true` (deterministic push), then ⚑ a one-line PR lowering Penny's `stars` in `content/cache.json` so the next sync **must** push, then dispatch `product-updated`. Pass = both push as `studio-bot[bot]`, sync's commit touches only `content/cache.json`, and CI ran on both pushes. If either fails: revert the step-3 PR at once (sync is back on `GITHUB_TOKEN`, no gate yet).
5. ⚑ Create ruleset with `enforcement: disabled`; confirm the Integration actor's `actor_id` is the **App ID** (not the installation ID) — proves the actor is accepted (F4, partial). ⚑ Set `active` in the same quiet window, then **at once** repeat step 4 (force keep-alive + forced-diff sync) to prove the bypass works live (reviewer H3). Rollback command ready; I do not leave until both are green. ⚑ Turn on branch auto-delete (D5).
6. Remaining acceptance tests (§9). Record results in `docs/rulesets/README.md` via a final PR.

If step 5 refuses the App or a live push is rejected: delete the new ruleset (one command), sync carries on with the App token unaffected; then decide between C and A.

## 9. Acceptance tests (done = all pass)

| ID | Test | Expected |
|---|---|---|
| T1 | With cache made stale (step 4 PR), `gh api repos/debasisr66/studio/dispatches -f event_type=product-updated` | run `event` = `repository_dispatch`, green; commit by `studio-bot[bot]` touching only `content/cache.json`. A green run with "No changes" does **not** pass. |
| T1b | Penny's own path | Penny's latest `notify-studio` run green (proves `STUDIO_DISPATCH_TOKEN`); or, after the next Penny release, the triggered Studio sync commits |
| T2 | `gh workflow run sync.yml` after a forced diff | green; push accepted |
| T3 | `gh workflow run keepalive.yml -f force=true` | one empty commit by `studio-bot[bot]`; run right after activation |
| T4 | **One real CMS publish** from the browser with your saved token (a small reads edit) | accepted; the commit is yours ("cms: update …"); token owner = you (admin) |
| T5 | Non-bypass push: throwaway branch whose workflow (`contents: write`, `GITHUB_TOKEN`) pushes an **empty commit on top of `main`'s tip** to `main` | **rejected with `GH013` / "must be made through a pull request" / "check is expected"**; any other error = inconclusive. Branch deleted. (Its CI goes red by design — validator.) |
| T6 | PR whose `check` fails | merge blocked |
| T7 | Strict: PR green, then a bot commit lands on `main` | merge blocked as out of date until "Update branch" (D2) |
| T8 | Freeze checks (§7) | all identical |
| T9 | Force-push to `main` as admin | rejected (history ruleset, no bypass) |

## 10. Your steps for the App (only you can do these)

1. github.com → Settings → Developer settings → GitHub Apps → **New GitHub App**.
2. Name `studio-bot-debasisr66` (must be globally unique); Homepage `https://github.com/debasisr66/studio`; **untick Webhook "Active"**.
3. Repository permissions: **Contents: Read and write** (Metadata: read is automatic). Nothing else.
4. "Where can this app be installed?" → **Only on this account**. Create.
5. Note the **App ID**. Generate a **private key** (downloads a `.pem`).
6. Install App → **Only select repositories** → `studio`.
7. Repo `studio` → Settings → **Environments** → New environment `studio-bot` → Deployment branches: **Selected branches → `main`** only.
8. In that environment: variable `STUDIO_BOT_APP_ID` = App ID; secret `STUDIO_BOT_PRIVATE_KEY` = full `.pem` contents. Then delete the local `.pem`.
(The App name is public; it need not contain your username.)

## 11. Rollback

| Scope | Command / action | Effect |
|---|---|---|
| Gate only (fast) | `gh api -X DELETE repos/debasisr66/studio/rulesets/<new id>` | back to history-only; bots keep working on App token |
| Workflows | revert the step-3 PR (by PR) | bots back on `GITHUB_TOKEN` (only works with gate deleted) |
| App | uninstall App; delete secret and variable | no credential remains |
| Auto-delete | `gh api -X PATCH repos/debasisr66/studio -F delete_branch_on_merge=false` | as before |

## 12. Risks

| Risk | Mitigation |
|---|---|
| App key leaks → push to `main` bypassing PR+CI (not force-push) | repo- and contents-only scope; rotate in App settings; history ruleset still blocks rewrite |
| Secret missing/renamed → sync fails red | health check already flags sync not green in 48 h; RUNBOOK entry |
| App bypass refused on personal repo | staged `disabled` test before go-live; fall back to C/A |
| Strict mode friction from daily sync commits | "Update branch" button; D2 can be relaxed later |
| Bot commits now trigger CI + health `workflow_run` | intended; more Actions minutes (public repo: free); CI-red issue may open on a bot commit (RUNBOOK) |
| `check` renamed or moved to another app → every PR deadlocks (D4 pin) | admin bypass is the escape; RUNBOOK entry |
| Step-3 merge breaks sync before the gate exists | quiet-window merge + immediate step-4 tests; revert PR restores `GITHUB_TOKEN` path |

## 13. Independent review (Sonnet 5.5, 2026-11-18) — disposition

| Finding | Severity | Disposition |
|---|---|---|
| H1 no-change sync never pushes → T1/T2 false pass | High | **Fixed**: forced diff (step 4), T1 pass rule |
| H2 early token mint fails whole sync; token on disk | High | **Fixed**: late conditional mint, explicit remote, `persist-credentials: false` |
| H3 activation window could break a live sync | High | **Fixed**: quiet window, immediate live re-test, rollback ready |
| H4 secret unverified before workflows depend on it | High | **Fixed**: step-4 tests run straight after merge, revert path stated |
| M1 repo secret readable by any branch's workflow | Med | **Fixed**: Environment restricted to `main`; no `workflows` permission |
| M2 T5 could pass for the wrong reason | Med | **Fixed**: specific error required, empty commit on tip |
| M3 T4 didn't use the real CMS token | Med | **Fixed**: real CMS publish |
| M4 strict untested | Med | **Fixed**: T7 |
| M5 docs/health comments become false | Med | **Fixed**: listed in §6 |
| M6 validator test 305-310 breaks by design | Med | **Fixed**: rewrite listed |
| M7 non-ff race with CMS | Med | **Fixed**: one rebase-retry. Old "`.github` differs only by smoke step" check was for the 2.0 release; no test enforces it (grep) |
| L2 F7 is documented | Low | Accepted: still observed in step 4 |
| L4 D6 is a no-op | Low | Accepted: D6 kept only to record the choice |
| Option C: deploy key can push workflow files; App can't | — | Strengthens B |
| Keep-alive via `gh workflow enable` instead of a commit | — | Not adopted: would remove one bypass user, but whether it resets GitHub's 60-day idle timer is undocumented |
