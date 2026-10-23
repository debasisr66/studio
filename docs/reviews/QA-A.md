# Review: QA-A Quick add, Phase A (QA-01 to QA-08)

Process: [REVIEW-GATE.md](../REVIEW-GATE.md), gate G4. Requirements: [SPEC-QA](../specs/quick-add/spec.md) QA-01 to QA-08. Threat list: [security.md](../security.md) 11.11 (T25 to T34). The reviewer was given the files, the spec text and the threat list, not the author's notes or conclusions. The reviewer's words below are copied; the author did not edit the verdict.

| Item | Value |
|------|-------|
| Scope | `index.html` (the two dialogs, gear, owner bar), `js/app.js` (Quick add block, `publishContent`, Publish changes, lock, boot hook), `js/reads-lib.js` (Quick add helpers), `css/site.css`, `scripts/make-sandbox.js`, one budget constant in `scripts/validate-site.js`, and the new tests. Out of scope: older unchanged code, fonts, workflows |
| Author model | Claude Sonnet 5.5 |
| Reviewer model | Claude Opus 5.5 (separate agent, fresh context, read-only) |
| Reviewed commit | e50b501 (first review); fixes re-checked at df7d62b; later fixes N1 and the trap tweak are in the commit that adds this file |
| Reviewer verdict | APPROVE WITH CONDITIONS |
| Owner acknowledgement | pending |

First verdict (e50b501): `VERDICT: REJECT` ("F1 lets a one-tap Quick add made before boot finishes silently replace the whole published reads.json or podcasts.json, and F2 stores the token after the owner pressed Cancel; both fixes are small, and the commit should be re-reviewed once they are in."). Re-check verdict (df7d62b), the line in the table: `VERDICT: APPROVE WITH CONDITIONS` ("All nine code findings are fixed and nothing new was broken, but approval needs the missing `docs/reviews/QA-A.md` link fixed so the unit suite passes, and N1 (losing a draft posted before boot finishes) closed with the same refusal as F1."). Both conditions were then met by the author (this file; N1 fix with test TC-QA-L12); that last step was **not** re-checked by the reviewer.

## Findings

| # | Severity | Where | Scenario (reviewer, shortened) | Fix | Status |
|---|----------|-------|-------------------------------|-----|--------|
| F1 | High | `app.js` publishFile guard | Tap the gear before boot settles, Post and publish: `snap` is undefined, the guard lets it through, one PUT with only the new entry wipes the 6 existing reads (confirmed with the slow-reads fixture) | Refuse when `snap[path]` is undefined | Fixed, TC-QA-L09; re-check: fixed |
| F2 | Medium | token submit vs Cancel | Cancel while `GET /user` is in flight: the token is still stored, admin on, "qa.tokDone is not a function" shown (confirmed) | Capture the callback, ignore stale results | Fixed, TC-QA-U08; re-check: fixed (also the Post-again variant) |
| F3 | Low-medium | `qaPost` | Pending inline deletion in the same file goes public with a Quick add, unannounced (confirmed) | Warn first | Fixed, TC-QA-L10; re-check: fixed |
| F4 | Low | draft key | A visitor who types in the sheet writes the draft key; QA-07 says a visitor never writes it | Correct the wording | Documented (security 11.12, test status log); code unchanged |
| F5 | Low | `lock()` | Unposted inline composer text is cleared on every successful publish | Keep forms after a publish | Fixed, TC-QA-L11; re-check: fixed |
| F6 | Low | `ghApi` | A hung request leaves the sheet busy until reload | Timeout | Fixed (20 s); re-check: fixed |
| F7 | Low | focus while busy | Focus drops to body after the button is disabled | Move focus; restore | Fixed, TC-QA-L11; re-check: fixed, one leftover (heading not in the trap list), fixed afterwards, not re-checked |
| F8 | Low | `trimLink` | Quadratic on many trailing brackets | Count once | Fixed, unit test; re-check: fixed |
| F9 | Info | 401 advice | Advice shown although already locked | Only while admin | Fixed; re-check: fixed |
| F10 | Info | tests | F1 to F3 untested; some code-shape tests weak; E03 title overstated | Add cases; rename | Done |
| F11 | Info | sandbox | Token and draft keys shared between `/studio` and `/studio-sandbox` in one tab | Optional suffix | Accepted: throwaway sandbox |
| N1 | Low-medium | `qaPost` draft branch | Post as draft before boot finishes: entry added, then boot replaces the lists; entry lost though "Unpublished" stays (confirmed) | Refuse like F1 | Fixed, TC-QA-L12; not re-checked by the reviewer |
| N2 | Condition | docs links | `plan.md` and the spec link to this file, which did not exist | Commit it | Fixed by this file |

## Checked and found sound (reviewer)

Read or run by the reviewer: injection through pasted text (T25; `javascript:`, `data:`, credentials, `//host`, `file:`, ports, IPv6, control characters; titles stay text); `parseDraft` and `serializeDraft` (five fields only, `__proto__`, `token`, `pat` dropped, clamped); the clipboard is read only in the Paste tap (T27); the token location and non-exposure apart from F2 (T29); lock after success and stay unlocked after failure (T30); a visitor reaching `#add` (T31); the login form (T32); the publish guards once boot has finished (T33); two tabs; double tap on Post; Escape or Cancel during a publish; blocked `sessionStorage`; CSP, budgets and the rejected stored token (T34). Ran `node --test tests/*.test.js`, `node scripts/validate-site.js` and `node scripts/smoke.js` (all green apart from the missing link), plus its own probes against stubbed GitHub.

## Not checked (reviewer)

Real iPhone and Chrome behaviour (password-manager save and fill with a readonly username, clipboard prompts, Home Screen `#add`, whether `sessionStorage` survives a tab restore); screen-reader output; real GitHub responses (stubs only); `docs/security.md` outside 11.11, `docs/test.md`, `docs/reviews/` (as instructed).

## Re-review

Done once, after F1 to F9; see the verdict above. Author's follow-up after that re-check (N1, the heading in the focus trap, this record) has no second pass; the owner may ask for one before merge.
