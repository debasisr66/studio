# Review: QA-B Quick add, Phase B (QA-09 prefill by link)

Process: [REVIEW-GATE.md](../REVIEW-GATE.md), gate G5. Requirement: [SPEC-QA](../specs/quick-add/spec.md) QA-09. Threat list: [security.md](../security.md) 11.11 (T25, T26). The reviewer was given the files, the spec text and the threat list, not the author's notes. The reviewer's words below are copied; the author did not edit the verdict.

| Item | Value |
|------|-------|
| Scope | `js/reads-lib.js` (`isAddEntry`, `parseAddHash`), `js/app.js` (`qaApplyHash`, `qaPrefill`, `openAdd`, `closeAdd`, the hash listener and boot hook), `index.html` (the banner), `css/site.css`, and the new tests. Out of scope: Phase A code the prefill does not touch, the Shortcut itself |
| Author model | Claude Sonnet 5.5 |
| Reviewer model | Claude Opus 5.5 (separate agent, fresh context, read-only) |
| Reviewed commit | 264571c (first review); fixes re-checked at d5420be; one small follow-up (R1) after that, in the commit that adds this file |
| Reviewer verdict | APPROVE WITH CONDITIONS |
| Owner acknowledgement | pending |

First verdict (264571c): `VERDICT: APPROVE WITH CONDITIONS` ("The parser and the injection defences are sound, but F1 lets a crafted link replace what the owner sees while a token prompt or a publish is in progress, and that guard (plus F2 and F3, with their smoke cases) should go in before merge."). Re-check verdict (d5420be), the line in the table: `VERDICT: APPROVE WITH CONDITIONS` ("The fixes are sound and tested, but merge only after docs/reviews/QA-B.md exists so TC-SH-D02 passes, and the uncommitted §7 doc edits are committed."). Both conditions are met by the commit that adds this file (this record; the spec section 7 edit). The author also fixed the reviewer's new minor observation R1 afterwards; that last step was **not** re-checked by the reviewer.

## Findings

| # | Severity | Where | Scenario (reviewer, shortened) | Fix | Status |
|---|----------|-------|-------------------------------|-----|--------|
| F1 | Medium | `qaApplyHash` / `qaPrefill` vs `qaPost` | A `hashchange` to `#add=` while the token prompt is open or a publish runs replaced every field after the entry had been captured: the sheet showed the crafted link while the owner's entry was posted; after a failed publish, one retry published the crafted link (confirmed, three probes) | Ignore a prefill while `qa.busy` or `qa.tokDone`, clear the fragment, show a message | Fixed, TC-QA-F06b (two cases); re-check: fixed |
| F2 | Low | banner state | The banner stayed on a reopened empty sheet and after the owner pasted their own link | Hide it in `openAdd` and `qaTake` | Fixed, F06b; re-check: fixed |
| F3 | Low | `qaPrefill` on an error | A malformed `#add=x` cleared the owner's typed fields and the draft key | Message only, leave fields and draft | Fixed, F06b; re-check: fixed |
| F4 | Low | `qa.warned` | A prefill did not reset the "also publishes other changes" acknowledgement | Reset it | Fixed; no dedicated test; re-check: fixed by reading |
| F5 | Low | unlock-only close | An unedited prefill stayed in the draft key and came back later | Drop it on unlock while the banner is still shown | Fixed, F06b; re-check: fixed |
| F6 | Info | banner announcement | A live region shown with its text already in it may not be announced | Set the text one tick after showing | Changed; not verified with a screen reader |
| F7 | Info | parser | An unencoded `&` cuts the link; bidi and zero-width characters stay in a title (same as typed input) | Document URL Encode | Accepted; documented |
| F8 | Info | tests | F01/F04 unit cases only grep `qaPrefill`'s body; no smoke case for the in-flight states | Add smoke cases | Done (F06b) |
| F9 | Info | docs | TC-SH-D02 red until this record exists | Create it | Fixed by this file |
| R1 | Info | `openAdd` open-sheet branch | During a publish a hash change moved the focus to the link field and it stayed there after a failure | Skip the focus when busy | Fixed with a test (F06b assertion); not re-checked by the reviewer |
| R2 | Info | message in an inert sheet | The "ignored" message may not be announced while the prompt is open | None needed | Accepted |
| R3 | Info | prefill over a draft | A good prefill replaces an in-progress draft; unlock without editing then deletes it | Accept or document | Accepted (recorded decision: a prefill replaces everything) |

## Checked and found sound (reviewer)

Run or read by the reviewer: the parser never throws and stays fast (200,000 random hostile fragments, 0 exceptions, every accepted link starts with `http(s)://`; 0.03 to 1.8 ms on inputs up to 10 million characters); injection through the link (`javascript:`, mixed-case, `data:`, `file:`, `ftp:`, credentials, `//host`, malformed schemes, NUL, empty, over-length, double encoding; IDN homoglyph shown as punycode); titles (control characters, length, bad encoding); object-prototype and repeated keys; XSS inert (smoke S01); the prefill never posts or asks for a token by itself, also with the admin unlocked; the fragment is cleared on good and bad links, a reload does not reopen the sheet, and the draft holds only the five fields; hash handling with the sheet open; `isAddEntry` anchoring. Ran smoke (126 of 126 at the first review, 131 of 131 at the re-check), the validator and the Phase B unit file.

## Not checked (reviewer)

Real WebKit or Chrome on iOS, the Shortcut flow and whether `googlechromes://` keeps the fragment (owner check O05); screen-reader announcement of the banner; how practical F1 was (it needs the owner's tab hash to change, for example through an opener handle or a Shortcut that reuses the tab); Phase A code outside the paths Phase B touches.

## Re-review

Done once, after F1 to F6; see the verdict above. The author's follow-up after that re-check (R1, this record, the section 7 wording) has no second pass; the owner may ask for one before merge.
