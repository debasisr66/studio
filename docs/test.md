# Test Plan and Traceability — Studio

Releases: **v2.0 (in progress)** · **v1.6 (intermediate, 2026-10-22: SPEC-SH A and B, SPEC-RC A and B, SPEC-PC A, review gate)** · **v1.5 (shipped 2026-10-21: SPEC-TR)** · v1.4 (shipped 2026-10-20) · v1.3 (shipped) · v1.2 (shipped) · v1.1 (shipped). Result key: ✅ pass · ❌ fail (fixed) · ⏳ not run · 🔒 needs owner

---

# v2.0 — Studio 2.0 (in progress: SH A and B, RC A and B, PC A and B merged; UX, Phase C and the release remain)

Date: 2026-10-21 · Specs and per-requirement test cases: [SPEC-SH](specs/stabilize-core-hub/test.md) (28 cases), [SPEC-RC](specs/reads-categories/test.md) (32), [SPEC-PC](specs/podcast-links/test.md) (34), [SPEC-UX](specs/simple-layout/test.md) (22), [SPEC-QA](specs/quick-add/test.md) (56, added 2026-10-23): **172 new cases**, on top of the former **142 passing unit tests** (**271** now, plus a **131-case** browser smoke test). Every row below is ⬜ until its phase is built; results are filled in as each phase merges, never in advance. **SH Phase A (PR #12), SH Phase B (PR #13), RC Phase A (PR #14), PC Phase A (PR #15), RC Phase B (PR #16) and PC Phase B (PR #21) are run:** see §G, §H, §I, §J, §K and §L. **QA Phase A is built (PR open):** §M.

## A. Requirements (release level)

| REQ | Requirement | Spec requirements |
|-----|-------------|-------------------|
| REQ-50 | One failing section or content file never stops another section or the admin unlock; fetches are time-bounded | SH-01, SH-08 |
| REQ-51 | A dependency-free browser smoke test runs in CI and covers fallbacks, both widths and every section | SH-02, SH-05 |
| REQ-52 | Every content file has a documented contract and a version where it changed; asset rules; owner operations guide | SH-03, SH-04, SH-06, SH-07 |
| REQ-53 | Every read and book has a category; migration loses nothing; validator and fixtures enforce it | RC-01, RC-05, RC-06 |
| REQ-54 | Reads has Technical and Others sub-items: accessible tabs, deep links, composer section, counts, books in the same list | RC-02, RC-03, RC-04, RC-07, RC-08 |
| REQ-55 | Podcast data, validation, duplicate handling and seed content | PC-01, PC-04, PC-07, PC-08 |
| REQ-56 | Podcasts section and admin replace the Blog; `#blog` redirect; blog archived; Reads no longer offers the podcast format | PC-02, PC-03, PC-05, PC-06 |
| REQ-57 | Simpler layout: one fixed order, one section pattern, both navs identical and in page order, all deep links stable, accessibility and first-screen clarity | UX-01 … UX-06 |
| REQ-58 | Nothing else breaks: products, updates, sync, health, keep-alive, profile, What's new, admin publish, CSP, budgets | all |
| REQ-59 | All artefacts updated and traceable PRD → spec → test → release | all |
| REQ-60 | Quick add: paste first, Read or Podcast in one sheet, just-in-time unlock with an autofill-friendly token field, post and publish in one action, auto-lock after every successful publish, owner-only draft, `#add` home-screen entry | QA-01 … QA-08 |
| REQ-61 | Prefill by link (`#add=…`) that only prefills and never submits | QA-09 |

## B. Traceability (requirement → spec → cases → status)

| REQ | Cases | Status |
|-----|-------|--------|
| REQ-50 | TC-SH-I01–I05, T01–T02 | ✅ (SH Phase A) |
| REQ-51 | TC-SH-B01–B09 | ✅ B01–B04 · ⬜ B05–B09 (Phase C) |
| REQ-52 | TC-SH-C01–C03, V01–V04, D01–D02 | ✅ (SH Phase B) · ⬜ A01–A03 (Phase C) |
| REQ-53 | TC-RC-D01–D04, M01–M03, V01–V04, X01 | ✅ (RC Phase A; X01 library half only, the third-tab half arrives with RC Phase B) |
| REQ-54 | TC-RC-U01–U08, L01–L04, E01–E04, S01–S02, B01–B02 | ✅ U, L, E (RC Phase B) · ⬜ S01–S02, B01–B02 (Phase C) |
| REQ-55 | TC-PC-D01–D03, V01–V07, N01–N02, S01 | ✅ D01–D03, V01–V07 (PC Phase A) · ⬜ N01–N02 (Phase C) · S01 owner step 🔒 |
| REQ-56 | TC-PC-U01–U08, A01–A06, R01–R05, K01–K02 | ✅ U, A, R01–R04 (PC Phase B) · ⬜ R05 (release PR), K01–K02 (Phase C) |
| REQ-57 | TC-UX-S01–S02, P01–P04, N01–N05, L01–L05, A01–A05, F01 | ⬜ (F01 owner step 🔒) |
| REQ-58 | Regression suite (§D) | ⬜ |
| REQ-59 | Artefact checklist ([plan.md](plan.md) "Artefact update matrix") | ⬜ |
| REQ-60 | TC-QA-E01–E05, P01–P07, K01–K05, U01–U07, L01–L07, D01–D04, H01–H03, S01–S03, X01–X02 ✅ (§M); O01–O04, O06, O07 | ✅ except O: owner steps 🔒 |
| REQ-61 | TC-QA-F01–F06, O05 | ⬜ (O05 owner step 🔒) |

## C. Test strategy by layer

| Layer | What | Where | Written |
|-------|------|-------|---------|
| Unit (Node `--test`) | Pure modules: category helpers, platform labels, validators, contract-doc completeness | `tests/*.test.js`, `tests/fixtures/` | Before the code, shown failing |
| Browser smoke (headless Chrome, no npm) | Rendering, fallbacks, nav, redirects, tabs, overflow at 375 and 1280 px | `scripts/smoke.js` + `tests/fixtures/site/` | Harness first (SH Phase A), cases added with each feature |
| Stubbed-API publish | Podcast and reads publish writes one valid file, skips identical content | unit with a fake fetch | With PC and RC phases |
| Visual comparison | Untouched sections identical to frozen v1.5 (computed styles, as in earlier releases) | scratch harness, results recorded here | Each UI phase |
| Manual/owner | Real admin publish of a read and a podcast; real phone; screen reader pass | owner | Release gate |
| Live | Post-merge smoke, health check, sync run | GitHub | After each merge |

## D. Regression suite (must stay green at every phase)

| Area | Checks |
|------|--------|
| Core | Products grid, Updates feed, version badge, What's new, profile photo, theme toggle, mobile bottom nav |
| Pipeline | `node scripts/sync-products.js` dry run, sync, health, keep-alive, CI; `git diff main -- .github` shows only the smoke step |
| Admin | Unlock, lock, idle lock, publish reads, publish podcasts, publish photo; token never persisted |
| Safety | CSP validator, no inline code, no new third-party host, URL rules, escaping with XSS payloads |
| Budgets | `validate-site.js` size budgets; `app.js` stays under 80 KB |
| Accessibility | Keyboard-only pass, focus order, contrast, reduced motion, 200% zoom, 375 px no horizontal scroll |
| Data | Migration before/after comparison; v1.5 code renders migrated data (rollback proof) |

## E. Release gates for v2.0

1. All P0 cases in the four test plans ✅; P1 ✅ or deferred in writing with the owner's agreement.
2. 142 existing tests unchanged and green; new unit tests green; smoke test green on the PR.
3. Visual comparison: Products, Updates, header, footer identical to v1.5 except intended nav and footer changes.
4. Owner steps done: real publish of a read and a podcast; seed podcasts present; classification confirmed.
5. Security review log for v2.0 completed ([security.md](security.md) §11 checklist).
6. Artefacts updated; spec statuses set to Shipped; `v2.0` tag; live smoke and health green.

## G. Results: SH Phase A (2026-10-21, PR #12)

| Check | Result |
|-------|--------|
| Unit tests | **153 of 153 pass** (142 existing + 11 new in `tests/safe-lib.test.js`); the 11 failed first (module missing) |
| Browser smoke test (`node scripts/smoke.js`) | **13 of 13 pass**: 16 s locally, **29 s on GitHub's runner**, no npm package |
| Failing first | Against the unguarded v1.5 page 7 of 13 cases failed locally (blank sections after a throwing one, no version badge, admin never switched on, page held forever by a hung file); the `null`-files case also failed on old code |
| Red proof in CI (TC-SH-B04) | Throwaway branch with the old `app.js`: unit tests and validator green, **only the smoke step red** (6 of 13 passed, 43.8 s); branch deleted |
| Validator | OK (new `js/safe-lib.js` inside its 10 KB budget); `index.html` diff is one added `<script src="js/safe-lib.js">` |
| Workflow diff | `ci.yml`: one added step (timeout 2 min); permissions unchanged (`contents: read`) |
| Regression | Existing smoke B01 on the real content passes; render functions are untouched (diff confined to `boot`, `loadJson`, `renderAll`); products, updates, reads, blog, version, admin gear present |
| Not done in this phase | Owner admin publish (no publish code changed), visual comparison against frozen v1.5 (render code and CSS unchanged; the smoke test is the check), B05-B09 and the contract, versions and operations work (Phases B and C) |

---

## H. Results: SH Phase B (2026-10-21)

| Check | Result |
|-------|--------|
| Unit tests | **164 of 164 pass** (153 + 11 new in `tests/spec-sh-phase-b.test.js`); 8 of the new ones failed first; a spurious pass of the real-file version test was caught and strengthened |
| Browser smoke | **15 of 15 pass** in 18 s (two new cases: reads without a version renders; reads with a newer version shows the Reads fallback only) |
| Contract enforcement | CI now fails if a file in `content/` or a rule id is not in `docs/CONTRACT.md` (C01-C03) |
| Schema version | `reads.json` carries `schema_version: 1`; rule `reads-schema-version` has a fixture and a runbook row (TR-04 guard); the admin publish writes the key through one tested serializer |
| Operations guide | Add, hide, retire and recategorise a product executed as written; outputs match; docs corrected for one warning |
| Docs links | A test checks every relative link and heading anchor in README and docs/ |
| Not done | A stubbed-API test of the admin publish (guard against publishing over a newer file is by code inspection); `podcasts.json` version (arrives with SPEC-PC); Phase C items |

---

## I. Results: RC Phase A (2026-10-22, PR #14, merged as `122e3d1`)

| Check | Result |
|-------|--------|
| Unit tests | **181 of 181 pass** (164 + 17 new in `tests/spec-rc-phase-a.test.js`). Written first: **25 of 181 failed** (the 17 new, plus 8 existing tests I updated to the version 2 contract: `TC-SH-V01-V04`, `TC-TR-X01` and two `validate-site` cases) |
| Browser smoke | **17 of 17 pass** in 18.7 s (two new cases: reads with a missing, unknown or odd category all render with no console error; the admin composer publishes a new read with `category` and `schema_version` 2, with the GitHub API stubbed in the page). The existing real-content case now also requires the 5 reads to render |
| Case checked for real failure | With the serializer's category fill disabled the composer case failed ("6 published entries have no valid category"); restored and green |
| Validator | OK, 0 errors, 0 warnings; rule `reads-category` has a fixture, a CONTRACT entry and a RUNBOOK row (TR-04 and SH-03 guards green) |
| Migration, before and after (`git show main:content/reads.json` vs the new file) | `schema_version` 1 → 2; 5 reads → 5, 1 book → 1; id, url, title, comment, tags, kind and added identical for every read; title, author, year and note identical for the book; with `category` removed the two files are deep-equal. Categories: all 5 reads and the book `technical` (owner-confirmed 2026-10-21). Kept as the permanent snapshot `tests/fixtures/reads-before-rc-a.json` that `TC-RC-M01` compares against |
| Rollback proof (TC-RC-M03) | The `v1.5` tag exported to a scratch folder, the migrated `reads.json` copied in, the smoke "real content" case run against it: **passes**, products and updates render, all 5 reads render, no console errors. v1.5 code contains no `schema_version` logic, so it ignores the new keys. Note: the SH Phase B code (current `main`, supports only version 1) would show the Reads fallback line for a version 2 file; that is why the code and the data change in one commit, and rollback means the `v1.5` tag |
| Correction (2026-10-23) | TC-RC-M01-M03 first compared the *live* `content/reads.json` with the before snapshot, so the owner's first real publish (two new reads) turned CI red on `main`. They now compare two frozen fixtures (`reads-before-rc-a.json`, `reads-after-rc-a.json`); the live file is only checked by the validator and for a category on every entry. Rule: no test may depend on live content |
| Not done in this phase | No visible UI (by design); sub-item tabs, deep links and the composer Section choice (RC Phase B); the `TC-RC-X01` third-tab half; owner real-publish of a read (no visible change yet) |

---

## J. Results: PC Phase A (2026-10-22)

| Check | Result |
|-------|--------|
| Unit tests | **194 of 194 pass** (181 + 13 new in `tests/spec-pc-phase-a.test.js`). Written first: **13 of 194 failed** (every new test; the helpers and validator did not exist). After the build, 5 further tests failed until the contract and runbook rows existed (`TC-SH-C02`, `TC-TR-D02`, `TC-PC-V06`), which is the guard doing its job |
| Browser smoke | **17 of 17 pass** in 19.7 s, unchanged: the page does not load `podcasts.json` and `index.html` and `app.js` are untouched, so there is nothing new to see |
| Validator | OK, 0 errors, 0 warnings. A deliberately bad `podcasts.json` (blank title, `javascript:` link) made it print `FAILED` with both errors; the file was restored |
| New rules | 8: `podcast-url-clean`, `-title`, `-schema-version`, `-duplicate-url` (warning), `-tags`, `-comment`, plus `-show` and `-duplicate-id` (added to mirror Reads). Each has a failing fixture, a RUNBOOK row and a CONTRACT entry (TR-04 and SH-03 guards green); `good.json` raises none |
| Data | `content/podcasts.json` = `{ "schema_version": 1, "podcasts": [] }` (seed links are the owner's, Phase C) |
| Helpers (`js/reads-lib.js`) | `platformOf` (closed host list, exact host or subdomain, so `evilspotify.com` and `spotify.com.evil.io` stay plain domains), `podcastView`, `isSupportedPodcastsVersion`, and `keyOf` now exported for the duplicate check |
| Design note | Duplicate-link check keeps the query string, unlike the Reads one, so two YouTube videos (`?v=`) are not flagged as the same link. The Reads check still ignores the query (a pre-existing quirk, not changed here) |
| Not done in this phase | Everything visible: section, nav, composer, `#blog` redirect, blog removal, health check of `podcasts.json` (added when the page uses it), PC-06 to PC-08 |

---

## K. Results: RC Phase B (2026-10-22)

| Check | Result |
|-------|--------|
| Unit tests | **203 of 203 pass** (194 + 9 new in `tests/spec-rc-phase-b.test.js`); all 9 failed first |
| Browser smoke | **38 of 38 pass** in 32 s (17 + 21 new). Before the build, 22 of the 23 RC cases failed (the 21 new, plus the Phase A composer case now choosing a section) |
| What the cases prove | Tab list, ARIA wiring, counts (U01); click and Left/Right/Home/End with wrap and focus (U02); switching clears filters (U03); defaults (U04); empty states and a hidden toolbar (U05); 375 px fit and 44 px targets (U06); contrast of selected and unselected tabs in both themes, measured from computed colours (U07); no-match hint that switches section (U08); `#reads`, `#reads/technical`, `#reads/others`, `#reads/xyz`, `#reads/__proto__` (L01-L03); no scroll jump, no new history entry, hash change switches tab (L04); composer radios, inline announced error, remembered section, published under the chosen section, editing moves an entry, XSS payloads inert (E01-E04); book editor Section (E05); a runtime-added category gets a third tab (X01) |
| Visual check | Real content at 1280 px (light) and 375 px (dark) in the built-in browser: tabs show `Technical 6` (5 reads + 1 book) and `Others 0`; Others shows the empty text; no horizontal overflow. Found by looking: the empty section still showed the search box (`.toolbar` display overrode `hidden`), fixed and covered by U05 |
| Harness fix | Each smoke case now loads a fresh URL (`?case=N`); a hash-only navigation does not reload, so deep-link cases silently inherited the previous page's state (found when `#reads` and `#reads/xyz` cases failed) |
| Validator | OK; `app.js`, CSS and `index.html` inside budget; no inline style or script; no new host |
| Not done | RC-07 (share and copy re-checked, counts while filtering) and RC-08 (books in one column) are Phase C; a real-phone and screen-reader pass is an owner step; the mobile bottom nav highlights Blog while Reads is on screen (existing behaviour, SPEC-UX) |

---

## L. Results: PC Phase B (2026-10-23)

| Check | Result |
|-------|--------|
| Unit tests | **235 of 235 pass** (218 + 15 in `tests/spec-pc-phase-b.test.js` + 1 in `tests/safe-lib.test.js` + 1 guard-test); 12 of the first 13 failed first, and the review-fix tests failed first as well. One earlier Phase A assertion ("the page does not load podcasts.json yet") was replaced because Phase B changes exactly that |
| Browser smoke | **66 of 66 pass** in 55 s (38 + 22 new, then 6 more for the review's fixes: A08 to A11, six cases, all failed first). Before the first build 35 of 60 failed: the 22 new cases plus the Podcasts-dependent isolation and timing cases. Three new cases first passed with nothing on the page (a vacuous pass), so they now require the 5 cards to exist |
| What the cases prove | Blog gone and Podcasts in both navs (U01); card fields and platform labels from the host (U02); Listen opens a new tab with `noopener noreferrer` (U03); share controls on every card (U04); newest first, search and chips only from 4 entries (U05); empty state (U06); no iframe, audio, video, embed or image, and no request leaves the origin (U07); no overflow at 375 and 1280 px (U08); composer hidden from visitors, shown when unlocked (A01); required fields, inline announced errors (A02); preview matches the card (A03); edit and delete stay a draft, no write before Publish (A04); Publish writes one file, once, valid, link normalised; an identical file is skipped (A05); XSS payloads inert (A07); no blog editor left (A06); `#blog`, `#blog/some-old-post` and a `#blog` link followed while the page is open all land on Podcasts (R01); `blog.json` not fetched, `podcasts.json` fetched, no archived post on the page (R02); the section fails alone on a newer `schema_version` and shows its empty state when the file is missing or `null` |
| Validator | OK; `app.js` 51 KB, `reads-lib.js` 17 KB, inside budget; no inline code or style; CSP unchanged |
| Health check | Now also confirms `/content/podcasts.json` is served and still confirms `/content/blog.json` |
| Test fix found on the way | `TC-SH-S08` (hardening test) failed once in a full run: its "is it dead" check could see a killed process as a zombie for several seconds on a loaded machine. It now treats a zombie as dead and waits up to 10 s; 6 further full runs and a run under CPU load were green. The failure could not be reproduced, so this is the likely cause, not a proven one |
| Independent review | [reviews/PC-B.md](reviews/PC-B.md): Opus 5.5, first verdict APPROVE WITH CONDITIONS (three medium findings: a failed load could be published over, a stale or concurrent publish could lose content, an edit index could go stale after a delete), after the fixes **APPROVE**; three small follow-ups fixed after the verdict and not re-checked by the reviewer |
| Not done | PC-06 (Reads composer still offers Podcast), PC-07 duplicate warning in the composer, PC-08 seed podcasts (owner supplies the links), R05 (the 2.0 changelog), a real publish of a podcast by the owner, real-phone and screen-reader passes |

## M. Results: QA Phase A, Quick add (2026-10-23)

| Check | Result |
|-------|--------|
| Unit tests | **262 of 262 pass** (241 before; +20 in `tests/spec-qa-phase-a.test.js`, +1 in `tests/make-sandbox.test.js`). All failed first (18 of 19 of the first set; the sandbox case; the review-fix test later) |
| Browser smoke | **117 of 117 pass** in about 73 s locally (66 before; +51 `TC-QA-*` cases, 45 first, 5 more for review findings F1, F2, F3, F5/F7, N1, 1 for the owner's feedback). Before the build the 45 new cases all failed and the 66 old ones passed. The GitHub API and the clipboard are stubbed inside the page, so nothing left the machine and no token existed |
| What the cases prove | sheet opens from the gear, `#add` (focus on the link) and the owner bar, closes with Escape and Cancel, focus returns, focus trap (E); paste only on the tap, share text, refusals, tracking removal, hand paste (P); kind suggestion and parity with both composers over a table of inputs (K); token prompt over the sheet, wrong and foreign token, Cancel, real login-form markup, token nowhere but its one key, no API call before a token (U); one PUT per publish with the item in the right file, draft mode writes nothing, lock after success in both publish paths and not after failure, retry works, PC-B guards hold (L); draft restore, contents, key set, Cancel and Escape clear it, idle lock keeps it (D); 375 px layout and 44 px targets, `#adds` and `#add/x` ignored (H); XSS inert, visitor Post makes no call (S) |
| Existing case changed | `TC-PC-A05`: its second half needed the admin still unlocked, but a successful publish now locks. It unlocks again first; without that its second half would have passed vacuously. `scripts/smoke.js` also gained a per-case `init` script and a `fast` flag, prints the time of cases slower than 2 s, and its default watchdog is 110 s (CI needs about half) |
| Validator | OK. `reads-lib.js` is 24 KB: its budget was raised from 20 to 26 KB (it stood at 20,198 of 20,480 bytes before any Quick add code); the total budget is unchanged. CSP, no inline code or style, no cookie: unchanged and tested |
| Visual check | 375 px and about 1280 px, dark and light, in the browser pane: sheet, podcast mode, restored draft, token prompt over the sheet. No defects seen. Not a real iPhone |
| Independent review | [reviews/QA-A.md](reviews/QA-A.md) (Opus 5.5). First verdict REJECT (a Post before the page had loaded could have replaced the whole published list; Cancel during the token check still stored the token), plus lower findings. All fixed tests-first; the re-check verdict is in the record |
| Owner device checks (sandbox, Chrome on iPhone, 2026-10-23) | Paste, post, publish and auto-lock work; **O01 and O03 reported working**; the unpublished link is kept and can be published after logging in again. Feedback: unlock-only was a small link, now an **Edit or delete items** button (TC-QA-E06, added after the review: a layout and label change only) |
| Not done or not verified | O02 and the O06 timing were only reported informally; **O04 and O07 reported passed**: the Home Screen icon opened the sheet by itself (an accidental tap, not a timed cold-start test; the browser it opened in was not recorded separately). Real GitHub API behaviour (stubs only). Whether Chrome's password manager offers and saves the token on a readonly-username form is unknown until O01. Reads publish still has no whole-file validation (older code; podcasts has it). Phase B (`#add=`) not started |

## N. Results: QA Phase B, prefill by link (2026-10-23)

| Check | Result |
|-------|--------|
| Unit tests | **271 of 271 pass** (262 before; +9 in `tests/spec-qa-phase-b.test.js`); all 9 failed first (the unit count did not change with the review fixes, which are browser cases) |
| Browser smoke | **131 of 131 pass** in about 81 s locally (117 before; +9 cases first: F01 x3, F02, F03 x2, F04, F05, S01 for `#add=`; +5 for review findings F1, F2, F3, F5, tagged `F06b`); all 14 failed first, the 117 old ones passed |
| What the cases prove | a prefill fills the link (normalised, tracking and fragment dropped) and the title, suggests Podcast for Spotify, shows "Prefilled from a link: check it", and sends nothing and posts nothing, even with the admin already unlocked (F01); a prefill arriving while the page is open replaces the sheet's older draft and the banner goes when the owner edits (F01); malformed encoding, 5,000-character values, `javascript:`, `data:` and credential links are ignored with a message and the sheet opens empty; a bad title is dropped, the link kept (F03); the address is cleaned, no new history entry, the draft key carries the values through a reload (F04); `__proto__`, `constructor`, repeated keys: first wins, no error, no prototype change (F05); XSS payloads in link and title stay inert in the sheet, preview, banner and published card (S01) |
| Validator | OK; `reads-lib.js` is 26,005 of 26,624 bytes (tight: the next addition needs the budget or a split) |
| Independent review | [reviews/QA-B.md](reviews/QA-B.md) (Opus 5.5, gate G5): first verdict APPROVE WITH CONDITIONS; the one medium finding (a crafted link arriving while the token prompt is open or a publish is running could change what the owner sees while the earlier entry is posted) and four low ones were fixed tests-first; the re-check verdict is in the record |
| Not done or not verified | O05 (the Share Sheet Shortcut on a real iPhone: whether the fragment survives the plain `https://` and the `googlechromes://` forms) is the owner's; the Shortcut is described in OPERATIONS, not shipped |

---

## F. Not claimed in this plan

Real screen-reader and physical-phone passes are owner steps; layout clarity is judged by the owner walk-through (no analytics by design).

---

# v1.5 — Trust and reliability (SPEC-TR)

Date: 2026-10-21 · Spec and per-requirement test cases: [docs/specs/product-trust-reliability/](specs/product-trust-reliability/spec.md) (`TR-nn`, `TC-TR-*`). Tests were written first and shown failing before each phase's code.

| REQ | Requirement | Spec | Tests | Result |
|-----|-------------|------|-------|--------|
| REQ-44 | One strict URL rule (no whitespace/control characters/credentials, http(s) only, ≤ 2048) for every URL field; `cache.json` envelope checked (`synced_at`, `stars`, orphans) | TR-01, TR-02 | TC-TR-U01–U09, C01–C07 | ✅ |
| REQ-45 | A failed product keeps its data, is reported by name and reason, and the sync run goes red after committing the good products | TR-05 | TC-TR-S01–S06 (S06 = drill on a throwaway branch) | ✅ |
| REQ-46 | Sync freshness = last successful sync run within 48 h (not cache age); API failure is a note | TR-06 | TC-TR-H01–H03, H05 (H04 by inspection) | ✅ |
| REQ-47 | Registry integrity (slug, category), every content rule has a failing fixture, release parity to asset level, missing repos and orphan cache entries reported | TR-03, 04, 07 | TC-TR-R01–R04, X01–X02, H06–H09 | ✅ |
| REQ-48 | Every health problem has a `Fix:` pointer; one runbook covers every rule and message; runbook commands executed as written | TR-08, 09, 10 | TC-TR-H10, D01–D04 | ✅ |
| REQ-49 | Protection policy recorded with revisit triggers; nothing else breaks | TR-11, 13 | TC-TR-D05–D06, N01, N02, N05 | ✅ (N01 on the PR) · ✅ N04 owner published a read with the separate admin token (2026-10-21) · page code untouched, so N03 not repeated |

**Unit tests: `node --test tests/*.test.js`: 142 of 142 pass** (102 before; +14 Phase A, +12 Phase B, +14 Phase C). Validator OK on real content with no new warning; `git diff main -- .github` is one condition line in `sync.yml` (no permission change). Live health check healthy; with a wrong asset pattern and a missing repo injected it went red with Fix pointers (restored afterwards).

---

# v1.4 — Self-hosted fonts, protected main, keep-alive, profile photo, logo

Date: 2026-10-20 · Environment: macOS, Node v25.2.1, Claude desktop browser pane (Chromium), local static server. No real token and no real photo were used anywhere: a clearly fake test token, a stubbed GitHub API and generated images stand in. Where the real thing is needed, the test is listed under §F as pending.

## A. Requirements

| ID | Requirement |
|----|-------------|
| REQ-31 | Fonts are self-hosted: no request leaves the page for a third party, and rendering is identical to before (including the rupee sign) |
| REQ-32 | CI forbids third-party hosts in `style-src` and `font-src`, external links, external CSS urls and unsafe SVG; requires font licences, rupee coverage and a sane stylesheet |
| REQ-33 | The logo is the header mark and the favicon and is recognisable at small sizes |
| REQ-34 | Profile photo: owner-only upload; only PNG, JPEG, WebP; size and pixel limits; centre-cropped 512 px JPEG; metadata removed; published as two single-file commits; shown with a monogram fallback |
| REQ-35 | The published photo and its manifest are validated in CI |
| REQ-36 | The admin idle lock is unit-tested |
| REQ-37 | Keep-alive adds a commit only when `main` is quiet (or forced), and the decision is unit-tested |
| REQ-38 | Actions are pinned by commit hash, workflows declare minimum permissions, and CI enforces both; Dependabot keeps pins current |
| REQ-39 | The health check runs after the (late) scheduled sync and reports any disabled workflow |
| REQ-40 | The header fits at every window width |
| REQ-41 | Branch protection works without breaking publishing or the bots (history protected for everyone; CI gating tested) |
| REQ-42 | Nothing else breaks |
| REQ-43 | All artefacts updated |

## B. Traceability matrix

| Req | Test cases | Result |
|-----|-----------|--------|
| REQ-31 | TC-F01–F04 | ✅ |
| REQ-32 | TC-V20–V30 | ✅ |
| REQ-33 | TC-L01–L03 | ✅ (16 px: see note) |
| REQ-34 | TC-P01–P10 | ✅ with generated images; ⏳ real photo through the OS picker (owner) |
| REQ-35 | TC-V25–V27 | ✅ |
| REQ-36 | TC-K20–K23 | ✅ |
| REQ-37 | TC-A01–A10 | ✅ |
| REQ-38 | TC-W10–W14, TC-W15 | ✅ |
| REQ-39 | TC-H10–H13 | ✅ (first scheduled 12:00 UTC run still to come) |
| REQ-40 | TC-E01 | ✅ |
| REQ-41 | TC-B01–B07 | ✅ history protected; CI-required ruleset tested and **not kept** (see §C) |
| REQ-42 | TC-R17–R21 | ✅ |
| REQ-43 | TC-D04 | ✅ |

## C. Test cases and results

**Unit tests: `node --test tests/*.test.js`: 102 of 102 pass** (validator 40, reads/date/asset 21, token store and idle lock 12, image rules 9, health 8, keep-alive 8, sync 4).

### Fonts and third parties (REQ-31, REQ-32)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-F01 | Fresh load: every request goes to the same host; the fonts are fetched from `/fonts/`; the Latin file loads and the Latin Extended files are fetched only when a character needs them; no Google host appears | ✅ |
| TC-F02 | **First attempt (Latin only) failed the visual comparison**: 32 differences in Penny's release notes, which contain the rupee sign U+20B9 (it lives in Inter's Latin Extended subset). Fixed by self-hosting both subsets | ❌ → ✅ (DEF-10) |
| TC-F03 | After the fix: 24 cases (375/768/1280 px × dark/light × 4 states) against v1.3: **0 differences**. The harness was first shown to fail on a deliberate padding and colour change (25 differences) | ✅ |
| TC-F04 | The page and stylesheet contain no `googleapis` or `gstatic` references; CSP is `style-src 'self'; font-src 'self'` | ✅ |
| TC-V20 | CSP with a third-party host in `style-src` or `font-src` is rejected; self-only passes | ✅ |
| TC-V21 | External stylesheet, font and script links (including URLs with a query string and protocol-relative ones) are rejected. *The first version of this rule missed URLs containing `?`, which is the form Google Fonts used; the test caught it* | ✅ (DEF-13) |
| TC-V22 | CSS: external `url()` and `@import` rejected; relative `url()` targets must exist; `data:` allowed | ✅ |
| TC-V23 | Each font file needs a matching licence file and stays under 150 KB | ✅ |
| TC-V24 | The Inter faces must cover U+20B9 (the rule fails on a Latin-only build, passes with the Extended file) | ✅ |
| TC-V28 | Stylesheet sanity: the colour tokens and the light theme must still exist. *Added after a splice of mine removed them and left the page unstyled (7,836 differences in the comparison)* | ✅ (DEF-11) |
| TC-V29 | SVG assets: no script, event handlers, `foreignObject`, `javascript:` or external references; size budget (7 hostile variants) | ✅ |
| TC-V30 | Real repo: validator reports 0 errors; it reported 5 (Google references), then 1 (rupee coverage), then 0 as each fix landed | ✅ |

### Logo (REQ-33)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-L01 | `assets/logo.svg` loads as the header mark (28 px, decorative `alt=""`) and as the favicon | ✅ |
| TC-L02 | The three concepts were rendered and reviewed; options 2 and 3 were redrawn once after review; the owner chose option 2 | ✅ |
| TC-L03 | Recognisable at 128, 32 and 16 px. *At 16 px the fine cells blur; the dark tile, purple grid and amber top-right cell remain, which is what identifies it* | ✅ with that note |

### Profile photo (REQ-34, REQ-35)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-P01 | 1600 × 900 PNG becomes a 512 × 512 JPEG (data URL, signature `/9j/`, 4 KB); centre crop verified by colour (left red, centre green, right blue); 600 × 1000 WebP also becomes 512 × 512 | ✅ |
| TC-P02 | Transparent PNG becomes white, not black | ✅ |
| TC-P03 | **Metadata removal**: a JPEG with an injected EXIF-style segment containing GPS coordinates and a camera name goes in; none of it is present in the output | ✅ |
| TC-P04 | Quality stepping: a 4.7 MB noise image comes out at 115 KB (under the 150 KB limit); stepping logic also unit-tested | ✅ |
| TC-P05 | Rejections with plain messages: SVG, an SVG disguised as PNG, GIF, PDF, a corrupt PNG, an empty file, a 64 px image, an 11 MB file | ✅ |
| TC-P06 | Preview dialog: opens on its title, shows a round JPEG preview with alt text, states that the photo becomes public and that location and camera details are removed; Cancel keeps nothing | ✅ |
| TC-P07 | "Use this photo": draft saved, hero shows it, monogram hidden, admin bar says "Unpublished: profile photo" | ✅ |
| TC-P08 | Publish (stubbed API): `GET` then `PUT content/profile.jpg` (no SHA, new file), then `GET` then `PUT content/profile.json` (with the existing SHA); messages "cms: update profile photo" and "cms: show profile photo"; manifest has the path and an ISO timestamp; result dialog lists both | ✅ |
| TC-P09 | Publishing the same photo again: both files report "unchanged" and the manifest timestamp is kept | ✅ |
| TC-P10 | After publishing and a later re-render the hero keeps the local photo (no flash to the not-yet-deployed URL) | ✅ (DEF-14) |
| TC-V25 | CI: a 512 × 512 JPEG under 200 KB passes; PNG, SVG and HTML posing as `profile.jpg` fail; oversized, over 1024 px and under 128 px fail | ✅ |
| TC-V26 | CI: `profile.json` accepts "no photo" and a valid path with a UTC timestamp; rejects external URLs, `..`, other extensions and odd timestamps | ✅ |
| TC-V27 | CI: a manifest pointing at a missing file is an error; a stray photo with no manifest only warns | ✅ |
| TC-P11 | Visitor view with no photo: monogram shown, no request for a photo, **no console error** | ✅ |
| TC-P12 | Zero CSP violations across the whole upload, preview, publish flow | ✅ |

### Admin session and idle lock (REQ-36)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-K20 | Idle lock fires once after the idle time and is then no longer armed | ✅ |
| TC-K21 | Activity restarts the countdown and never leaves two timers | ✅ |
| TC-K22 | `disarm` cancels, and is safe when not armed | ✅ |
| TC-K23 | Works with the real timers by default | ✅ |
| (carried) | A reload in the same tab keeps the admin session (token in `sessionStorage`), as designed | ✅ observed again |

### Keep-alive, workflows, health (REQ-37 to REQ-39)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-A01–A08 | Decision unit tests: recent means no commit; at or past 30 days means a heartbeat; threshold configurable; forced always; unreadable date means a harmless heartbeat; future date never; message stable and short; default is 30 days | ✅ |
| TC-A09 | Dry runs on the real repo: "no heartbeat needed: last commit 0 days ago" and "would add a heartbeat commit: forced" | ✅ |
| TC-W10 | Workflow rule: actions pinned by a 40-character hash pass; tags, branches and short hashes fail | ✅ |
| TC-W11 | Every workflow declares top-level permissions | ✅ |
| TC-W12 | `contents: write` only in the sync and keep-alive workflows; `write-all` and other write scopes rejected | ✅ |
| TC-W13 | The rule flagged exactly the 5 unpinned lines in the real workflows before pinning, and passes after | ✅ |
| TC-W15 | CI on pull request #1 (the first release through a pull request): job `check` succeeded on GitHub (Node 22, pinned `checkout` and `setup-node`, 102 tests and the validator); merge state clean | ✅ |
| TC-W14 | Both pinned hashes verified to be the commits of `v4.4.0` (and of the `v4` tag); all five workflow files and the Dependabot file parse as valid YAML; `sync.yml` differs only by the pinned hash | ✅ |
| TC-H10 | Health logic: all workflows active is clean; every non-active workflow is named with its state; missing or odd input tolerated | ✅ |
| TC-H11 | Health schedule moved to 12:00 UTC after observing scheduled runs start 4–5 hours late (03:00 cron ran at 07:26–08:24 UTC); `actions: read` added | ✅ |
| TC-H12 | Key-file list extended to the new assets (stylesheet, logo, fonts, scripts, changelog, profile manifest) | ✅ |

### Header fit (REQ-40)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-E01 | Overflow sweep over 26 widths from 320 to 1920 px. **v1.3 (live) overflowed at 621 px (+23 px) and 640 px (+4 px)**; v1.4: none at any width | ✅ (DEF-12) |

### Visual comparison, final build (REQ-42)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-R17 | 24 cases against v1.3: 480 differences, **all inside the header (logo, tagline, spacing) or the hero (the new photo area)**; none anywhere else | ✅ |
| TC-R18 | Phone layout measured: photo 72 px, logo 28 px, header buttons 44 px, no horizontal scroll | ✅ |
| TC-R19 | `git diff main` over `.github`, `scripts`, `content`: only the intended files; `sync-products.js`, products, blog, reads and cache are unchanged | ✅ |
| TC-R20 | Sync dry run: both products fetched, "No changes" | ✅ |
| TC-R21 | No token-like strings in the repository, docs, tests or content | ✅ |

### Documentation

| ID | What it checks | Result |
|----|----------------|--------|
| TC-D04 | Plan, impact, design, test, build, model-use, security, architecture, learning guide, README, changelog updated | ✅ |

## D. Defects found during v1.4

| ID | Defect | Found by | Fix |
|----|--------|----------|-----|
| DEF-10 | Latin-only self-hosted fonts changed the width of the **rupee sign** (it is in the Latin Extended subset) | Visual comparison (32 differences) | Both subsets self-hosted; CI rule requires U+20B9 coverage |
| DEF-11 | My stylesheet splice deleted the colour tokens: page unstyled | Visual comparison (7,836 differences) | Restored from the committed file; CI rule for the tokens and light theme |
| DEF-12 | **Live v1.3** header overflowed horizontally between phone and tablet widths (+23 px at 621 px) | A pane width between my test sizes, then a 26-width sweep | Tagline hidden below 861 px, tighter spacing |
| DEF-13 | CI missed external links whose URL contains `?` | A new unit test | Pattern fixed |
| DEF-14 | After publishing, a later re-render swapped the hero to a not-yet-deployed URL | Review of the publish flow | Local copy kept for the session |
| DEF-15 | Design assumption wrong: the 06:00 health run is not reliably after the sync because scheduled runs start hours late | Checking why no run existed at 03:00 UTC | Health moved to 12:00 UTC; delays documented |

Not defects: test-script slips (assigning the same file list twice is ignored by browsers; a test that did not wait for the unlock), and the scroll-spy highlight, which the comparison normalises.

## E. Security checks

See [security.md](security.md) (v1.4 review log): 18 checks, no open High or Critical finding.

## F. Live results after merge (PR #1 merged as `84b1dd2`, 2026-10-20)

| ID | Test | Result |
|----|------|--------|
| TC-F05 | Live site on a fresh tab: footer "Studio v1.4"; only the site's own host contacted; fonts from `/fonts/`; CSP `style-src 'self'; font-src 'self'`; logo and favicon load; monogram shown, **Change photo** hidden from a visitor; What's new lists v1.4 first (5 releases); **no overflow at 643 px** (the width that overflowed on v1.3); console clean | ✅ |
| TC-H13 | Health check run on GitHub against the v1.4 site: HEALTHY (covers the new files and workflow states) | ✅ run 39384909054 |
| (sync) | Sync dry run on GitHub with the pinned checkout: both products fetched, "No changes" | ✅ run 39384913785 (X6 closed) |
| TC-A10 | Keep-alive: dry run says "no heartbeat needed"; **forced run under the final configuration made exactly one empty commit as `github-actions[bot]` (`c580840`, zero files changed)**, run green | ✅ |
| TC-M07 | **The owner's real profile photo** (two commits at 13:05 IST: `cms: update profile photo`, then `cms: show profile photo`): 512 × 512 JPEG of 68 KB; signature valid; **no Exif, GPS, XMP or any APP1 segment in the file**; CI validator passes; live page shows it (512 px source at 72 px, circular, alt text, versioned URL `?v=<timestamp>`, monogram hidden), only the site's own host contacted, console clean, no admin controls for a visitor | ✅ (the one thing only the owner could test; real-photo metadata removal confirmed) |
| TC-M08 | **The owner's own admin-screen publish after the final ruleset configuration**: commit `a1210fa` "cms: update reading list" (12:53 IST, one file, a third read added) was accepted straight onto `main`; CI ran green on it; the validator passes with the new read | ✅ real-world proof of the admin path under the history ruleset |
| TC-W16 | Dependabot opened PRs #2 and #3 at once (setup-node 7.1.0, checkout 7.0.1), keeping hash pins with the version in the comment; CI passed on both; the real sync, keep-alive and health workflows ran **green in dry-run mode on both branches**. **Both merged on 2026-10-20** (one at a time; CI green on `main` after each and after the combination); sync dry run, keep-alive dry run and health then ran green on `main` with the new versions (runs 39389286571, 39389292024, 39389297028) | ✅ |

### Branch protection experiment (REQ-41)

Carried out live on 2026-10-20 with immediate rollback available. Run IDs and messages are exact.

| ID | Test | Result |
|----|------|--------|
| TC-B01 | History ruleset applied to `main`; `GET rules/branches/main` lists `deletion` and `non_fast_forward` | ✅ ruleset 25458711 |
| TC-B02 | **CI-required ruleset with the Actions app as bypass actor**: GitHub refuses it ("Actor GitHub Actions integration must be part of the ruleset source or owner organization") | ❌ the design assumption was wrong |
| TC-B03 | **CI-required ruleset with admin bypass only (temporary)**; forced keep-alive as the bot: **rejected**, "GH013 … Required status check \"check\" is expected", `main` unchanged. This would have stopped the nightly sync | ❌ → ruleset removed |
| TC-B04 | Same temporary ruleset: a pull request with deliberately failing CI shows merge state BLOCKED; `gh pr merge` without `--admin` is **refused** ("the base branch policy prohibits the merge"). PR closed unmerged, branch deleted | ✅ (shows what the ruleset would give for PRs) |
| TC-B05 | Same temporary ruleset: owner's direct push to `main` is **accepted** with GitHub reporting the bypassed rule (`84b1dd2..6c1173e`), the path the admin screen uses | ✅ |
| TC-B06 | History rules on a **throwaway branch** (identical rules): a normal push works; amending and force-pushing is rejected ("Cannot force-push to this branch"); deleting the branch is rejected ("Cannot delete this branch"). Throwaway ruleset and branch removed | ✅ |
| TC-B07 | Final configuration: only the history ruleset exists; bot path re-tested OK (TC-A10); admin path confirmed by the owner's real publish (TC-M08) | ✅ |

**Conclusion:** a required-CI ruleset cannot coexist with the bots on a personal repository, so it is not applied; history protection is. See `docs/design.md` §11.4 and `docs/rulesets/README.md`.

## G. Still pending or not run (stated plainly)

*Closed since the first write-up: the owner's real photo (TC-M07) and the Dependabot pull requests (TC-W16).*

| ID | Item | Why |
|----|------|-----|
| (not run) | EXIF **orientation** of a *rotated* phone photo (the code asks the browser to apply it; the owner's real photo displays correctly, but it is not known whether it needed rotating, and only synthetic images tested rotation logic) | Needs a deliberately rotated photo |
| (not run) | First **scheduled** 12:00 UTC health run and the first Monday keep-alive; the 60-day lapse itself | Time |
| (not run) | Blocked-`sessionStorage` fallback in a browser; real screen reader and phone | Environment |

---

# v1.3 — Safer admin session, version tracking, What's new (shipped)


Date: 2026-10-19 · Environment: macOS, Node v25.2.1, Claude desktop browser pane (Chromium engine), local static server; no real token used anywhere (a clearly fake test token and a stubbed GitHub API stand in)

## A. Requirements

| ID | Requirement |
|----|-------------|
| REQ-23 | Admin token lives only in `sessionStorage` (this tab); never in `localStorage`, cookies, URL or DOM; a token left by earlier versions is deleted; blocked storage falls back to memory |
| REQ-24 | CSP forbids `'unsafe-inline'` for scripts **and** styles; no inline script, `<style>` or `style=`; zero violations in every flow |
| REQ-25 | The page looks the same as v1.2 except for the intentional additions |
| REQ-26 | The current version is visible and comes from one source |
| REQ-27 | What's new: opens a dialog listing releases newest first; a dot marks unseen updates; keyboard and screen-reader friendly |
| REQ-28 | The changelog is validated in CI; hostile or missing content is harmless |
| REQ-29 | Nothing else breaks (sync, health, other content, Penny, debasis-web) |
| REQ-30 | All artefacts updated, including `security.md` |

## B. Traceability matrix

| Req | Test cases | Result |
|-----|-----------|--------|
| REQ-23 | TC-K01–K13 | ✅ (in-page blocked-storage path is unit-tested only) |
| REQ-24 | TC-C01–C04, C09, TC-S09, TC-S10, TC-S12 | ✅ |
| REQ-25 | TC-V01–V03 | ✅ |
| REQ-26 | TC-C05, TC-W01, TC-W04 | ✅ |
| REQ-27 | TC-W01, W02, W04, W05 | ✅ |
| REQ-28 | TC-C05–C08, TC-S11, TC-W03 | ✅ |
| REQ-29 | TC-R12–R16 | ✅ |
| REQ-30 | TC-D03 | ✅ |
| Live | §E smoke checks, TC-M06 | ✅ |

## C. Test cases and results

**Unit tests: `node --test tests/*.test.js` — 61 of 61 pass** (21 reads/date/asset, 23 validator, 4 sync, 5 health, 8 token store).

### Admin token (REQ-23)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-K01–K08 | `tests/token-store.test.js`: token goes only into the given storage and reads back; the capability probe cleans up; `del` clears storage and memory; blocked storage and failing writes fall back to memory, persisting nothing; a new store over the same storage (reload) sees the token, over a fresh storage (new tab) does not; `purge` removes a legacy token, reports it, tolerates blocked storage and never touches other keys | ✅ |
| TC-K09 | Real page: a planted `localStorage` token is deleted on load, not copied to `sessionStorage`, admin stays locked, other keys (theme) untouched | ✅ |
| TC-K10 | Stubbed `/user` returning another login: error shown ("belongs to someone-else…"), nothing stored, admin stays off | ✅ |
| TC-K11 | Valid unlock: token in `sessionStorage` only; not in any `localStorage` value, the DOM, cookies or the URL; dialog closed; composer visible; zero CSP violations | ✅ |
| TC-K12 | Publish with the stubbed API: `GET` (with `?ref=main`) then one `PUT` with the file's SHA and branch; the Bearer header is the session token; identical content gives "unchanged" with no `PUT` | ✅ |
| TC-K13 | Reload in the same tab stays unlocked; **Lock** clears `sessionStorage`, hides the composer, restores the gear | ✅ |

### Validator and strict CSP (REQ-24, REQ-28)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-C01 | CSP with `'unsafe-inline'` in `style-src` is rejected; a strict one passes | ✅ |
| TC-C02 | Inline `<style>` and `style=` attributes in HTML are rejected (including upper-case and single-quoted) | ✅ |
| TC-C03 | A linked stylesheet that exists passes; a missing one is reported | ✅ |
| TC-C04 | JS that builds a style attribute (template, `setAttribute`, escaped quote) is rejected; `element.style.setProperty` is allowed | ✅ |
| TC-C05 | Valid newest-first changelog (including `1.1.1`) passes | ✅ |
| TC-C06 | Missing or empty releases, bad version, bad date, wrong order and duplicates are reported | ✅ |
| TC-C07 | Title and item limits and types; markup and links in text are rejected | ✅ |
| TC-C08 | The stylesheet is inside the size budget | ✅ |
| TC-C09 | Validator on the real repo **before** the refactor: 5 errors (no changelog, `unsafe-inline` styles, inline `<style>`, `style=`, JS style attribute). After: 0 errors, 0 warnings | ✅ |

### Visual regression (REQ-25)

Method: a harness loads the frozen v1.2 build and the new build in same-origin frames with identical content, at 375, 768 and 1280 px in dark and light, in four states (visitor view, admin with composer and preview, admin dialog, release notes expanded), and compares computed styles and sizes element by element. The scroll-spy highlight (`aria-current`) is normalised first because it depends on timing.

| ID | What it checks | Result |
|----|----------------|--------|
| TC-V01 | **The harness can fail**: a deliberate 1 px padding change and a colour change are reported (23 differences); an injected `<style>` is correctly blocked by the new CSP | ✅ |
| TC-V02 | After the CSS extraction, before the new UI: 24 cases, **0 differences** | ✅ |
| TC-V03 | Final build: 24 cases; all 180 differences fall in the header container, the footer, and the paragraph in the admin dialog (reworded text); no other region changed | ✅ |

### What's new and version (REQ-26, REQ-27)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-W01 | Real click on the header button opens "What's new in Studio": four releases, newest first, **Latest** badge on v1.3; focus lands on the title; list scrolled to the top | ✅ |
| TC-W02 | Dot shown when the stored version differs; opening the dialog stores `1.3`, clears the dot and resets the accessible name | ✅ |
| TC-W03 | Missing changelog: button and version hidden, page otherwise renders | ✅ |
| TC-W04 | Footer shows "Studio v1.3" as a button named "Studio version 1.3, open What's new"; header button is 44 × 44 px on a phone; no horizontal scroll at 375 px | ✅ |
| TC-W05 | Escape closes the dialog and focus returns to the header button | ✅ |

### Security (REQ-24, REQ-28) — see [security.md](security.md)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-S09 | Fresh tab, clean console: zero CSP violations across load, What's new, release notes expanded, admin dialog, composer with live preview, re-render, theme toggle | ✅ |
| TC-S10 | Dynamic values work under the strict CSP: every avatar with hue data is painted; language dots are painted | ✅ |
| TC-S11 | Hostile changelog (markup in title and items, `javascript:` text, bad version and date): no `img`, `script`, `strong` or `a` created; `window.__pwn` unset; no violations | ✅ |
| TC-S12 | No `eval`, `new Function`, `document.write` in the JS; no new third-party host; no new dependency; no token-like strings in the repo | ✅ |

### Regression (REQ-29)

| ID | What it checks | Result |
|----|----------------|--------|
| TC-R12 | `git diff main` empty for `.github/`, `sync-products.js`, `health-check.js`, products, blog, reads, cache and the notify template | ✅ |
| TC-R13 | Sync dry run: both products fetched, "No changes" | ✅ |
| TC-R14 | Health check against the live site: HEALTHY | ✅ |
| TC-R15 | All earlier unit tests still pass (45 → 61 total) | ✅ |
| TC-R16 | Visitor-facing content, Reads, release notes and share buttons render identically (covered by TC-V02/V03) | ✅ |

### Documentation

| ID | What it checks | Result |
|----|----------------|--------|
| TC-D03 | Plan, impact, design, test, build, model-use, security, architecture, learning guide, README and changelog updated | ✅ |

## D. Defects found during v1.3

| ID | Defect | Found by | Fix |
|----|--------|----------|-----|
| DEF-07 | The header What's new button had **no accessible name on phones**: its text is hidden there, the icon is decorative, and the screen-reader span was empty until an update existed | Reading the browser's accessibility tree after building the button | Explicit `aria-label`, switched to "What's new, new updates available" when there is news |
| DEF-08 | Footer on a phone split the date across two lines once the version was added | Screenshot | "Synced from GitHub · date" kept together; version label on its own |
| DEF-09 | The first design focused the dialog's Close button, which would open a long list scrolled to the bottom | Design review | Dialog opens focused on its title (`tabindex="-1"`) |

Observations that were **not** defects: the scroll-spy highlight produced false differences in the first comparison run (normalised, then 0 differences); one CSP console line in an old tab came from the harness's own deliberate injection (fresh tab: clean).

## E. Live smoke test (after merge `6c6052d`, 2026-10-19)

| Check | Result |
|-------|--------|
| CI on the merge commit | ✅ success |
| Pages build and deployment | ✅ success |
| Manual `Health check` run (39254212379) | ✅ success |
| Sync dry run on GitHub (39254217135) | ✅ success |
| `/`, `css/site.css`, `js/app.js`, `js/token-store.js`, `js/reads-lib.js`, `content/changelog.json`, `content/cache.json` | ✅ all 200; served page links `css/site.css`, has no `<style>`, CSP `style-src 'self' https://fonts.googleapis.com` |
| Fresh tab (clean storage and console): footer "Studio v1.3"; What's new button named "What's new, new updates available"; dialog opens on its title with four releases, dot clears, `1.3` stored | ✅ |
| Penny card: Open app / Download / Source, Download is `PennyExpenseManager-v3.2.zip`; Debasis Web: Open app / Source | ✅ |
| Reads render; composer and edit buttons hidden from a visitor; no token-like keys in storage | ✅ |
| All `target=_blank` links carry `noopener noreferrer`; no `<style>` blocks; no horizontal scroll; console clean | ✅ |
| The 4 elements with a `style` attribute are avatars and language dots coloured at runtime through the CSSOM (allowed by the CSP), not markup | ✅ explained |

## F. Not run (stated plainly)

- The blocked-`sessionStorage` fallback in a real browser (covered by unit tests only).
- The 30-minute idle lock (logic unchanged; timer not waited out).
- Real screen reader (VoiceOver/NVDA) and a physical phone.
- ~~A real admin unlock and publish on the deployed site~~ **Done (TC-M06):** commit `4729d06` "cms: update reading list", 2026-10-19 18:22 IST (11 minutes after the v1.3 merge): one file (`content/reads.json`), one line, a comment edited on an existing read; CI ran on it (admin commits use a personal token, so unlike the sync bot they do trigger CI) and passed; Pages rebuilt; the live file contains the edit.
- The first *scheduled* health run (06:00 UTC on 2026-10-20).

---

# v1.2 — Guardrails (shipped)


Date: 2026-10-19 · Environment: macOS, Node v25.2.1 locally, Node 22 in CI; live checks against https://debasisr66.github.io/studio/

## A. Requirements

| ID | Requirement |
|----|-------------|
| REQ-16 | CI runs the unit tests and site validation on every push and pull request, read-only |
| REQ-17 | The validator catches malformed JSON, unsafe URLs, duplicate repos, missing referenced files, inline scripts, a missing or loosened CSP, size-budget breaches and JS syntax errors |
| REQ-18 | The health check detects a site outage and a cache that has drifted from the products' latest GitHub releases |
| REQ-19 | A repeat push to a product repo on the same day does not change `cache.json` (no churn commits) |
| REQ-20 | Calendar dates display as the same day in every timezone |
| REQ-21 | Nothing breaks: `sync.yml` and `index.html` unchanged, sync dry run passes, live site unchanged |
| REQ-22 | All artefacts updated and consistent |

## B. Traceability matrix

| Req | Test cases | Result |
|-----|-----------|--------|
| REQ-16 | TC-W01, TC-W02, TC-W03 | ✅ |
| REQ-17 | TC-V01–V15, TC-V16 | ✅ |
| REQ-18 | TC-H01–H05, TC-H06, TC-H07, TC-H08 | ✅ (first scheduled run still to come) |
| REQ-19 | TC-Y01–Y04, TC-Y05 | ✅ |
| REQ-20 | TC-T01, TC-T02, TC-T03 | ✅ |
| REQ-21 | TC-R06–R11 | ✅ |
| REQ-22 | TC-D02 | ✅ |

## C. Test cases and results

**Unit tests: `node --test tests/*.test.js` — 45 of 45 pass** (21 reads/date/asset helpers, 15 validator, 4 sync, 5 health).

| ID | What it checks | Result |
|----|----------------|--------|
| TC-V01–V15 | Validator unit tests (`tests/validate-site.test.js`): valid products, cache, blog, reads, index pass; each bad input is reported (bad repo, duplicate repo, `javascript:` URL, wrong types, bad release shape, bad dates, too many tags, long comment, duplicate id, loosened CSP, inline script, missing file, missing lang/title, size breach, syntax error); duplicate links and not-yet-cached products only warn | ✅ |
| TC-V16 | Validator on the **real repo**: 0 errors, 0 warnings. On a **deliberately broken copy** (malformed `blog.json`, a `javascript:` read, an inline script): 3 errors reported, exit code 1 | ✅ |
| TC-H01–H05 | `findDrift` (`tests/health.test.js`): matching tags and matching "no release" are clean; newer GitHub release, new release, and removed release are drift; hidden products ignored; unknown GitHub state skipped; product missing from cache is drift | ✅ |
| TC-H06 | Health check against the live site: HEALTHY | ✅ |
| TC-H07 | Negative runs: wrong site URL gives 7 problems, exit 1; cache altered to say v3.1 while GitHub has v3.2 gives exactly that drift, exit 1 | ✅ |
| TC-Y01–Y04 | `shapeProduct` and `hasChanged` (`tests/sync.test.js`): field mapping; `pushed_at` stored as a date; **same-day second push is not a change**; next-day push, new star, new release, removed product are changes | ✅ |
| TC-Y05 | Real local sync run twice: first migrates the cache format (only `synced_at` and `pushed_at` differ), second prints "No changes; cache.json left untouched." Dry run also reports no changes | ✅ |
| TC-T01 | `formatDate('2026-10-19')` gives "19 Oct 2026" under TZ = UTC, America/Los_Angeles, Asia/Kolkata and Pacific/Kiritimati | ✅ |
| TC-T02 | Invalid or missing input gives an empty string; full timestamps still format | ✅ |
| TC-T03 | Before the fix, a Los Angeles viewer got "18 Oct 2026" for `2026-10-19` (demonstrated in the browser on the live site) | ✅ defect reproduced and fixed (DEF-06) |
| TC-W01 | `ci.yml`, `health.yml` and `sync.yml` parse as valid YAML (Ruby) | ✅ |
| TC-W02 | New workflows declare `permissions: contents: read` and use no secrets | ✅ |
| TC-W03 | First `CI` run on GitHub after merge is green | ✅ run 39244948456 (push of the merge commit `a7e81db`), 8 s |
| TC-H08 | First manual and first scheduled `Health check` run on GitHub is green | ✅ manual run 39245250409 (11 s); ⏳ first scheduled run is 06:00 UTC tomorrow |
| TC-R10 | Refactored sync script run on GitHub as a dry run: both products fetched, "No changes" | ✅ run 39245371872 |
| TC-R11 | Live site after deploy: Pages build green; `cache.json` serves date-only `pushed_at`; `reads-lib.js` serves `formatDate`; page 200 | ✅ |
| TC-R06 | `git diff main -- .github/workflows/sync.yml` and `index.html` are empty | ✅ |
| TC-R07 | Sync dry run passes | ✅ |
| TC-R08 | Live site loads as before; protected content files other than `cache.json` unchanged | ✅ |
| TC-R09 | Existing 16 v1.1 unit tests still pass | ✅ |
| TC-D02 | Plan, impact, design, test, build, model-use, architecture, learning guide and README updated | ✅ |

## D. Defects found during v1.2

| ID | Defect | Found by | Fix |
|----|--------|----------|-----|
| DEF-06 | Date-only values (cache `pushed_at` after G4, blog dates, read dates) showed the previous day to visitors west of Greenwich | Reviewing the effect of G4 on the page, then reproduced in the browser | `formatDate` formats date-only strings in UTC |

## E. Not run (stated plainly)

- The first *scheduled* health run (06:00 UTC 2026-10-20) has not happened yet; only the manual run is recorded.
- GitHub's failure notification email was not triggered or inspected; whether it reaches the owner depends on the owner's notification settings.
- The 60-day scheduled-workflow suspension (impact V5) cannot be tested short of waiting.

---

# v1.1 — HCI polish, branding, LinkedIn-style Reads (shipped)

Date: 2026-10-19 · Environment: macOS, Node v25.2.1, Claude desktop browser pane (Chromium engine), served locally with `python3 -m http.server`.

Result key: ✅ pass · ❌ fail (fixed) · ⏳ not run · 🔒 needs owner

## 1. Requirements

| ID | Requirement |
|----|-------------|
| REQ-01 | Branding "Studio by Debasis Ray — learning never ends!" |
| REQ-02 | UI follows HCI guidelines (see design.md) |
| REQ-03 | Owner can add a read with a LinkedIn-post-style composer |
| REQ-04 | Owner can edit and delete reads |
| REQ-05 | Visitors can filter by tag and search reads |
| REQ-06 | Each read can be shared (LinkedIn, copy link, native share) |
| REQ-07 | Only the owner (admin) can add or change reads |
| REQ-08 | Publishing is safe: one file per commit, SHA, validated JSON, idempotent |
| REQ-09 | Existing data and legacy reads still work (backward compatible) |
| REQ-10 | Other apps and the sync pipeline are unaffected |
| REQ-11 | Security: no injection, safe URLs, CSP, safe external links, token handling |
| REQ-12 | Accessibility (WCAG 2.2 AA) |
| REQ-13 | Performance and size within budget; no new dependencies |
| REQ-14 | Responsive: mobile, tablet, desktop; dark and light |
| REQ-15 | Documentation set delivered |

## 2. Traceability matrix

| Req | Test cases | Result |
|-----|-----------|--------|
| REQ-01 | TC-B01 | ✅ |
| REQ-02 | TC-B02, TC-B03, TC-A01–A07 | ✅ |
| REQ-03 | TC-U01–U03, U08–U11, TC-B04, TC-B05 | ✅ |
| REQ-04 | TC-B07, TC-B08 | ✅ |
| REQ-05 | TC-U14, U15, TC-B06 | ✅ |
| REQ-06 | TC-U12, TC-B09 | ✅ (LinkedIn URL and copy verified; see §5 for what was not run) |
| REQ-07 | TC-B10 | ✅ |
| REQ-08 | TC-R05; **TC-M01** | ✅ code unchanged; ✅ live publish |
| REQ-09 | TC-U13, TC-B07, TC-R01 | ✅ |
| REQ-10 | TC-R02, R03, R04 | ✅ |
| REQ-11 | TC-S01–S08, TC-U02, U03 | ✅ |
| REQ-12 | TC-A01–A07 | ✅ (manual and scripted; no screen-reader run) |
| REQ-13 | TC-N01, N02 | ✅ |
| REQ-14 | TC-B03, TC-B11, TC-B12 | ✅ |
| REQ-15 | TC-D01 | ✅ |

## 3. Test cases and results

### 3.1 Unit tests (`node --test tests/*.test.js`) — 16 of 16 pass

| ID | What it checks | Result |
|----|----------------|--------|
| TC-U01 | `normalizeUrl` accepts http/https; adds https to bare domains | ✅ |
| TC-U02 | Rejects `javascript:`, `data:`, `ftp:`, `file:`, `vbscript:`, `//host` | ✅ |
| TC-U03 | Rejects empty, garbage, credentials in URL, over-long input | ✅ |
| TC-U04 | Strips `utm_*`, `fbclid`, `gclid`, fragments; keeps real params | ✅ |
| TC-U05 | `domainOf` | ✅ |
| TC-U06 | Duplicate detection ignores `www`, trailing slash, tracking params | ✅ |
| TC-U07 | Duplicate check can exclude the entry being edited | ✅ |
| TC-U08 | `parseTags`: case, trim, dedupe, caps | ✅ |
| TC-U09 | `parseTags`: strips markup and unsafe characters | ✅ |
| TC-U10 | `validateEntry` normalises a valid entry | ✅ |
| TC-U11 | `validateEntry` reports field errors | ✅ |
| TC-U12 | `validateEntry` limits and default type; `shareLinks` encodes the URL and refuses unsafe schemes | ✅ |
| TC-U13 | `entryView` keeps legacy `{title,url,note}` entries working | ✅ |
| TC-U14 | `filterReads` by tag and text | ✅ |
| TC-U15 | `allTags` | ✅ |

(The 16 tests cover these 15 groups; the share-link test and the title-length test are counted under TC-U12.)

During test-writing one expectation was wrong in the test, not in the code (`<b>x</b>` becomes `bxb` by the stated rule). The test was corrected.

### 3.2 Browser tests (local, browser pane)

| ID | Scenario | Result |
|----|----------|--------|
| TC-B01 | Page title, hero tagline, header wordmark and footer show the new branding | ✅ |
| TC-B02 | Page loads under CSP with zero console errors and zero violations | ✅ |
| TC-B03 | Skeleton cards replaced by product cards; no layout break | ✅ |
| TC-B04 | Composer opens from the prompt; focus lands on the Link field; preview updates as you type | ✅ |
| TC-B05 | Empty submit shows inline errors and marks fields `aria-invalid`; `javascript:` link rejected; valid post stored with `id`, `added`, normalised URL and cleaned tags; duplicate rejected | ✅ |
| TC-B06 | With 5 reads: newest first, undated entries last; tag filter, search, combined filter, no-match state with Clear filters, count announcement | ✅ |
| TC-B07 | Editing a legacy entry pre-fills its note as the comment; saving replaces `note` with `comment`; count unchanged | ✅ |
| TC-B08 | Delete removes the entry and marks reads.json as unpublished | ✅ |
| TC-B09 | LinkedIn link is correctly encoded and opens with `noopener noreferrer`; Copy link shows "Link copied." on a real click | ✅ |
| TC-B10 | Composer and edit buttons are hidden without admin mode | ✅ |
| TC-B11 | 375 px: no horizontal scroll (including with admin and composer open) | ✅ after fix (§4) |
| TC-B12 | 768 px: two-column grid, nav and cards intact; light theme renders | ✅ |

### 3.3 Accessibility

| ID | Check | Result |
|----|-------|--------|
| TC-A01 | No unnamed buttons or links; no unlabeled form fields | ✅ |
| TC-A02 | Heading outline: one h1, h2 per section, no skipped levels | ✅ |
| TC-A03 | Landmarks present; `lang="en"`; no duplicate ids | ✅ |
| TC-A04 | Dialog: role, modal, labelled; focus trapped both directions; Escape closes; focus returns to the gear | ✅ |
| TC-A05 | All external links opened in a new tab carry `noopener noreferrer` | ✅ |
| TC-A06 | Contrast measured for every token pair | ✅ after fixes (3 failures found, see design.md §3) |
| TC-A07 | Target sizes: primary ≥ 40–44 px; desktop tag chips 28 px (above 24 px minimum); touch devices larger | ✅ |

### 3.4 Security

| ID | Check | Result |
|----|-------|--------|
| TC-S01 | `<img onerror>` in title renders as text; no `img` element created; `window.__pwn` not set | ✅ |
| TC-S02 | `<script>` in comment renders as text | ✅ |
| TC-S03 | Markup in tags is stripped | ✅ |
| TC-S04 | `javascript:`, `data:`, `file:` URLs rejected by the composer | ✅ |
| TC-S05 | CSP in force; inline scripts forbidden; no violations recorded during all flows | ✅ |
| TC-S06 | Markdown links in release notes only become anchors for explicit http(s) targets; relative links keep the label only | ✅ |
| TC-S07 | No token in DOM, logs or commits; admin token key unchanged (`studio-admin-pat`) | ✅ |
| TC-S08 | Hostile input never reaches the publish path as malformed JSON (serialise-and-reparse gate unchanged) | ✅ |

### 3.5 Non-functional

| ID | Check | Result |
|----|-------|--------|
| TC-N01 | Size: `index.html` 22 KB, `app.js` 28 KB, `reads-lib.js` 5 KB (total 56 KB, no new dependencies, no build step) | ✅ |
| TC-N02 | Graceful degradation: each content file loads independently; failure of one does not blank the page (code path unchanged and extended with array checks) | ✅ by design; failure injection not run |

### 3.6 Regression (other apps and pipeline)

| ID | Check | Result |
|----|-------|--------|
| TC-R01 | Existing products, Updates, Blog and Books render as before | ✅ |
| TC-R02 | `git diff main --stat` is empty for `.github/`, `scripts/`, `content/products.json`, `content/blog.json`, `content/reads.json`, `docs/notify-studio.yml` | ✅ |
| TC-R03 | `DRY_RUN=true node scripts/sync-products.js`: both products fetched, "No changes" | ✅ |
| TC-R04 | Penny and debasis-web cards link to their live apps and sources | ✅ |
| TC-R05 | `publishFile` code is byte-for-byte the v1.0 logic | ✅ (reviewed) |

### 3.7 Defects found by testing

| ID | Defect | Found by | Fix |
|----|--------|----------|-----|
| DEF-01 | **Page was 676 px wide on a 375 px phone**: Penny v3.2's release notes contain a long unbroken URL. Present in v1.0 on the live site | Mobile run | `overflow-wrap:anywhere`, `minmax(0,1fr)` grids |
| DEF-02 | Release notes showed raw `[text](url)` Markdown | Same run | Safe Markdown links added |
| DEF-03 | Very long release notes dominated the Updates feed | Same run | Collapsed behind "Show release notes" |
| DEF-04 | White-on-purple hover 3.9:1, light danger 3.4:1, field borders 1.3:1 | Contrast measurement | New tokens |
| DEF-05 | ⚙ button overlapped the admin bar on phones | Screenshot | Hidden while admin is on |

DEF-01 to DEF-03 affect the **currently live** v1.0 site and are resolved once v1.1 is merged.

## 4. Manual and owner-dependent tests

| ID | Test | Status |
|----|------|--------|
| TC-M01 | Unlock admin with a real token, post a read, Publish, confirm one commit to `content/reads.json` and the read appears after the Pages rebuild | ✅ 2026-10-19: commit `9acca43` "cms: update reading list" (one file, one commit); live file matches; a token-free browser shows the card with LinkedIn and Copy link, no composer, no edit buttons, no console errors |
| TC-M02 | Idle auto-lock after 30 minutes (timer logic reviewed; not waited out) | ⏳ |
| TC-M03 | Native share sheet on a phone | ⏳ |
| TC-M04 | Click **Share on LinkedIn** and confirm LinkedIn's dialog pre-fills the article | ⏳ (the browser pane blocks script-initiated new tabs) |

## 5. Not run (stated plainly)

Screen-reader testing (VoiceOver/NVDA); Lighthouse or axe automated scans; Safari, Firefox and real-device testing; failure injection for missing `reads.json`; load testing (not meaningful for a static site). Contrast and keyboard behavior were verified by measurement and scripted checks rather than assistive technology.

## 6. Live smoke checklist (run 2026-10-19 after merge, commit `c5b3d0f`)

- [x] https://debasisr66.github.io/studio/ loads; no console errors; CSP present
- [x] Pages build "pages-build-deployment" succeeded; `/`, `js/app.js`, `js/reads-lib.js`, `content/*.json` all return 200; served `app.js` is the v1.1 build
- [x] Branding visible (title, header, hero tagline, footer)
- [x] Penny and Debasis Web cards present with working Open app and Source; Penny shows Download (see note)
- [x] Updates shows Penny 3.2 collapsed behind "Show release notes"; no horizontal scroll at 375 px (before: 676 px)
- [x] Reads shows the empty state ("Nothing here yet"); composer and edit buttons hidden for visitors
- [x] `gh workflow run sync.yml -f dry_run=true` succeeded
- [x] TC-M01 completed with the owner's token (2026-10-19)

Note (finding, not a v1.1 defect): Penny's **Download** points at the first asset of release v3.2, `Penny-Journey-Map_v2.docx`, a document rather than the app. The card takes `assets[0]`. Options: attach the app build first, or add a registry hint to choose the asset.

## 7. How to run

```bash
node --test tests/*.test.js
python3 -m http.server 8765        # then open http://localhost:8765/
git diff main --stat -- .github scripts content/products.json content/blog.json content/reads.json docs/notify-studio.yml
DRY_RUN=true GH_TOKEN=$(gh auth token) node scripts/sync-products.js
```

## 8. TC-D01 Documentation

`impact.md`, `plan.md`, `design.md`, `test.md`, `build.md`, `model-use.md` exist in `docs/` and cross-reference each other. ✅
