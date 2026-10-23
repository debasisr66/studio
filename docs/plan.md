# Plan — Studio

Status key: ✅ done · ⏳ pending · 🔒 needs owner · Releases: **v2.0 (proposed)**, v1.5 (shipped 2026-10-21, tag `v1.5`), **v1.4 (shipped 2026-10-20, tag `v1.4`)**, v1.3 (shipped 2026-10-19, tag `v1.3`), v1.2 (shipped, tag `v1.2`), v1.1 (shipped, tag `v1.1`)

---

# v2.0 — Studio 2.0 (proposed)

Date: 2026-10-21 · Branch per phase: `v2/<spec>-<phase>` · Rollback tag: `v1.5` · [Impact](impact.md) · PRD [§22](PRD.md)

## Why

The owner asked for four things: stabilise the hub, split Reads into Technical and Others, replace the Blog with Podcast links, and make the layout simpler (the usage-based ordering part was dropped by the owner on 2026-10-21). They touch the same file (`app.js`) and the same page, so they are sequenced, not parallel, and the safety work goes first.

## Method

PRD updated (done) → four specs (done, this PR) → impact (done) → **plan (this document)** → per phase: design → test-first build → test → security checks → update artefacts → pull request with green CI → owner approval → merge. Same release discipline as v1.5. Each phase is its own pull request.

## Scope and order

| Step | Spec | Phase | Delivers | Gate to continue |
|------|------|-------|----------|------------------|
| 0 | all | Approval | Owner answers (below) and approves the specs | Q1 (SPEC-UX), Q1 (SPEC-SH) answered |
| 1 | SH | A | Section isolation, bounded fetch, smoke-test harness on the **unchanged** page | Smoke test green on v1.5 behaviour. **Merged (PR #12)** ✅ |
| 2 | SH | B | CONTRACT.md, schema versions, OPERATIONS.md | Contract tests green, commands executed. **Merged (PR #13)** ✅ |
| 3 | RC | A | `category` in data, validator, migration (no UI) | Migration proves no loss; owner confirms classification. **Merged (PR #14)** ✅ (classification confirmed 2026-10-21) |
| 4 | PC | A | `podcasts.json`, validator, fixtures (section not visible) | Fixtures and contract green. **Merged (PR #15)** ✅ |
| 5 | RC | B | Reads tabs, deep links, composer section | Smoke test covers both sub-items. **Merged (PR #16); shipped in v1.6** ✅ |
| 6 | PC | B | Podcasts section and admin; Blog removed; `#blog` redirect | Smoke test; owner publishes a podcast link. **Merged (PR #21)** ✅ (independent review PC-B; owner's real publish of a podcast link still to do) |
| 7 | QA | A | Quick add: sheet, paste first, just-in-time unlock, autofill-friendly token field, post and publish, auto-lock, owner-only draft, `#add` home-screen entry | Smoke and unit tests; **independent review (G4)**; owner device checks O01-O04, O06 on the iPhone. *Added 2026-10-23, needs the owner's approval of [SPEC-QA](specs/quick-add/spec.md)* |
| 8 | QA | B | Prefill by link (`#add=…`) and the iOS Shortcut recipe | Smoke and unit tests; **independent review (G5)**; owner device check O05 |
| 9 | UX | A | Fixed order, section pattern, matching navs, stable links | Navs identical; anchors verified; **independent review of UX-04 (G2)** |
| 10 | UX | B | Accessibility and responsiveness pass, first-screen clarity | Keyboard, contrast, zoom, 375 px; owner walk-through; **independent review of UX-05 (G3)** |
| 11 | SH, RC, PC, UX | C | Fallback proofs, asset rules, books in sub-items, seed podcasts, **check the footer date** (see "Revisit later") | P1 rows ✅ or deferred in writing |
| 12 | all | Release | Changelog 2.0, REQ rows, security log, architecture, learning guide, product intro; tag `v2.0` | Exit criteria in all four test plans |

Steps 3-4 can run in either order; steps 5 and 6 can swap; steps 7-8 (Quick add) come before the layout work because they are small, owner-facing and touch the same composer markup; everything else is sequential.

## Per-phase checklist (repeat for every phase)

1. Branch from `main`; confirm `git pull --rebase` and green CI.
2. Write the failing tests for that phase; show them failing.
3. Build until green; run the full suite and `node scripts/validate-site.js`.
4. For UI phases: smoke test at 375 and 1280 px, light and dark; visual comparison with the frozen v1.5 build for untouched sections.
5. Security checks: CSP, URL rules, no new host, token handling untouched; log in `docs/security.md`.
6. Update artefacts: spec status and traceability, `docs/test.md`, contract and runbook rows for any new rule.
7. Pull request; CI green; owner approval; merge; verify the live site and the health check.

## Owner decisions (answered 2026-10-21)

| # | Decision | Answer |
|---|----------|--------|
| SH Q1 | Headless Chrome in CI for the smoke test | **Yes** (the SH design spike still confirms it is available and stable) |
| UX | Usage-based ordering of sections | **Dropped** by the owner ("not adding any value"): no usage tracking, no stored preference, no reordering. SPEC-UX is now a fixed-order, simpler layout |
| UX Q2 | Products and Updates stay on top | **Yes**: fixed order Products, Updates, Reads, Podcasts |
| RC Q1, Q2 | Books follow the split; all 5 reads and the book are Technical | **Yes, yes** |
| PC Q2 | Keep `blog.json` as an archive | **Yes** |
| PC Q3 | Seed podcasts | **Lex Fridman, ThePrimeagen, Yuval Noah Harari.** These are people or shows: the owner supplies the exact podcast or episode URLs when seeding (none are invented in the documents) |
| Labels | "Others", "Podcasts" | **As written** |
| QA scenario | The owner copies a link by instinct; one tap opens a box that takes it; unlock only when posting; publish; the admin locks again | **Confirmed 2026-10-23** |
| QA Auto-lock | Lock after every successful publish | **Always on, not optional** (owner 2026-10-23) |
| QA platform | iPhone first (owner-driven), **Chrome** (not Safari); QA before UX | **Yes**; no Android share target, no PWA; plain bookmark with Chrome as the default browser (fallbacks in SPEC-QA QA-08) |
| QA token handling | PIN-protected stored token, passkey/PRF unlock | **Rejected** (spec decisions D1, D2); the token stays in the tab only, autofilled by the iPhone Passwords app if the owner chooses |

## Milestones

| Milestone | Definition of done |
|-----------|--------------------|
| M1 Safe base | Steps 1-2 merged; the existing page passes the new smoke test |
| M2 Data ready | Steps 3-4 merged; no visible change |
| M3 Content split | Steps 5-6 merged; Reads has two sub-items; Podcasts replaces Blog |
| M3b Quick add | Steps 7-8 merged: the owner can add an item from the iPhone in any order, with auto-lock |
| M4 Layout | Steps 9-10 merged: fixed order, matching navs, stable links, accessibility pass |
| M5 Release | Steps 11-12; `v2.0` tagged; live smoke checklist and health green |

## Risks and watch points

Heavy edits to `js/app.js`: keep new logic in small tested modules and watch the 80 KB budget (37 KB used). Do not combine phases in one pull request. If the smoke test is unstable, stop and resolve it before any feature phase (the safety base is the point). If an owner decision changes a spec, update the spec and its test plan first, then the plan.

## Artefact update matrix (what is updated, when)

| Artefact | When it is updated | Content |
|----------|--------------------|---------|
| [PRD](PRD.md) | Now (done); at release | §22 workstreams; at release set statuses to shipped and fill actual metrics |
| `docs/specs/*/spec.md` | Now (draft); each phase | Status log and traceability results; Shipped (v2.0) at release |
| `docs/specs/*/test.md` | Each phase | Results per case, filled only after running |
| [Impact](impact.md) | Now (done); at release | Final risk statuses and what was actually touched |
| [Plan](plan.md) | Each merged step | Tick the step; record changes of scope |
| [Design](design.md) §12 | Now (done); when design changes during build | Corrections found while building, with reasons |
| [Test](test.md) v2.0 | Each phase; at release | Fill B and the case results; live results section |
| [Build](build.md) §18 | When a planned command becomes real | Replace "planned" with the tested command |
| [Security](security.md) §11 | Each phase | Results column, checklist, residual risks, owner acknowledgement. For gated phases the entry only links the independent review and quotes its verdict |
| [Review gate](REVIEW-GATE.md), [reviews/](reviews/) | SH-02 now; UX-04 and UX-05 before their PRs merge | A separate reviewer agent on a different model writes the verdict; the author never marks a gated item passed; guarded by `tests/review-records.test.js` |
| [Architecture](ARCHITECTURE.md) §13 | At release | Move from "proposed" to current; fold into §1-12 |
| [Learning guide](LEARNING-GUIDE.md) Step 18 | Each phase; at release | Real commands and screenshots of the new flows |
| [Model use](model-use.md) | At release | Final usage figures and any agent detail |
| [Product intro](product-intro.md) | At release | Move the roadmap table into the capability tables; version v2.0 |
| README | At release | Release set links, version |
| `docs/CONTRACT.md`, `docs/OPERATIONS.md` | SH Phase B (drafts exist now) | Execute every command once; keep in step with RULES |
| `docs/RUNBOOK.md` | Each phase that adds a rule or message | Row per new message (guarded by the TR-04 test) |
| `content/changelog.json` | **Release PR only** | The 2.0 entry (draft text in build.md §18.7) |

## Definition of done for v2.0

- [ ] Four specs Shipped; every P0 requirement traced to a passing case; P1 done or deferred in writing.
- [ ] 142 existing tests plus the new ones green; smoke test green in CI; `validate-site.js` OK.
- [ ] Live: no console errors, CSP clean, no new third-party request, health check green, sync run green.
- [ ] Owner steps done: real read and podcast published; seed podcasts; real phone check.
- [ ] Every artefact in the matrix updated; `v2.0` tagged; rollback tag `v1.5` verified.

## Revisit later

| Item | Source | Decision |
|------|--------|----------|
| N2: if Node itself is SIGKILLed (OOM, `kill -9`, a runner killing the tree), headless Chrome from the smoke test stays running with its DevTools port open. Possible fix: `--remote-debugging-pipe` (no TCP port; Chrome exits when the pipe closes) | [reviews/SH-02.md](reviews/SH-02.md) | **Accepted by the owner 2026-10-23 for now.** Revisit before v2.0 or if the smoke test ever runs on shared machines |
| Reviewed-but-unchanged info items: checkout `persist-credentials: false`, `--no-sandbox` keyed on `GITHUB_ACTIONS` instead of `CI`, string-only fetch stub | [reviews/SH-02.md](reviews/SH-02.md) | Proposed as accepted; owner has not yet confirmed |
| Footer shows an old date ("Synced from GitHub · 19 Oct 2026") although the sync runs nightly | Owner, 2026-10-23 | **Check in Phase C.** Diagnosis (2026-10-23): by design since v1.2, `synced_at` only moves when product data changes (so a quiet week makes no commit), and the footer prints that date; the sync itself last succeeded on 22 Oct. The label is misleading, not the sync broken. Options: (a) reword to "Product data last changed 19 Oct 2026" (no new data, recommended); (b) show the last successful sync, which needs a new daily write or a third-party/API call (churn or CSP cost). Owner decides |

## Not in this plan

Analytics, usage-based ordering, embedded audio, RSS import, owner-configurable section order, a third Reads sub-item (all P2 or non-goals in the specs).

---

# v1.4 — Self-hosted fonts, protected main, keep-alive, profile photo, logo

Date: 2026-10-20 · Branch: `release/v1.4` · Rollback tag: `v1.3`

## Why

The v1.3 rating left four known gaps: a third-party font request (privacy and a point of failure), CI that alerts but cannot block, scheduled workflows that GitHub silently disables after 60 days of inactivity, and Actions pinned by tag. This release closes them, fixes the small items found since, and adds two things asked for: a **profile photo** the owner can upload and an **abstract Studio logo**.

## Method

impact (done) → **plan (this document)** → design → build → test → security checks → update artefacts → pull request with CI → owner approval → merge → apply protection → verify → tag. This is the first release to go through a **pull request**, so CI gets a real run before anything reaches `main`.

## Scope

| # | Item |
|---|------|
| U1 | Self-host Inter and JetBrains Mono; remove Google hosts from the page and CSP; licences included; CI forbids third-party hosts in `style-src` and `font-src` |
| U2 | Branch protection on `main`: (a) **history** ruleset (no deletion, no force-push, for everyone): **applied**; (b) **CI-required** ruleset: built and tested, **not applied** because it blocks the sync and keep-alive bots (see "What changed") |
| U3 | `keepalive.yml`: weekly check; empty commit only when `main` is 30+ days quiet; health check fails if any workflow is disabled |
| U4 | Pin `actions/checkout` and `actions/setup-node` by commit hash in every workflow; Dependabot weekly for GitHub Actions |
| U5 | Health check at 12:00 UTC; document that scheduled runs are routinely hours late |
| U6 | Idle-lock logic extracted to `js/token-store.js` and unit-tested |
| P1 | Profile photo: admin **Change photo**, validation, square crop, 512 px JPEG re-encode, publish to `content/profile.jpg`, display in the hero with a monogram fallback; CI validates the file |
| L1 | Logo: option 2 (**Lattice Ascent**) as `assets/logo.svg`, header mark and favicon; concepts kept in `docs/brand/` |
| W1 | Changelog entry v1.4 and all artefacts |

## Decisions (made without asking, easy to change)

| Decision | Choice | Why |
|----------|--------|-----|
| Logo | Option 2, Lattice Ascent (owner's choice) | Chosen after seeing three original concepts |
| Branch protection design | *Planned:* two rulesets (history for everyone; CI required with admin and Actions bypass). *Result:* history applied; CI-required not applied, because the Actions app cannot be a bypass actor on a personal repository and the bots would be blocked | The admin screen commits straight to `main` with the owner's token, and the sync and keep-alive bots push straight to `main`. A rule that also bound the owner and the bots would break publishing and syncing. The trade-off is documented: the owner can bypass CI, but not rewrite history |
| Keep-alive threshold | 30 days without a commit on `main` | Half of GitHub's 60-day limit, so a missed week cannot cause a lapse; roughly one empty commit per 30 quiet days |
| Photo format | JPEG, 512 × 512, one file `content/profile.jpg` | Small (tens of KB), universally supported, metadata removed by re-encoding |
| Photo placement | Hero, beside the "Studio by Debasis Ray" line; monogram until a photo exists | Identity at the top; no empty gap before upload |
| SVG uploads | Not accepted | SVG can carry script |
| Release route | Pull request, merged with a merge commit | Keeps the `--no-ff` history and lets CI gate the merge |

## Phases

| Phase | Work | Gate | Status |
|-------|------|------|--------|
| 0 | Logo options created and shown; owner chose option 2. Branch `release/v1.4` | Choice recorded | ✅ |
| 1 | Impact analysis | Reviewed | ✅ |
| 2 | This plan | Reviewed | ✅ |
| 3 | Design (fonts, photo flow, logo use, protection model, keep-alive logic) | Reviewed | ✅ (`design.md` §11) |
| 4a | Fonts: download, licences, `@font-face`, CSP, validator rules and tests | Visual comparison vs v1.3 clean | ✅ after fixing the rupee-sign regression the comparison found; 24 cases, 0 differences |
| 4b | Logo and favicon | Legible at 128, 32, 16 px | ✅ (16 px keeps the amber cell and grid; fine detail blurs) |
| 4c | Idle lock extraction and tests; image library and tests | Tests pass | ✅ 4 idle-lock and 9 image tests |
| 4d | Profile photo: upload dialog, binary publish, display, validator | Flows pass with a generated test image and a stubbed API | ✅ added a manifest (design change) so there is no console error before upload and no stale photo |
| 4e | Keep-alive logic and workflow; pin hashes; Dependabot; health changes | Unit tests; YAML valid; dry runs | ✅ 8 keep-alive tests, 4 workflow-rule tests, 3 health tests |
| 5 | Test: unit, visual diff, browser flows, regression | All pass; results in `test.md` | ✅ 102 unit tests; 24-case comparison; 26-width sweep; photo flows |
| 6 | Security checks (`security.md`) | No open High findings | ✅ 15 checks pass, S-30 (rulesets) pending until applied |
| 7 | Update artefacts and changelog | Consistent | ✅ |
| 8 | Open the pull request; CI green; **owner approves**; merge; Pages, health and sync dry run green | Live smoke checklist | ✅ PR #1 merged as `84b1dd2`; CI, Pages, health, sync dry run, keep-alive dry run green; live smoke test clean |
| 9 | Apply the rulesets; test them (forced keep-alive commit as Actions, direct admin push, force-push rejected, a deliberately failing PR); tag `v1.4` | Rollback tested in principle, command recorded | ✅ all tested; design corrected (CI ruleset not kept); rollback exercised for real; tagged |
| 10 | Owner: upload a real photo, publish, verify | Commit and live check | ⏳ 🔒 |

## Acceptance criteria

- D1: No request leaves the page for any host except the same origin (and `api.github.com` in admin); the CSP has no third-party host in `style-src` or `font-src`; CI rejects a regression.
- D2: Computed styles match v1.3 except the header logo and the new hero photo area (fonts introduce no differences).
- D3: *Original:* each ruleset behaves as designed. *Result:* the history ruleset behaves as designed and force-push and deletion are rejected; the CI-required ruleset was found to block the bots and was not kept, so D3 is met by the history ruleset plus CI-by-process (test.md TC-B01–B07).
- D4: Keep-alive makes no commit when `main` is recent, one empty commit when quiet or forced, and the decision logic is unit-tested.
- D5: All workflows use pinned hashes; the sync dry run passes on GitHub; Dependabot is configured.
- D6: A generated test image becomes a 512 × 512 JPEG under 150 KB with no metadata; an SVG, a corrupt file, an oversized file and an over-large pixel count are rejected; the admin screen publishes it as one file, one commit.
- D7: The idle lock locks after the configured time and re-arms on activity (unit-tested with fake timers).
- D8: The logo is the header mark and the favicon and is legible at 16 px.
- D9: Every artefact references v1.4 and agrees with the others.

## What changed during the build (and why)

| Change | Reason |
|--------|--------|
| Fonts: Latin **and Latin Extended** self-hosted | The visual comparison showed the rupee sign lives in the Extended subset |
| Profile photo gets a manifest (`profile.json`) | Avoids a console error before a photo exists and avoids a stale cached photo |
| Header fit fix added to scope | Found a 23 px overflow on live v1.3 between 621 and 640 px |
| CI gained rules for SVGs, stylesheet sanity, workflows, photo and manifest | Each guards something this release introduced or nearly broke |
| Health moved to 12:00 UTC (was planned for the same release) | Scheduled runs start hours late |
| **CI-required ruleset not applied** | Tested live: it blocks the bots' direct pushes (`Required status check "check" is expected`), and GitHub refuses the Actions app as a bypass actor on a personal repo. History protection is applied; CI gating stays by process |
| Dependabot found two real updates immediately | Verified on their branches (sync, keep-alive, health dry runs) before deciding; left for the owner |

## Out of scope

A server, user accounts, SVG or animated uploads, multiple photos, photo cropping controls beyond a centre crop, requiring pull requests for admin-screen content changes (would remove the admin screen's direct publishing), replacing GitHub Pages or adding a CDN.

## Honest limits to carry forward

- The owner can bypass the CI ruleset by design; only history rewriting and deletion are blocked for everyone.
- GitHub does not publish an exact definition of "repository activity"; commits to `main` are the known-good signal, so keep-alive uses them.
- Pages serves the photo with a cache of up to about ten minutes.

---

# v1.3 — Safer admin session, version tracking, What's new

Date: 2026-10-19 · Branch: `release/v1.3` (merged) · Rollback tag: `v1.2`

## Why

Improvement #2 from the v1.2 rating: the admin token lived in `localStorage` (survives indefinitely) and the CSP still needed `'unsafe-inline'` for styles. Two user-facing requests ride along: a **visible version** so users can tell what they are looking at, and a **What's new** button so they can understand what changed.

## Method (agreed order)

impact (done) → **plan (this document)** → design → build → test → security checks → update artefacts → owner approval → merge, deploy, tag.

## Scope

| # | Item |
|---|------|
| H1 | Admin token in `sessionStorage`; legacy `localStorage` token purged; in-memory fallback |
| H2 | Strict CSP for styles: `css/site.css`, no inline `<style>` or `style=`; dynamic values set through script |
| V1 | Version in the footer, from `content/changelog.json` |
| V2 | What's new button, dialog and unseen-update dot |
| V3 | `content/changelog.json` (backfilled for v1.0–v1.3 in plain language), validator rules, tests |
| S1 | `docs/security.md`; all artefacts updated, including a v1.3 changelog entry |
| H1b | Token logic extracted into `js/token-store.js` so the security-critical behavior (including blocked storage) is unit-tested; added during build |

## Decisions (made without asking, easy to change)

| Decision | Choice | Why |
|----------|--------|-----|
| Version scheme | Major.minor shown as `v1.3`, matching git tags | One number for users and for the repository |
| Source of truth | `content/changelog.json`, newest first | One file drives the footer, the dialog and the dot; validated in CI |
| Entry format | Title plus short plain-text bullets, no links, no markup | Safe by construction; readable by non-technical users |
| Unseen indicator | Dot until the dialog is opened; shown for first-time visitors too | Discoverable; storage unavailable means no dot |
| Token migration | Delete the old stored token; do not copy it into the new store | Copying would keep the weakness we are removing |
| Editing the changelog | By git (not the admin screen) | Keeps release notes a deliberate act; avoids widening what the admin token can change |

## Phases

| Phase | Work | Gate | Status |
|-------|------|------|--------|
| 0 | Branch `release/v1.3` | Clean tree | ✅ |
| 1 | Impact analysis | Reviewed | ✅ |
| 2 | This plan | Reviewed | ✅ |
| 3 | Design: What's new UX and flows, admin session, CSP before/after | Reviewed | ✅ (`design.md` §10) |
| 4a | Baseline: copy of v1.2 for the visual comparison; changelog data; validator rules and tests (tests first) | Tests pass | ✅ 8 new validator tests; rules flagged all 5 real violations before the refactor |
| 4b | CSP refactor: `css/site.css`, remove inline styles, script-applied dynamic styles | Computed-style diff clean; zero CSP violations | ✅ 24 cases, 0 differences; 0 violations |
| 4c | Admin token in `sessionStorage`, legacy purge, memory fallback, unlock text | Storage tests pass | ✅ extracted to `js/token-store.js` (8 unit tests) + in-page checks |
| 4d | What's new button, dialog, version, dot | Keyboard and screen-reader checks scripted | ✅ one accessibility defect found and fixed (DEF-07) |
| 5 | Test: unit, visual diff, browser flows at 375/768/1280 in both themes, regression | All pass; results in `test.md` | ✅ 61 unit tests; 24-case visual matrix; regression clean |
| 6 | Security checks: checklist in `security.md`, hostile inputs, storage, CSP, secrets scan | No open High findings | ✅ 15 checks pass; no High or Critical findings |
| 7 | Update artefacts: plan, impact, design, test, build, model-use, security, architecture, learning guide, README, changelog | Consistent and cross-referenced | ✅ |
| 8 | Owner approves; merge; push; CI, Pages and health green; tag `v1.3` | Live smoke checklist | ✅ merge `6c6052d`; CI, Pages, health, sync dry run and live smoke test green |

## Acceptance criteria

- C1: After unlocking, the token exists in `sessionStorage` and **not** in `localStorage`; a token left in `localStorage` is removed on load; closing the tab forgets the token; with `sessionStorage` blocked the token works from memory and a reload locks.
- C2: `index.html` has no inline `<style>` and no `style=` attribute; no script-generated markup contains `style=`; the CSP forbids `'unsafe-inline'` for **both** scripts and styles; zero violations in every flow.
- C3: Computed styles of every element match v1.2 at 375, 768 and 1280 px in dark and light, except the intentionally added elements.
- C4: The footer shows the version from the changelog; **What's new** opens a dialog with newest-first releases; the dot appears when the stored version differs and clears when the dialog opens.
- C5: The dialog is keyboard operable, traps focus, restores focus, closes on Escape, and meets the contrast and target-size rules in `design.md`.
- C6: A malformed or hostile changelog fails CI; hostile text renders as plain text.
- C7: Nothing else changes: `sync.yml`, sync and health scripts, other content files, Penny and debasis-web are untouched; existing 45 tests still pass; sync dry run passes.
- C8: Every artefact references v1.3 and agrees with the others.

## Out of scope

Editing release notes in the admin screen, per-user accounts, a backend, automatic version bumping, release-note links or images, analytics on who opened What's new.

## Risks

See `impact.md` (W1–W8). The most important: the CSS extraction (W1) is proven by a computed-style diff, and the CSP tightening (W3) is proven by zero-violation runs of every flow.

## Honest limits to carry forward

A token in a browser tab is still readable by script running on this origin; v1.3 shortens its life and removes the two CSP loopholes that would help an attacker, but cannot remove the risk on a static site. Pages cannot send response headers (no `frame-ancestors`, no HSTS control).

---

# v1.2 — Guardrails (no new features)

Date: 2026-10-19 · Branch: `release/v1.2` (merged) · Rollback tag: `v1.1`

## Why

The v1.1 rating put reliability and testing at the bottom (6 and 5.5 of 10). The tests and the "protected files unchanged" check only run when someone runs them, and a failed sync or broken content file would go unnoticed. v1.2 adds a safety net and removes noise. **No visitor-facing feature is added.**

## Scope

| # | Item | Type |
|---|------|------|
| G1 | **CI check on every push and pull request**: unit tests plus site validation, read-only (`contents: read`) | Guardrail |
| G2 | **Content and site validator** (`scripts/validate-site.js`): schema checks for products, cache, blog and reads; safe URLs; referenced files exist; CSP present; no inline scripts; size budget; JS syntax | Guardrail |
| G3 | **Daily health check** (`health.yml` + `scripts/health-check.js`): the live site answers; every product's latest GitHub release matches what the cache says (detects a broken sync or dispatch). A failure turns the run red and triggers GitHub's failed-workflow email | Alerting |
| G4 | **Fix cache churn (rating item 4)**: `pushed_at` is stored as a date, so a Penny push no longer rewrites `cache.json` several times a day | Fix |
| G4b | Date display fix that G4 requires: date-only values are shown as the same calendar day in every timezone (`formatDate`, one line in `js/app.js`) | Fix |
| G5 | Update every artefact: plan, impact, design, test (traceability), build, model-use, architecture, learning guide, README | Docs |

## Out of scope

New site features, UI changes, changes to Penny or debasis-web, replacing tokens, a staging environment, automatic rollbacks, paid monitoring services.

## Safety approach ("nothing breaks")

- New work lives on `release/v1.2`; Pages deploys only from `main`.
- **`index.html` is unchanged and the page looks the same.** The only runtime edit is the date formatter (G4b): one line in `js/app.js` plus a tested helper in `js/reads-lib.js`. The only data change is `content/cache.json` (one-time format change of `pushed_at` from timestamp to date; the page already formats it as a date).
- Workflows are additive and read-only: `ci.yml` and `health.yml` use `permissions: contents: read` and no secrets. `sync.yml` is not modified.
- `scripts/sync-products.js` gets a small refactor so its logic can be unit tested; behavior is unchanged except G4. Verified by a dry run and a real local run before merge.
- Honest limits: pushes made by the sync bot do not trigger CI (GitHub does not run workflows for `GITHUB_TOKEN` pushes), so cache commits are covered by the daily health check instead. An expiring dispatch token is not detectable from the hub; the calendar reminder remains.

## Phases

| Phase | Work | Gate | Status |
|-------|------|------|--------|
| 0 | Branch `release/v1.2` from current `main` | Clean tree | ✅ |
| 1 | This plan | Reviewed | ✅ |
| 2 | `scripts/validate-site.js` + unit tests (good and bad fixtures) | Tests pass; validator passes on the real repo | ✅ 15 tests; real repo OK; broken copy rejected |
| 3 | Refactor `sync-products.js` for testability + G4/G4b; unit tests | Tests pass; dry run and local run behave as before | ✅ 6 tests; two real runs (migrate, then no-op) |
| 4 | `scripts/health-check.js` | Passes against the live site | ✅ 5 tests; healthy live; wrong URL and stale cache both fail |
| 5 | `.github/workflows/ci.yml` and `health.yml` | YAML valid; trigger manually after merge | ✅ YAML valid, read-only; ⏳ first GitHub runs after merge |
| 6 | Update all artefacts (G5) | Traceability matrix extended | ✅ |
| 7 | Verify locally, show diff summary, **owner approves merge** | Protected paths diff reviewed | ✅ approved |
| 8 | Merge, push, confirm CI and health runs are green, tag `v1.2` | Live smoke checklist | ✅ merge `a7e81db`; CI, Pages, health and sync dry run green |

## Acceptance criteria

- B1: `node --test tests/*.test.js` and `node scripts/validate-site.js` pass locally and in CI.
- B2: The validator catches each of: malformed JSON, `javascript:` URL in reads, duplicate product repo, missing referenced script, inline script, missing CSP, size over budget (proved by unit tests).
- B3: The health check fails when a cached release tag differs from GitHub's latest, and passes when they match.
- B4: A simulated "Penny pushed again the same day" run reports no change and makes no commit.
- B5: `index.html` is byte-identical to `v1.1`; the only JS changes are the tested `formatDate` helper and its one-line use; the live site is visually unchanged.
- B8: A date-only value displays as the same calendar day under UTC, America/Los_Angeles, Asia/Kolkata and Pacific/Kiritimati.
- B6: `sync.yml` is unchanged; a dry run still passes.
- B7: All artefacts reference v1.2 and agree with each other.

## Risks

| ID | Risk | Mitigation |
|----|------|------------|
| P1 | CI is red on day one because of a validator bug | Run on the real repo and fixtures before merge; fix forward on the branch |
| P2 | Health check false alarm just after a release | Runs once daily, hours after the nightly sync; the dispatch normally fixes drift within minutes |
| P3 | Email alerts are off in the owner's GitHub settings | Document how to enable "failed workflows only" notifications and a `gh run list --status failure` fallback |
| P4 | Refactor of `sync-products.js` changes behavior | Unit tests plus dry-run and local-run comparison; `sync.yml` untouched |

---

# v1.1 — HCI polish, branding, LinkedIn-style Reads (shipped)

Date: 2026-10-19 · Owner: Debasis Ray


## Goals

1. HCI-guideline UI (see [design.md](design.md)).
2. Branding: **Studio by Debasis Ray — learning never ends!**
3. Reads: add and share links like a LinkedIn post (owner-only, no backend, no third-party services).
4. Meet non-functional and security requirements, and **break nothing**: Penny, debasis-web and the sync pipeline run as before.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Who can add | Owner only, via the admin token | No new backend or abuse surface |
| Link preview | Manual title and comment | No third party sees what you read |
| Sharing out | LinkedIn share link, Copy link, native share sheet | Covers desktop and phone with no SDKs |
| Delivery | Branch `v1.1`, tag `v1.0` as rollback | Pages deploys only from `main` |

## Phases

| Phase | Work | Gate | Status |
|-------|------|------|--------|
| 0. Safety net | `git pull --rebase`; tag `v1.0`; branch `v1.1` | Tag pushed | ✅ |
| 1. Library (test first) | `js/reads-lib.js` + `tests/reads-lib.test.js` | 16/16 tests pass | ✅ |
| 2. UI | Branding, HCI pass, composer, cards, filters, share, CSP; script extracted to `js/app.js` | Loads with zero console errors and zero CSP violations | ✅ |
| 3. Verification | Browser checks at 375, 768 and desktop; XSS payloads; accessibility audit; regression on protected files | All pass (see [test.md](test.md)) | ✅ |
| 4. Docs | impact, plan, design, test, build, model-use | Reviewed | ✅ |
| 5. Merge and deploy | Merge `v1.1` to `main`, push, check Pages | Owner approval; Pages build success | ✅ (`c5b3d0f`) |
| 6. Live smoke test | Live URL, product cards, Penny and debasis-web links, nightly sync dry run | Checklist in [test.md](test.md) §6 | ✅ |
| 7. First real publish | Add one read as admin and publish | Needs owner's token | ✅ (`9acca43`) |
| 8. Tag | Tag `v1.1` | After phase 7 passes | ✅ |

## Acceptance criteria

- A1: Title, header, hero and footer carry the new branding.
- A2: Owner can post, edit and delete a read; visitors cannot see or use the composer.
- A3: Reads can be filtered by tag and searched; each card has LinkedIn share and Copy link (plus native share where supported).
- A4: Existing reads (`{title, url, note}`) still display.
- A5: `git diff main` is empty for `.github/`, `scripts/`, `content/products.json`, `content/blog.json`.
- A6: Sync dry run still passes; Penny and debasis-web links still work.
- A7: Zero CSP violations; hostile input in title, comment, tags and URL renders as inert text.
- A8: No horizontal scroll at 375 px; keyboard-only operation works end to end.

## Out of scope

Public submissions, link-preview services, comments or likes, analytics, a backend, changes to Penny or debasis-web, replacing Google Fonts.

## Next candidates (not committed)

Reading-list RSS feed; export reads as Markdown; an admin token validity check on load; self-hosting fonts to remove the last third-party request.

## Checklist for the merge step

- [x] Owner approves merge
- [x] `git checkout main && git pull --rebase && git merge --no-ff v1.1`
- [x] `git push` and confirm `gh run list` shows Pages success
- [x] Run the live smoke checklist
- [x] Add one read with the admin token; confirm it appears after the Pages rebuild
- [x] `git tag v1.1 && git push origin v1.1`
