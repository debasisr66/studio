# Independent review gate

Owner decision (2026-10-22): for the security-sensitive phases of Studio 2.0, a **separate reviewer agent running a different model** judges the work, so the author never marks their own work as safe. This page is the process; each review is a record in [reviews/](reviews/). A test (`tests/review-records.test.js`) fails CI if a record is malformed, names the same model as the author, or carries no verdict.

## Who

| Role | Who | Notes |
|------|-----|-------|
| Author | Claude Sonnet 5.5 (the session that builds the phase) | Builds, tests, writes the security log **draft** and may never write "pass" for a gated item |
| Reviewer | A separate agent on a **different model**: Claude Opus 5.5 by default; Claude Haiku 5.5 is the minimum acceptable | Fresh context (it has not seen the build conversation), read-only, no network except localhost |
| Owner | Debasis Ray | Reads the review, accepts or rejects residual risks, says "merge". Nothing merges without the **Owner acknowledgement** row filled |

If the author's model ever changes, the reviewer must still be a different model family from the author's. A model reviewing its own family's output shares its blind spots, which is what this gate is for.

## Which phases are gated

| Gate | Phase and requirement | Why it is sensitive | When |
|------|----------------------|---------------------|------|
| G1 | **SH-02** CI tool: `scripts/smoke.js` and its step in `ci.yml` | Runs a local web server and headless Chrome (with `--no-sandbox` in CI) on every pull request; injects a fake token; a vacuous case would make CI pass falsely | **Now, retroactively**: it merged in PR #12 before this gate existed. Record: [reviews/SH-02.md](reviews/SH-02.md) |
| G2 | **UX-04** link stability: `#blog` → `#podcasts`, `#reads/…`, unknown hashes (UX Phase A) | The URL fragment is untrusted input that reaches the DOM and the router | Before the UX Phase A PR is merged |
| G3 | **UX-05** accessibility and responsiveness, with the privacy invariants (UX Phase B) | The usage-based layout (and its privacy requirements) was dropped, so the sensitive part left is the invariant that **Studio stores and sends nothing about visitors**: no new storage key, cookie, third-party request, or visitor data; motion and focus changes introduce none | Before the UX Phase B PR is merged |
| G4 | **QA Phase A** Quick add: just-in-time unlock, autofill-friendly token field, post and publish, auto-lock, the owner-only draft key, clipboard paste, `#add` ([SPEC-QA](specs/quick-add/spec.md) QA-01 … QA-08) | It changes how the token is asked for, used and discarded, adds the one new storage key of 2.0 and a clipboard read: the most sensitive code in the site | Before the QA Phase A PR is merged |
| G5 | ~~**QA Phase B** prefill by link (`#add=…`, QA-09)~~ **dropped 2026-10-23** (the review was done on the branch `v2/qa-b-build`; the phase was not merged) | A fragment that can be crafted by anyone reaches the owner's form | Before the QA Phase B PR is merged |

**Recommended additions (owner decides; not gated unless you say so):** the Podcasts admin composer and publish path and the `#blog` redirect (SPEC-PC PC-03, PC-05: a new publish path and a new rendered input), and RC Phase B (the `#reads/<slug>` hash and the Section field, already built as PR #16 with its own security log, unreviewed by another model).

## How a review runs

1. **Build and test as usual.** The author writes the failing tests first, builds, runs everything, and drafts the security-log entry as *author's notes*.
2. **Brief the reviewer** with the files or diff, the spec text for the requirement, and the threat list. Do **not** hand over the author's conclusions, the test narrative or the draft log (an agent given a conclusion tends to confirm it). The brief says: read-only, find problems, cite file and line, say what was checked by running and what by reading.
3. **The reviewer reports** findings (high / medium / low / info, each with a concrete scenario and the smallest fix), what it checked and found sound, what it could not check, and a final line `VERDICT: APPROVE`, `APPROVE WITH CONDITIONS` or `REJECT`.
4. **The author responds**: fixes each finding with a test, or writes a one-line reason for not fixing it. Fixes go back to the **same reviewer** (same agent, so it keeps its context) for a re-check; its new verdict replaces the old one in the record, and the earlier verdict stays in the findings table.
5. **Record it** in `docs/reviews/<REQ-ID>.md` using the template below. The reviewer's verdict is copied verbatim; the author does not soften or rewrite it.
6. **Link it**: the phase's entry in [security.md](security.md) §11 says "Independent review: <record>, verdict <verdict>" and nothing else about pass or fail; the pull request description repeats the link and the verdict.
7. **The owner reads the record** and fills **Owner acknowledgement** (date and initials in the PR comment or the record). Medium or high findings need a fix or an accepted-risk line signed off by the owner.

## Record template

```
# Review: <REQ-ID> <short name>

| Item | Value |
|------|-------|
| Scope | files, requirement, what was in and out |
| Author model | Claude Sonnet 5.5 |
| Reviewer model | Claude Opus 5.5 (separate agent, fresh context) |
| Reviewed commit | <sha> |
| Reviewer verdict | APPROVE / APPROVE WITH CONDITIONS / REJECT |
| Owner acknowledgement | pending, or date and note |

## Findings
<table: id, severity, where, scenario, fix, status (fixed in <sha> / accepted by owner / open)>

## Checked and found sound
## Not checked
## Re-review
```

## Human checkpoint (owner, about 10 minutes; added 2026-10-26, residual risk 3)

A model review is not a human audit. Before the owner says "merge" on a gated PR (or any PR that touches the token flow, Quick add, link handling or the CSP), the owner reads three things and writes the date in **Owner acknowledgement** of the record:

1. The record's **Findings** table: every medium or high finding is fixed or has an accepted-risk line.
2. The PR's **diff of `index.html` and the CSP meta tag**: no new `<script>`, `<link>` or host, and `connect-src` is still only `'self'` and `https://api.github.com`.
3. The diff of the files that handle the token and fragments (`js/token-store.js`, the hash code in `js/app.js`): no new place where the token or the address bar is read, stored or sent.

**Ask for a human or professional review** (not a model) before adding anything of these kinds: server-side code, a new third-party host or script, accounts or payments, a new kind of stored visitor data, or a change to how the token is held.

## Limits (stated plainly)

A second model is a second pair of eyes, not a human audit or a penetration test; models share some blind spots even across families. The gate catches the author's self-grading and many real defects. It does not replace the owner's judgement, the browser-engine limits already noted in security.md §11.4, or a human review before anything handles real money or customer data.
