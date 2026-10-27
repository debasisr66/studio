# Studio: the engineering journey

*An owner's view, written at a pause. Studio by Debasis Ray, v1.0 to v2.1, 19 to 27 October 2026.*

## In one line

A small, static, self-contained product hub that stays current by itself, that the owner can update from a phone, and that was built spec first, test first, and with its security-sensitive parts reviewed by a second AI model.

## What Studio can do today

| For visitors | For the owner |
|--------------|---------------|
| **Products** and **Updates** built from the products' own GitHub releases, refreshed nightly | **Add to Studio** on the phone: paste a link, post, publish, the session locks itself |
| **Reads** (Technical and Others) with search, tags, sharing, and direct links | Reads, podcasts, profile photo and the **status line** editable without code |
| **Podcasts**: shows and episodes worth a listen | **What's new** and the footer version and date, from one changelog file |
| An **owner status line**: how Studio is doing, what is next, when updated | Daily health check, and an **alarm with fix steps by email** if CI goes red on `main` |
| Works on phone and desktop, light and dark, at high zoom and by keyboard | One-command **rollback** to any tagged release |

No cookies, no tracking, no third-party requests, no accounts for visitors.

## The journey in six steps

1. **v1.0 to v1.3 (19 Oct):** the hub, release feed, Reads, the admin layer, a strict content security policy, fonts hosted on the site itself.
2. **v1.4 to v1.5 (20 to 21 Oct):** trust and reliability: protected history on `main`, pinned automation, a daily health check, clear failure messages with a runbook.
3. **v1.6 (22 Oct):** Reads split into Technical and Others.
4. **Quick add (23 Oct):** the owner's phone workflow. A second phase (prefilled links from an iPhone Shortcut) was built, reviewed, then **dropped** when it did not work on the owner's phone: the code stayed out.
5. **v2.0 (26 Oct):** the overhaul: stabilised core, Podcasts replacing the Blog, one simple layout, accessibility and phone work.
6. **v2.1 (27 Oct):** the owner status line, small fixes, a split code library, and the CI alarm.

In numbers: 9 releases in 9 days, about 45 pull requests, 422 unit tests, 169 browser checks, 6 independent reviews.

## How it was built

- **Spec first.** Every change started as a short written spec with numbered requirements and a test plan, agreed with the owner.
- **Tests first, shown failing.** Each test was written before the code and seen to fail. Where a test passed at once (because the behaviour existed) the log says so. Mutation checks proved several tests really can fail.
- **One branch, one pull request, green CI.** The owner said "merge" every time; nothing was merged unprompted.
- **Real devices.** The owner ran the phone checks (iPhone, Chrome and Safari, VoiceOver, zoom). They found things automatic tests missed: blank space under the footer, a layout break at the largest zoom, the landscape first screen.
- **Plain reporting.** Every pull request lists what did not work or was not verified.
- **Small steps, rollback ready.** Each release is a tag; the rollback recipes are tested.

## Secure building practices

| Practice | What it means here |
|----------|--------------------|
| **Strict content security policy** | No inline code, no outside hosts except the GitHub API; no cookies; nothing about visitors stored or sent |
| **Untrusted input stays text** | Links, fragments and content values are matched against closed lists or checked by one shared rule set, and reach the page only as text |
| **Token handling** | The owner's token lives in the tab only, is asked for just when posting, and is cleared after a successful publish |
| **Same checks in CI and in the admin** | The rules CI applies to content are the ones the owner tools apply before every publish |
| **Locked-down automation** | Actions pinned by commit hash, minimum permissions (validated), protected history on `main`, no secrets beyond GitHub's own token |
| **Independent review gate** | Security-sensitive work is judged by a separate AI model (Opus 5.5 or Haiku 5.5), never by the author; findings are fixed test-first and re-checked; records are kept in `docs/reviews/` |
| **Human checkpoint** | A ten-minute owner read of the findings, the CSP and the token code before merging sensitive changes |
| **Alarm, not a lock** | CI cannot be made mandatory without stopping the bots, so a red `main` raises an issue with fix steps by email |

## Honest lessons

- Several defects reached the owner or a reviewer before they reached my tests. Measuring a layout is not the same as looking at it.
- Some tests proved less than their names claimed. Reviews and mutation checks caught them, and the guards got stricter.
- Size budgets (and the CI time limit) became real constraints; they were trimmed, then raised or split on purpose.
- Dropping a feature that did not work (the iPhone Shortcut) was the right call and cost little because the process allowed it.

## Where it stands, and what is next

Studio 2.1 is live and frozen for now. Open: the owner's sign-off on the review records and the accepted risks, a real-phone look at the status line, and proving the CI-red email on a real red run. Ideas parked: an owner-tools entry for the status line, greying a stale status, loading owner-only code on demand.

Also as a self-contained page: [engineering-journey.html](engineering-journey.html).

More detail: [plan](plan.md) · [security log](security.md) · [test results](test.md) · [specs](specs/README.md) · [reviews](reviews/) · [architecture](ARCHITECTURE.md)
