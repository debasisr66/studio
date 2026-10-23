# Test plan: Quick add

Spec: [spec.md](spec.md) (`SPEC-QA`). IDs `TC-QA-<group><nn>`. ⬜ not run, 🔒 owner step on a real iPhone. Unit tests first (pure helpers in `js/reads-lib.js`), then browser smoke with the GitHub API and the clipboard stubbed in the page (nothing leaves the machine), then the owner's device checks. Every case is written first and shown failing.

## Sheet and entry (E), QA-01

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-E01 | QA-01 | Locked: tap ⚙ | The Add to Studio sheet opens (not only the token prompt) | ⬜ |
| TC-QA-E02 | QA-01 | Cold load of `…/#add`, locked | Sheet open, link field focused | ⬜ |
| TC-QA-E03 | QA-01 | No visitor navigation (header, bottom nav) links to it; without `#add` or ⚙ nothing of it is visible | pass | ⬜ |
| TC-QA-E04 | QA-01 | Escape and Cancel close it; focus returns to where it was | pass | ⬜ |
| TC-QA-E05 | QA-01 | `role="dialog"`, labelled, focus trapped, Tab cycles inside | pass | ⬜ |

## Paste (P), QA-02

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-P01 | QA-02 | Tap Paste with a link on the (stubbed) clipboard | Link field filled with the normalised link; one-line destination preview | ⬜ |
| TC-QA-P02 | QA-02 | Clipboard holds plain text with no link | Inline announced message; field unchanged | ⬜ |
| TC-QA-P03 | QA-02 | Clipboard holds `Title⏎https://…` (share text) | Link extracted, title prefilled | ⬜ |
| TC-QA-P04 | QA-02 | Tracking parameters and fragment removed; `javascript:`, `data:`, `https://user:pw@…`, `//host` refused with the composers' message | pass | ⬜ |
| TC-QA-P05 | QA-02 | Unit: `extractLink` and `extractTitle` on many share-text shapes (leading and trailing text, several links, parentheses, trailing punctuation, 5,000-character input, empty, non-string) | pass | ⬜ |
| TC-QA-P06 | QA-02 | Typing or pasting by hand works the same as the button | pass | ⬜ |
| TC-QA-P07 | QA-02 | The clipboard is **not** read when the sheet opens or on load, only on the tap (the stub counts calls) | 0 calls before the tap | ⬜ |

## Read or Podcast (K), QA-03

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-K01 | QA-03 | Unit: `suggestKind` for Spotify, Apple Podcasts, YouTube, a blog, look-alike hosts (`spotify.com.evil.io`), invalid input | Podcast for the first two only; Read otherwise | ⬜ |
| TC-QA-K02 | QA-03 | The suggestion is preselected and can be changed | pass | ⬜ |
| TC-QA-K03 | QA-03 | Read: Section defaults to the last used, else the tab being viewed; Type, Tags, Take shown | pass | ⬜ |
| TC-QA-K04 | QA-03 | Podcast: Show, Tags, Take shown; no Section | pass | ⬜ |
| TC-QA-K05 | QA-03 | Same inputs give the same errors and the same stored entry as the existing composers (parity over a table of cases) | identical | ⬜ |

## Just-in-time unlock (U), QA-04

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-U01 | QA-04 | Locked, link and title filled, press Post and publish | Token prompt appears over the sheet; the draft is intact | ⬜ |
| TC-QA-U02 | QA-04 | Correct token (stubbed API accepts) | The same action continues: one PUT of the right file with the item | ⬜ |
| TC-QA-U03 | QA-04 | Wrong token (stubbed API answers 401) | Clear message, still on the prompt, draft intact, nothing written | ⬜ |
| TC-QA-U04 | QA-04 | Cancel on the prompt | Back to the sheet, draft intact, nothing written | ⬜ |
| TC-QA-U05 | QA-04 | Token field markup: `type=password`, `autocomplete="current-password"`, a username field with `autocomplete="username"`, inside a form, **no** `autocomplete="off"` | pass | ⬜ |
| TC-QA-U06 | QA-04 | The token appears nowhere in the DOM text, console output or storage except the one tab `sessionStorage` key | pass | ⬜ |
| TC-QA-U07 | QA-04 | Opening the sheet and pasting need no token (stub counts API calls: 0) | 0 calls | ⬜ |

## Publish and lock (L), QA-05, QA-06

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-L01 | QA-05 | Post and publish a Read | One PUT of `content/reads.json`, valid, item under the chosen Section | ⬜ |
| TC-QA-L02 | QA-05 | Post as draft | Marked unpublished, **no** API write; Publish changes later writes it | ⬜ |
| TC-QA-L03 | QA-06 | Successful publish | Admin locks at once: body not in admin mode, token removed from storage, "Published and locked" | ⬜ |
| TC-QA-L04 | QA-06 | The existing **Publish changes** button also locks after success | pass | ⬜ |
| TC-QA-L05 | QA-06 | Failed publish (stubbed 500) or refused (changed remote, unloaded file) | Stays unlocked, error shown, draft kept, retry works | ⬜ |
| TC-QA-L06 | QA-05 | The SPEC-PC guards still hold through Quick add: remote differs from the loaded copy, newer `schema_version`, invalid entry already in the file | Refused, nothing written | ⬜ |
| TC-QA-L07 | QA-06 | After success the draft key is gone | pass | ⬜ |

## Draft (D), QA-07

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-D01 | QA-07 | Fill the sheet, reload the page in the same tab, open the sheet | Values restored | ⬜ |
| TC-QA-D02 | QA-07 | The draft key never contains the token (search the stored value for the stub token) | pass | ⬜ |
| TC-QA-D03 | QA-07 | A visitor session that never opens the sheet has **no** draft key; storage keys are exactly the admin token key (when unlocked) and the draft key (when used) | pass | ⬜ |
| TC-QA-D04 | QA-07 | Cleared on Cancel and on success; an idle lock keeps it | pass | ⬜ |

## Home-screen entry (H), QA-08

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-H01 | QA-08 | Cold load `#add` at 375 px: sheet open, link field focused, Paste button visible, no horizontal overflow, targets ≥ 44 px | pass | ⬜ |
| TC-QA-H02 | QA-08 | `#add/anything` and `#adds` do not open the sheet; `#add` while unlocked opens it with no prompt | pass | ⬜ |
| TC-QA-H03 | QA-08 | OPERATIONS and LEARNING-GUIDE contain the iPhone recipe for Chrome (default browser, Add to Home Screen from Chrome, the Chrome-bookmark and `googlechromes://` Shortcut fallbacks) (static doc test) | pass | ⬜ |

## Prefill by link (F), QA-09, Phase B

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-F01 | QA-09 | `#add=<encoded link>` | Link filled, "Prefilled from a link: check it" banner, **not** submitted | ⬜ |
| TC-QA-F02 | QA-09 | `&t=<encoded title>` | Title filled | ⬜ |
| TC-QA-F03 | QA-09 | Malformed encoding, 5,000-character value, `javascript:`/`data:` link | Ignored with a message; sheet opens empty | ⬜ |
| TC-QA-F04 | QA-09 | After reading, the fragment is gone from the address bar; the draft key carries the values | pass | ⬜ |
| TC-QA-F05 | QA-09 | Odd keys (`__proto__`, `constructor`, repeated `add=`) ignored; no exception | pass | ⬜ |
| TC-QA-F06 | QA-09 | The Shortcut recipe is documented with both the `https://` and the `googlechromes://` form (static doc test) | pass | ⬜ |

## Security (S) and regression (X)

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-S01 | QA-02, QA-09 | XSS payloads in the pasted link, share-text title, take, tags and in `#add=` stay inert in the sheet, the preview and the published card | pass | ⬜ |
| TC-QA-S02 | QA-04 | A visitor who presses Post gets the token prompt and no API call is made until a token is given | 0 calls | ⬜ |
| TC-QA-S03 | all | CSP, `validate-site.js` and size budgets unchanged; no new host; no cookie | pass | ⬜ |
| TC-QA-X01 | all | The existing composers, edit and delete, the PC-B and RC-B publish guards and every earlier smoke case still pass | pass | ⬜ |
| TC-QA-X02 | all | The full unit suite stays green | pass | ⬜ |

## Owner device checks (O): real iPhone, Safari

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-QA-O01 | QA-04 | In **Chrome on the iPhone**, with the token saved (in Chrome's password manager, or in the iPhone Passwords app with Chrome as AutoFill provider; add it by hand under `debasisr66.github.io`, username `studio-admin`, if Chrome never offers to save), focus the token field on our prompt | The saved token is offered and fills; note whether Face ID or the passcode was asked first (answers Q1). If nothing is offered, record what Chrome shows; fallback is pasting the token after the link is posted | 🔒 |
| TC-QA-O02 | QA-02 | Copy a link in Chrome (Share, Copy, or long-press the address bar, Copy Link), then tap Paste | iOS may ask to allow paste; the link fills | 🔒 |
| TC-QA-O03 | QA-07 | In Chrome, fill the sheet, switch to another app and back (and, if you can, leave it for a minute or two) | Draft still there. If it is not, the draft moves to `localStorage` with a 24-hour expiry (answers Q5) | 🔒 |
| TC-QA-O04 | QA-08 | With Chrome as the default browser, open `…/#add` in Chrome, Share, Add to Home Screen; copy a link; tap the icon | Opens in Chrome with the sheet ready for the paste, the `#add` part intact. If it opens elsewhere or loses `#add`, use the fallbacks of QA-08 | 🔒 |
| TC-QA-O05 | QA-09 | Phase B: share an article from Chrome to the "Add to Studio" Shortcut (plain `https://` form first, `googlechromes://` form if the wrong browser opens) | Sheet opens in Chrome with the link filled, the fragment intact | 🔒 |
| TC-QA-O07 | QA-08 | Settings, Chrome, Default Browser App is Chrome; tap the Home Screen icon from a cold start | Chrome opens (not Safari) | 🔒 |
| TC-QA-O06 | all | End to end, timed in Chrome: link copied → icon → Paste → title → Post and publish → token → published and locked | At most 6 actions; admin locked at the end; item live after about a minute | 🔒 |

Regression: all existing tests; CSP clean; no new third-party request.

Exit criteria: P0 rows ✅ (QA-01 … QA-06); P1 rows ✅ or deferred in writing; independent review done and acknowledged by the owner; O01-O04, O06 and O07 done on the owner's phone in Chrome (O05 with Phase B).

## Status log
- 2026-10-23: Draft created; nothing run.
