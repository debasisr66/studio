# Model and Agent Use — Studio

Recorded 2026-10-19, updated after v1.4 work (2026-10-20). This document reports what could be measured. Where a figure is not exposed by the tooling, it says so instead of guessing.

## 1. Session

| Item | Value |
|------|-------|
| Session title | Studio hub site setup |
| Session started | 2026-10-13 12:26 UTC |
| Last update of this document | 2026-10-20 (v1.4 build; figures in §4 refreshed) |
| Model | `claude-sonnet-5-5` (Claude Sonnet 5.5) |
| Reasoning effort | medium |
| Fast mode | off |
| Permission mode | acceptEdits |
| Working directory | `/Users/debasisray/CoworkProjects/studio-site` |

## 2. Agents

**One agent did all the work: the main session, on Sonnet 5.5.**

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
- A separate reviewer agent would be worthwhile if the site grows (for example a second pair of eyes on security-sensitive changes); it was not used in this release, and the security checks here were done by the same agent that wrote the code.

## 6. How to refresh this document

Ask Claude to re-run the session usage tool and update §4. For agent detail on a future multi-agent run, list each agent's name, model, prompt purpose and result summary in §2–3.
