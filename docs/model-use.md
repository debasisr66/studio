# Model and Agent Use — Studio

Recorded 2026-10-19, updated after v1.4 work (2026-10-20), the v2.0 planning session (2026-10-21, §7) and the v2.0 build sessions (2026-10-22 to 23, §8, which also corrects §2 and §5). This document reports what could be measured. Where a figure is not exposed by the tooling, it says so instead of guessing.

## 1. Session

| Item | Value |
|------|-------|
| Session title | Studio hub site setup |
| Session started | 2026-10-13 12:26 UTC |
| Last update of this document | 2026-10-23 (§8 added; §1 to §7 describe the sessions up to the v2.0 planning and are kept as recorded; §2 and §5 are corrected by §8) |
| Model | `claude-sonnet-5-5` (Claude Sonnet 5.5) |
| Reasoning effort | medium |
| Fast mode | off |
| Permission mode | acceptEdits |
| Working directory | `/Users/debasisray/CoworkProjects/studio-site` |

## 2. Agents

**Up to the v2.0 planning, one agent did all the work: the main session, on Sonnet 5.5. From the v2.0 build (2026-10-22) separate reviewer agents on a different model were used for security-sensitive work: see §8.**

- No subagents were launched (no Explore, Plan, general-purpose or workflow agents). Planning for v1.1 was done by the main agent directly, because the codebase is one small site that was already fully in context.
- No other model was used.
- No multi-agent workflow was run.

## 3. Who did what

| Phase | Agent / model | Work |
|-------|---------------|------|
| v1.0 build (2026-10-13) | Main · Sonnet 5.5 | Preconditions check; registry, sync script, workflow; site and admin CMS; first deploy and verification |
| Notify and tokens (13–16 Oct) | Main · Sonnet 5.5 | Notify workflow in Penny; token guidance and a correction (dispatch needs Contents, not Actions); manual trigger; end-to-end test |
| Product updates | Main · Sonnet 5.5 | Added debasis-web (Information); Open app / Release / Source buttons; mobile layout check |
| Documentation v1 | Main · Sonnet 5.5 | `ARCHITECTURE.md`, `LEARNING-GUIDE.md`, README rewrite |
| v1.1 plan (2026-10-19) | Main · Sonnet 5.5 | Scope questions to the owner; approved plan |
| v1.1 build | Main · Sonnet 5.5 | `reads-lib.js` with tests first; UI rewrite; composer, filters, sharing; CSP; script extraction |
| v1.1 verification | Main · Sonnet 5.5 | Browser-pane testing at 375/768/desktop, XSS payloads, accessibility audit, contrast measurement; found and fixed 5 defects |
| v1.1 documentation | Main · Sonnet 5.5 | The v1.1 document set |
| v1.1 release | Main · Sonnet 5.5 | Merge, deploy, live smoke checklist; found `download_asset` need and implemented it with tests; guided the owner through the real admin publish and verified the commit; tag `v1.1` (including fixing a branch/tag name clash) |
| Rating (2026-10-19) | Main · Sonnet 5.5 | Honest scorecard and top-3 improvements, from evidence gathered in testing |
| v1.2 plan | Main · Sonnet 5.5 | Plan written first, as requested |
| v1.2 build | Main · Sonnet 5.5 | Test-first: validator (15 tests), sync refactor and churn fix (4), health check (5), date fix (2), CI and health workflows; proved each guardrail on deliberately broken copies; found and fixed the western-timezone date bug |
| v1.2 documentation | Main · Sonnet 5.5 | All artefacts updated: plan, impact, design, test, build, model-use, architecture, learning guide, README |
| v1.2 release | Main · Sonnet 5.5 | Merge, push, first CI and health runs, sync dry run on GitHub, tag (including the branch/tag name clash again, avoided this time with `release/…` branch names) |
| v1.3 impact, plan, design | Main · Sonnet 5.5 | Written first, committed before any code, as requested |
| v1.3 build | Main · Sonnet 5.5 | Test-first validator rules; CSP refactor (stylesheet extracted, 12 inline styles removed); admin token to `sessionStorage` and extracted into a tested module; version label and What's new; a visual-regression harness that compares computed styles against v1.2 |
| v1.3 test and security checks | Main · Sonnet 5.5 | 61 unit tests; 24-case visual matrix; stubbed-API admin flow with a fake token; hostile-input checks; accessibility-tree review (found an unnamed button); `security.md` threat model and 15-point review |
| v1.3 documentation | Main · Sonnet 5.5 | Plan, impact, design, test, build, security (new), architecture, learning guide, README, model-use |
| v1.3 release | Main · Sonnet 5.5 | Merge, deploy, tag; owner's real admin publish verified |
| Product introduction | Main · Sonnet 5.5 | Read Penny's own README, release notes, test and security records; wrote the Studio and Penny intro from them |
| v1.4 logo concepts | Main · Sonnet 5.5 | Generated three original abstract SVGs (Open Orbit, Lattice Ascent, Convergence), rendered them at several sizes, redrew two after review; owner chose option 2 |
| v1.4 impact, plan, design | Main · Sonnet 5.5 | Written first and committed before any code |
| v1.4 build | Main · Sonnet 5.5 | Test-first: font self-hosting and CI rules; logo; profile photo (rules library, upload flow, binary publish, manifest); idle-lock extraction; keep-alive logic and workflow; pinned Actions, Dependabot and a workflow-hygiene rule; health changes; header fit fix; changelog |
| v1.4 test and security checks | Main · Sonnet 5.5 | Rebuilt the visual-comparison harness (fonts: 24 cases; final: 24 cases; 26-width sweep); browser flows with generated images, planted GPS metadata, hostile files and a stubbed API; 102 unit tests; 18-point security review. Found and fixed six defects, one of them live in v1.3 |
| v1.4 documentation | Main · Sonnet 5.5 | All artefacts, new `docs/rulesets/` and `docs/brand/` |
| v1.4 release | Main · Sonnet 5.5 | Merged PR #1; verified the live site and the new workflows on GitHub; **applied and live-tested the branch rulesets**, discovered the CI-required ruleset blocks the bots (and that the Actions app cannot be a bypass actor), removed it within minutes, kept history protection, tested force-push and deletion on a throwaway branch; checked and verified Dependabot's two pull requests in dry-run mode; corrected the design, security log, test record, guides and the product introduction; tagged |

Tools used by the main agent: shell (`git`, `gh`, `node`, `python3`), file read/write/edit, the built-in browser pane (navigate, scripted checks, screenshots, resize), and session-metadata tools (for this document). Skills were not invoked.

## 4. Token and usage figures

Measured with the session usage tool at the end of the v1.4 release (2026-10-20):

| Measure | Value |
|---------|-------|
| Current context window in use | **743,824 tokens** of 1,000,000 (74%) |
| Auto-compaction threshold | 97% of the window |
| Context breakdown | Messages 676,780 · System tools 30,284 · MCP tools 20,964 · Skills 9,959 · System prompt 4,752 · Memory files 1,085 |
| Plan limits (account-wide, not only this session) | 5-hour window **70%** used (resets in about 1 h 45 min); weekly all-models 37% used |
| Extra usage (overage) | disabled |

Trend across this document's life (context in use): 236,539 tokens (24%) with the v1.1 set, 314,205 (31%) during v1.2, 444,875 (44%) during v1.3, 693,832 (69%) after the v1.4 build, **743,824 (74%) after the v1.4 release steps**. The release itself (merge, live verification, ruleset experiment, write-up) added about 50,000 tokens on top of the roughly 249,000 the v1.4 build added. Context size measures what is currently held, not what was billed.

Budget counter: the in-session token budget stands at about 14.95 million of 15 million at the time of writing for this release turn (roughly 50,000 tokens used since the previous turn ended; an approximation, not a billing figure).

**Practical note:** at 74% of the context window and 70% of the 5-hour plan limit, start the next release in a **fresh session**; this repository's documents (`plan.md`, `design.md`, `test.md`, `security.md`, `build.md`, `LEARNING-GUIDE.md`) carry the context.

### Not available

| Figure | Why |
|--------|-----|
| Cumulative input and output tokens for the whole session | The tooling reports current context size, not a running billed total. Re-sent context makes the context size an undercount of total tokens processed across many turns |
| Tokens per phase or per agent | Not exposed per phase. With a single agent and no subagents there is no per-agent split to report |
| Cost in currency | Not exposed; plan usage is shown as percent of limits only |

To get the authoritative billed numbers, use the usage page in the Claude account settings (organization usage for a Team plan).

## 5. Why a single agent was the right size here

- The site is one HTML file, two small scripts and JSON content, so it fit comfortably in one context.
- The work was sequential (library, then UI, then checks, then docs); each step depended on the previous result.
- Parallel agents would have added coordination cost and re-sent context for little gain.
- A separate reviewer agent would be worthwhile if the site grows (for example a second pair of eyes on security-sensitive changes). It was not used up to v1.4, and the security checks until then were done by the same agent that wrote the code. **That changed on 2026-10-22: the owner asked for an independent reviewer on a different model for security-sensitive phases (§8, [REVIEW-GATE.md](REVIEW-GATE.md)).**

## 6. How to refresh this document

Ask Claude to re-run the session usage tool and update §4. For agent detail on a future multi-agent run, list each agent's name, model, prompt purpose and result summary in §2–3.

## 7. v2.0 planning session (2026-10-21): documents only, no code

| Item | Value |
|------|-------|
| Work done | Revised PRD (§22 and related sections); wrote four specs (SH, RC, PC, UX) with test plans; impact and plan; design (§12), test, build, security, architecture, learning-guide and product-intro updates; contract and operations drafts |
| Main agent and model | Claude Sonnet 5.5 (`claude-sonnet-5-5`), the session's model |
| Subagents | None spawned |
| Tool use for facts | Reads and `grep` of the repository (code and docs), `node` one-liners to reproduce findings, `git`, `gh`; no browser; no code changed |
| Context in use at the time of writing | **281,389 tokens** of 1,000,000 (28%); Messages 215,438 · System tools 29,854 · MCP tools 19,885 · Skills 9,959 · System prompt 5,168 · Memory files 1,085 |
| Plan limits (account-wide) | 5-hour window **18%** used (resets in 1 h 28 min); weekly all-models **41%** used; extra usage disabled |
| Per-phase token cost | Not exposed by the tooling; not estimated |

**Practical note for the build:** the 2.0 build is long (ten plan steps, one pull request each). Start each phase, or at least the SH foundation, in a **fresh session** and let the repository documents carry the context: `docs/PRD.md`, `docs/specs/*`, `docs/plan.md`, `docs/design.md` §12 and `docs/test.md` v2.0 contain everything needed. A separate reviewer agent would be worthwhile for the security-sensitive phases (SH-02 CI tool, UX-04/05 privacy) so that the author does not mark their own work; none has been used yet.

## 8. v2.0 build sessions (2026-10-22 to 2026-10-23)

Measured with the session tools on 2026-10-23 at about 07:00 UTC. Where a figure is not exposed it says so.

### 8.1 Sessions and models

| Item | Value |
|------|-------|
| This session | "Studio 2.0 step 3: Reads data model (RC Phase A)" (id `local_de0a8b05-…`), started 2026-10-22 06:12 UTC, a child of the earlier orchestrating session; still running |
| Main agent and model | Claude Sonnet 5.5 (`claude-sonnet-5-5`), reasoning effort **medium**, fast mode **off**, permission mode **acceptEdits**, in its own git worktree |
| Earlier phases | SH Phase A and B (PRs #12, #13) were built in an earlier session; their usage is not covered here |
| Reviewer agents | **Claude Opus 5.5** (`opus`), a different model from the author, started fresh with read-only instructions (§8.3) |
| Other agents | None: no Explore, Plan, workflow or other subagents; two earlier-session background shell tasks were stopped when that session ended |

### 8.2 What the main agent did in this session

| Phase | Work | PRs |
|-------|------|-----|
| RC Phase A | Tests first (25 of 181 failed), `category` and `CATEGORIES`, rule `reads-category`, schema 2 migration with a before/after proof and a v1.5 rollback proof | #14 |
| PC Phase A | `podcasts.json`, `validatePodcasts`, eight rules with fixtures | #15 |
| RC Phase B | Technical / Others tabs, deep links, composer Section, 21 smoke cases; a harness fix (fresh URL per case) | #16 |
| Review gate | `REVIEW-GATE.md`, the SH-02 review and the smoke harness hardening (9 tests, 8 failed first) | #17 |
| Intermediate release | Changelog 1.6, tag `v1.6` | #18 |
| Fixes | CI red on `main` after the owner's first live publish (my tests depended on live content), N2 accepted | #19, #20 |
| PC Phase B | Podcasts section, composer, Blog retired, `#blog` redirect; review-driven hardening of publishing (also for reads) | #21 |
| Documents | Plan, specs and test results, security log, CONTRACT, RUNBOOK, design corrections, README, OPERATIONS, build, architecture, product-intro, learning guide, this document | in each PR and the audit PR |

### 8.3 Reviewer agents

| Review | Model | Result | Reported cost (as shown by the tool when it finished) |
|--------|-------|--------|-------------------------------------------------------|
| SH-02 CI tool, first review | Opus 5.5, read-only | APPROVE WITH CONDITIONS (1 medium, 3 low, info) | 85,556 tokens, 10 tool uses, 150 s |
| SH-02 re-review, same agent | Opus 5.5 | APPROVE (N1 to N5 new, N2 accepted by the owner) | 114,131 tokens, 8 tool uses, 187 s |
| PC Phase B, first review | Opus 5.5, read-only | APPROVE WITH CONDITIONS (3 medium, 2 low) | 125,263 tokens, 20 tool uses, 596 s |
| PC Phase B re-review, same agent | Opus 5.5 | APPROVE (3 new low findings) | 154,855 tokens, 10 tool uses, 892 s |
| QA Phase A (G4), first review | Opus 5.5, read-only | REJECT (1 high, 1 medium, several low); all fixed tests-first | 178,665 tokens, 28 tool uses, 786 s |
| QA Phase A re-review, same agent | Opus 5.5 | APPROVE WITH CONDITIONS (both met) | 193,602 tokens, 8 tool uses, 351 s |
| QA Phase B (G5), first review | Opus 5.5, read-only | APPROVE WITH CONDITIONS (1 medium, 4 low); phase later dropped, not merged | 124,852 tokens, 22 tool uses, 413 s |
| QA Phase B re-review, same agent | Opus 5.5 | APPROVE WITH CONDITIONS (met); not merged | 140,341 tokens, 6 tool uses, 439 s |

The token figure on a re-review may be cumulative for that agent rather than the cost of the second run alone; the tool does not say. The records are [reviews/SH-02.md](reviews/SH-02.md) and [reviews/PC-B.md](reviews/PC-B.md). The reviewers found real defects the author's own tests had not (an orphaned browser with an open debugging port; three ways a publish could overwrite the owner's content). Two limits stay: some fixes made after a reviewer's final verdict were not re-checked by it (each record says which), and a second model is not a human audit.

### 8.4 Usage figures

| Measure | Value |
|---------|-------|
| Context in use (this session) | **543,493 tokens** of 1,000,000 (54%); Messages 459,603 · System tools 36,496 · MCP tools 25,481 · System prompt 10,770 · Skills 9,970 · Memory files 1,173 |
| Auto-compaction threshold | 97% of the window |
| Plan limits (account-wide) | 5-hour window **48%** used (resets in about 28 minutes); weekly all-models **10%** used; extra usage disabled |
| In-session token budget | about 14.97 million of 15 million left at the time of writing (an approximation, not a billing figure) |
| Cumulative input and output tokens, per phase, per agent, cost in currency | Not exposed by the tooling; not estimated |

**Practical note:** a context at about half the window is fine for the next phase, but start UX Phase A in a fresh session if this one grows past about 75%; the documents (`plan.md`, `test.md`, `security.md`, `reviews/`) carry the context.

## 9. Release session (2026-10-26)

The v2.0 release PR, the later phases (UX A and B, Phase C) and their reviews were built by Claude Sonnet 5.5 sessions; independent reviews (SH-02, PC-B, QA-A, UX-04, UX-05) were done by separate Claude Opus 5.5 agents ([review records](reviews/)). Token and cost figures were not measured for these sessions.
