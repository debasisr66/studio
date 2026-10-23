# Spec: Quick add (paste first, unlock when needed, publish, lock)

| | |
|---|---|
| Spec ID | `SPEC-QA` (requirements `QA-01` … `QA-10`) |
| Status | **Draft (2026-10-23); awaiting the owner's approval; not started** |
| Owner | Debasis Ray |
| Created | 2026-10-23 |
| Parent | [PRD](../../PRD.md) §9.4, §11.3, §14; [§22](../../PRD.md) |
| Depends on | [SPEC-RC](../reads-categories/spec.md) Phase B and [SPEC-PC](../podcast-links/spec.md) Phase B (both merged: the two composers, the guarded publish) |
| Target | Studio v2.0 (planned before SPEC-UX Phase A) |
| Review | Independent review required for both phases ([REVIEW-GATE.md](../../REVIEW-GATE.md) G4, G5) |

## 1. Summary

Adding a read or a podcast from the owner's iPhone is a planning task: unlock first (paste a long token), then go back to the article, copy its link, return, open the right composer, paste, fill in, Post, Publish, Lock. Copy the link first and the clipboard is overwritten by the token. This spec makes the owner's real scenario work **in any order, with the fewest steps, without weakening the token rules**:

> The owner is reading an article, likes it and copies its link by instinct. **One tap** opens a box that is ready to take that link. Pasting it starts the add; the token is asked for only when the owner presses Post; the item is published and the admin **locks itself again**.

## 2. Evidence

| # | Finding | Evidence |
|---|---------|----------|
| F1 | The clipboard holds one thing: a link copied first is lost when the token is pasted, so today the order is forced (unlock, then copy) | `#pat` prompt, `openUnlock` in `js/app.js` |
| F2 | The composers are hidden until admin mode, so there is nothing to paste into before unlocking | `body.admin .composer` in `css/site.css` |
| F3 | The token field is `type="password"` with `autocomplete="off"`; Safari honours `off` on login fields and suppresses its password manager, which is a likely reason Face ID autofill never appears | `index.html`/`js/app.js` token prompt; secondary sources: [Discourse thread on `autocomplete="off"` disabling Safari's password manager](https://meta.discourse.org/t/autocomplete-off-disables-safari-password-manager/14472?tl=en), [PanicVault guide on iOS AutoFill attributes](https://www.panicvault.org/apple/autofill-iphone-guide/). Not confirmed on the owner's device: see Q1 |
| F4 | Posting a draft, publishing and locking are three separate actions | `#composerForm` submit, `#publishBtn`, `lock()` |
| F5 | There are two composers (Share a read, Share a podcast) and the owner must find the right one first | `index.html` |
| F6 | The token lives only in the tab (`sessionStorage`) and locks after 30 idle minutes: good, and to be kept | `js/token-store.js`, `IDLE_MS` |

## 3. Goals and measures

| Goal | Measure | Target |
|------|---------|--------|
| Works in any order | Link copied before or after unlocking | **both work** |
| Fewer actions from "link copied" to "published and locked" | Owner actions (taps and pastes) on the owner's iPhone | **about 9 today** (unlock, paste token, open composer, paste link, title, section, Post, Publish, Lock) → **at most 6** (open, Paste, title, Post and publish, token fill, nothing to lock) |
| Admin is never left open | Time the admin stays unlocked after a successful publish | **0 s** |
| Same safety as today | Token storage, CSP, third parties, validation rules | **unchanged** (one new owner-only draft key, see QA-07) |
| Nothing lost on the way | Draft survives switching apps or reloading the tab | **yes** |

## 4. Non-goals

- Storing the token on the device in any form, including a PIN- or passphrase-protected copy (decision D1).
- Passkey / WebAuthn PRF unlock (decision D2).
- A PWA share target (Android only; not needed for an iPhone-centred owner), a GitHub-issue workflow that commits for the owner, a bookmarklet, reading the clipboard without a tap, fetching page titles from third parties.
- Changing the content files, the validators or the publish guards.
- Removing the existing "Share a read…" / "Share a podcast…" composers (they stay for now; SPEC-UX decides).

## 5. Requirements

**QA-01 (P0): Quick add sheet.** One owner dialog, **Add to Studio**, opened from the ⚙ control and from the address `#add`. It opens **without a token** (nothing can be posted until the token is given). It is a proper dialog (labelled, focus trapped, Escape and Cancel close it and return focus). It is not linked from any visitor navigation.

**QA-02 (P0): Paste first.** The sheet opens with the link field focused and a **Paste from clipboard** button. The button reads the clipboard **only on the tap** (the browser shows its own confirmation where it does). A valid `http(s)` link is normalised (tracking parameters and fragment dropped, the same rule as Reads) and the destination is previewed in one line. Pasted share text that contains a link and a title line (`Title⏎https://…`) gives the link and prefills the title. Anything that is not a link gets an inline, announced message and changes nothing. Typing or long-press paste works the same.

**QA-03 (P0): Read or Podcast.** After the link is in, one choice: **Read** or **Podcast**. The sheet suggests Podcast for Spotify and Apple Podcasts links and Read otherwise; the owner can change it. Read shows Section (the last used, else the tab being viewed), Type, Tags and Take; Podcast shows Show, Tags and Take. Validation and limits are exactly those of the existing composers (`RL.validateEntry`, `RL.validatePodcastEntry`); no rule is duplicated.

**QA-04 (P0): Unlock just in time.** Pressing **Post** or **Post and publish** while locked opens the token prompt over the sheet. On success the same action continues; the draft is never lost. A wrong or expired token shows a clear message and stays on the prompt; Cancel returns to the sheet with the draft intact and nothing written. The token field is autofill-friendly for the iPhone Passwords app: a labelled username field (`autocomplete="username"`) with the password field (`autocomplete="current-password"`) in a form, and **no `autocomplete="off"`**. The token itself is still kept only in the tab's `sessionStorage`, never logged, never in the DOM text.

**QA-05 (P0): Post and publish in one action.** The primary button is **Post and publish** (adds the item and publishes the one affected file through the existing guarded flow of SPEC-PC PC-03: GET sha, refuse on unloaded or changed content, validate the whole file, skip identical, PUT). A secondary **Post as draft** keeps today's batching (Publish changes later).

**QA-06 (P0): Auto-lock after every successful publish.** On success the admin locks immediately: the token is removed, admin mode ends, a status line says "Published and locked". This applies to Quick add and to the existing **Publish changes** button. A failed or refused publish **stays unlocked** with the error, and the draft is kept so the owner can retry. The 30-minute idle lock and the manual lock stay.

**QA-07 (P1): The draft survives app switches.** The in-progress link, title, take, tags and kind are kept in this tab's `sessionStorage` under one owner-only key, written only after the owner uses the sheet, and restored when the sheet reopens in the same tab. It never contains the token. It is cleared on a successful publish, on Cancel and when the tab closes; an idle lock does not clear it (the owner resumes with a fresh unlock). A visitor never writes it. *This is the one new storage key in 2.0: the PRD release target "no new storage key" is amended to "no storage about visitors; one owner-only draft key".*

**QA-08 (P1): One-tap entry on iPhone.** Opening `…/#add` shows the sheet with the link field focused and the Paste button visible, from a cold start. The documented iPhone recipe is: open that address in Safari, Share, **Add to Home Screen**; the icon is the one tap. It works whether the icon opens in Safari or as a standalone web app (nothing relies on shared storage).

**QA-09 (P1, Phase B): Prefill by link.** `…/#add=<encoded link>` (optionally `&t=<encoded title>`) opens the sheet with those values filled. It only prefills: it never submits, and it shows "Prefilled from a link: check it". Values go through the same normalisation and validation; malformed, oversized or non-`http(s)` values are ignored with a message. The fragment is cleared from the address bar after it is read (the draft key carries the values on). The documented iPhone recipe is a **Shortcut** "Add to Studio" in the Share Sheet that opens this address with the shared link; it lives on the phone and is described, not shipped.

**QA-10 (P2): Not now.** See section 4.

## 6. Security and trust

- **Token:** unchanged where it lives (tab `sessionStorage`), how long (30 min idle) and who can see it (nobody: never logged, not in the DOM text). New: it is asked for at the moment of use, and discarded the moment a publish succeeds.
- **No new host, no new third party, CSP unchanged, no cookie.** The clipboard is read only on a tap, by the browser's own rules; its content is only a candidate link and is never logged or sent anywhere.
- **The sheet is reachable by anyone who types `#add`.** It does nothing for a visitor: without the owner's token no write is possible (the API refuses), the sheet holds no data, and it says it is an owner tool.
- **`#add=` links** can be crafted by a third party. They can only prefill a form the owner must review and submit with the token; they are validated like typed input and never auto-submit.
- **Draft key:** link, title, take, tags, kind only; owner-only; cleared on success and Cancel; never the token.
- **Autofill:** the token is stored by the iPhone Passwords app if the owner chooses (hardware-backed, biometric), not by the site. The site stores nothing new about the token.
- **Decisions recorded:** D1 a PIN-protected stored token is rejected: a short PIN protecting a copy of the token on the device can be guessed offline by anyone who gets the stored copy (a 6-digit PIN has 1,000,000 possibilities, and slow key derivation only adds a constant factor), and it would end the rule that the site never keeps the token. D2 passkey/PRF unlock is rejected for now: Safari support was reported to arrive in stages and with cross-device gaps ([Apple developer forum](https://developer.apple.com/forums/thread/774112), [Corbado write-up](https://dev.to/corbado/webauthn-prf-extension-related-origins-passkey-upgrades-5748)), too uncertain and complex for a static site.
- Full pre-implementation review: [security.md](../../security.md) §11.11.

## 7. Edge cases

| Case | Expected |
|------|----------|
| Clipboard holds no link, or something else | Inline message; field unchanged |
| Clipboard holds a title and a link | Link extracted, title prefilled |
| Clipboard holds `javascript:`, `data:` or a link with credentials | Refused with the same message as the composers |
| Owner opens `#add` while already unlocked | Same sheet; no prompt until needed |
| Token prompt cancelled | Back to the sheet, draft intact, nothing written |
| Wrong token | Message, stays on the prompt, draft intact |
| Publish refused (unloaded or changed content, SPEC-PC guards) | Stays unlocked, message, draft kept |
| Publish succeeds, then the owner adds another item | Sheet works; token asked again (by design) |
| Tab reloaded or switched away mid-add | Draft restored from this tab's draft key |
| iOS discards the tab | Draft may be lost with it; the owner pastes again (the clipboard link is usually still there) |
| `#add=` with an invalid or very long value | Ignored with a message; sheet opens empty |
| Visitor opens `#add` | Sheet opens; Post asks for a token; nothing can be written |
| Both the Quick add sheet and an inline composer used in one session | Both feed the same draft list and one publish |

## 8. Open questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Does the iPhone Passwords app offer the saved token (with Face ID) on our prompt once `autocomplete="off"` is gone and the username field exists? Cannot be confirmed from here; owner device check TC-QA-O01 | Owner | Not for the build; decides whether Face ID fill is part of the experience |
| Q2 | Home-screen icon as a plain Safari bookmark (recommended; no manifest, no new files) or as a standalone web app? | Owner | No (default: plain bookmark) |
| Q3 | Keep the two inline composers after Quick add exists? | Owner, with SPEC-UX | No (default: keep) |
| Q4 | Should an auto-locked session ever stay open for a second item (a "keep open" option)? Recommended: no | Owner | No (default: always lock) |

**Decisions (owner, 2026-10-23):** the scenario above is the target (link copied by instinct, one tap to paste, unlock only when needed, lock again); Auto-Lock after publishing is the default and the rule; iPhone first; build the build-order A (just-in-time unlock), B (autofill-friendly token field), C (post and publish, auto-lock) and G (home-screen entry) first, then D (prefill by link).

## 9. Rollout and phasing

| Phase | Contents | Gate |
|-------|----------|------|
| A | QA-01 … QA-08 (sheet, paste first, kind choice, just-in-time unlock, autofill-friendly field, post and publish, auto-lock, draft key, `#add` entry) | Smoke and unit tests; independent review (G4); owner device checks O01-O04, O06 |
| B | QA-09 (prefill by link, Shortcut recipe) | Smoke and unit tests; independent review (G5); owner device check O05 |

Mapping to the options discussed on 2026-10-23: A = QA-01, QA-02, QA-04 (just-in-time); B = QA-04 (autofill attributes); C = QA-05, QA-06; G = QA-08; D = QA-09.

Rollback: revert the merge commit; no content file or schema changes, the existing composers are untouched, so nothing else needs undoing.

## 10. Traceability

| Req | PRD ref | Tests (see test.md) | Code or doc touched |
|-----|---------|---------------------|---------------------|
| QA-01 | §9.4 | TC-QA-E01–E05 | `index.html`, `js/app.js`, `css/site.css` |
| QA-02 | §9.4 | TC-QA-P01–P07 | `js/app.js`, `js/reads-lib.js` (`extractLink`) |
| QA-03 | §9.4 | TC-QA-K01–K05 | `js/app.js`, `js/reads-lib.js` (`suggestKind`) |
| QA-04 | §14 | TC-QA-U01–U07 | `index.html`, `js/app.js` |
| QA-05 | §9.4 | TC-QA-L01–L02, L06 | `js/app.js` |
| QA-06 | §14 | TC-QA-L03–L05, L07 | `js/app.js`, `js/token-store.js` |
| QA-07 | §14 | TC-QA-D01–D04 | `js/app.js` |
| QA-08 | §9.4 | TC-QA-H01–H03 | `js/app.js`, docs |
| QA-09 | §14 | TC-QA-F01–F06 | `js/app.js`, `js/reads-lib.js`, docs |
| QA-10 | §16 | none | none |

## 11. Status log

- 2026-10-23: Draft created from the owner's scenario and the options discussion (paths A to H); PIN-protected token and passkey unlock evaluated and rejected (D1, D2); Safari autofill finding F3 recorded as unconfirmed on the device. Awaiting approval.
