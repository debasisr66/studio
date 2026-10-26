# Spec: Reads with two sub-items, Technical and Others

| | |
|---|---|
| Spec ID | `SPEC-RC` (requirements `RC-01` … `RC-09`) |
| Status | **Shipped in v2.0 (2026-10-26 release PR). Phases A (PR #14), B (PR #16) and C checks (RC-07, RC-08) done; deferred in writing: removing the book-only editor** |
| Owner | Debasis Ray |
| Created | 2026-10-21 |
| Parent | [PRD](../../PRD.md) §7, §9.4, §11.3; [§22](../../PRD.md) |
| Depends on | [SPEC-SH](../stabilize-core-hub/spec.md) SH-01, SH-02, SH-04 (isolation, smoke test, schema versions) |
| Target | Studio v2.0 |

## 1. Summary

Reads is one mixed list today. Split it into two sub-items, **Technical** and **Others**, so a visitor looking for engineering material and one looking for everything else each get a short, focused list. The owner picks the sub-item when adding a read.

## 2. Evidence

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Reads is a single flat list with tag chips and search; there is no top-level grouping | `renderReads`, `index.html` `#reads` |
| F2 | The 5 current reads (all tagged `ai`) and the 1 book are all technical; "Others" would start empty | `content/reads.json` |
| F3 | Entries have no category field; `kind` (article, video, paper, podcast, tool) is a format, not a subject, and must stay separate | `js/reads-lib.js` `KINDS` |
| F4 | `reads.json` has no schema version and validation allows unknown extra fields silently | `validateReads` |
| F5 | Books sit in a second column with a different editor and no tags | `renderReads`, `SCHEMAS.book` |

## 3. Goals and measures

| Goal | Measure | Target |
|------|---------|--------|
| A visitor can reach either sub-item in one tap | Taps from the Reads heading to a sub-item's list | **1** |
| Every read has exactly one sub-item | Entries without `category` in CI-validated content | **0** |
| Nothing is lost in the move | Reads before and after migration (ids, urls, titles) | **identical** |
| Old behaviour still works | Existing tag filter, search, share, copy, edit and delete | **all pass** |

## 4. Non-goals

- More than two sub-items, nested folders or free-form categories (premature; two is the request).
- Per-visitor subscription or personalised feeds.
- Automatic classification of links.
- Changing `kind` or tags.

## 5. Requirements

**RC-01 (P0): Data model.** Each reading entry has `category`: `"technical"` or `"other"`. Books get the same field (Q1). `kind` and `tags` are unchanged. Defaults at runtime for an entry with no or unknown category: `"other"` (never an error in the browser).

**RC-02 (P0): Sub-item switcher.**
- [ ] Reads shows two choices, **Technical** and **Others**, each with its count, implemented as an accessible tab list (`role="tablist"`, arrow keys, `aria-selected`).
- [ ] Only the selected sub-item's reads (and books) are listed; tag chips and search apply within it, and clear when switching.
- [ ] On load the default is Technical, or Others if Technical is empty.
- [ ] Empty sub-item shows a friendly empty state, not a blank.

**RC-03 (P0): Deep links.** `#reads` opens the default sub-item; `#reads/technical` and `#reads/others` open that sub-item. The existing `#reads` link keeps working.

**RC-04 (P0): Composer and editor.** The "Share a read" form has a required **Section** choice (Technical or Others), remembered for the next add in the same session; editing an entry can change it. Live preview shows it.

**RC-05 (P0): Migration with no data loss.** One migration commit adds `category` and `schema_version` to `content/reads.json`; proposed classification (owner confirms): all 5 current reads and the 1 book are **technical** (all are AI engineering material). A test proves ids, urls, titles, comments, tags and kinds are unchanged.

**RC-06 (P0): Validation.** CI requires `category` ∈ {technical, other} for every article and book after migration; `schema_version` is required and must be known (SH-04); the rule `reads-category` joins `RULES`, the runbook and the contract with a failing fixture. The version rule (`reads-schema-version`) and the mechanism already exist from SPEC-SH SH-04 (version `1`); this migration raises the known version to `2` for both the validator and the browser, in the same commit as the data.

**RC-07 (P1): Sharing and counts.** Share on LinkedIn, copy link and native share behave as today, per entry. The count on each switcher button reflects the whole sub-item, not the filtered view.

**RC-08 (P1): Books in the same list.** Books appear in their sub-item under the articles in the same column; the two-column Reading list / Books layout is retired (simpler, and removes the book-only editor path where possible; the book editor stays for now).

**RC-09 (P2): A third sub-item later.** The model uses a small allowed-values list (`CATEGORIES` in one module) so adding one is a code-and-data change, not a redesign.

## 6. Security and trust

- No change to URL rules (shared strict rule applies), escaping, CSP or admin token handling.
- The `category` value is chosen from a closed list and validated; it is never used as markup or a CSS class without escaping.
- Deep-link fragments are matched against the closed list; anything else is ignored.

## 7. Edge cases

| Case | Expected |
|------|----------|
| Entry with no category (legacy file, hand edit) | Shown under Others in the browser; CI rejects it |
| Unknown category value | Same |
| `#reads/xyz` | Ignored; default sub-item |
| Tag exists only in the other sub-item | Not shown as a chip here |
| Search yields nothing in this sub-item but matches in the other | "No reads match" with a hint: "Try the other section" |
| Owner changes an entry's section | Moves immediately in the admin draft; public after Publish |

## 8. Open questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Should books follow the Technical / Others split? Recommended: yes (the AI Engineering book is technical) | Owner | No (default yes) |
| Q2 | Confirm that all 5 current reads and the 1 book are Technical | Owner | Before migration only |
| Q3 | Label: "Others" (as requested) or "Other"? Recommended: keep "Others" | Owner | No |

**Decisions (owner, 2026-10-21):** Q1 books follow the split; Q2 all 5 current reads and the book are Technical; Q3 label stays "Others". RC-02's default is simply Technical (or Others if Technical is empty): there is no usage-based default.

## 9. Rollout and phasing

| Phase | Contents | Gate |
|-------|----------|------|
| A | RC-01, RC-05, RC-06 (data, validator, migration), no UI change | Contract and fixtures green; migration test proves no loss |
| B | RC-02, RC-03, RC-04 | Smoke test (SH-02) covers both sub-items and deep links |
| C | RC-07, RC-08 | Visual and keyboard checks |

Rollback: tag `v1.5`; `reads.json` is additive (extra keys), so old code still renders migrated data.

## 10. Traceability

| Req | PRD ref | Tests (see test.md) | Code or doc touched |
|-----|---------|---------------------|---------------------|
| RC-01 | §11.3 | TC-RC-D01–D04 | `js/reads-lib.js`, `content/reads.json` |
| RC-02 | §9.4 | TC-RC-U01–U08 | `index.html`, `js/app.js`, `css/site.css` |
| RC-03 | §9.4 | TC-RC-L01–L04 | `js/app.js` |
| RC-04 | §9.4 | TC-RC-E01–E04 | `index.html`, `js/app.js`, `js/reads-lib.js` |
| RC-05 | §13.3 | TC-RC-M01–M03 | `content/reads.json`, migration test |
| RC-06 | §9.6 | TC-RC-V01–V04 | `scripts/validate-site.js`, `tests/fixtures/` |
| RC-07 | §9.4 | TC-RC-S01–S02 | `js/app.js` |
| RC-08 | §9.4 | TC-RC-B01–B02 | `index.html`, `js/app.js`, `css/site.css` |
| RC-09 | §16 | TC-RC-X01 | `js/reads-lib.js` |

## 11. Status log

- 2026-10-21: Draft created from code findings F1-F5. Awaiting owner answers to Q1 to Q3.
- 2026-10-21: Approved by the owner with the recommended answers; decisions recorded in section 8-9 above.
- 2026-10-22: Phase A built on `v2/rc-a`: RC-01 (`CATEGORIES`, `categoryOf`, `categoryCounts`, `filterReads` by category in `js/reads-lib.js`; browser default `other`), RC-06 (rule `reads-category` with fixture, RUNBOOK row and CONTRACT entry; the validator now accepts only `schema_version` 2), RC-05 (one commit raises `schema_version` 1 → 2 and adds `technical` to all 5 reads and the book; before/after comparison identical; v1.5 code renders it). No visible UI. The admin composer and the book editor give new entries `technical` (`DEFAULT_NEW_CATEGORY`) and `RL.serializeReads` fills a missing category, so a publish can never fail the new CI rule; RC-04's Section choice replaces that default in Phase B. Results: [test.md](test.md).
- 2026-10-22: Phase A merged (PR #14, `122e3d1`).
- 2026-10-22: Phase B built on `v2/rc-b`: RC-02 (accessible tab list built from `CATEGORIES`: `role=tablist`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, roving `tabindex`, Left/Right/Home/End with wrap, automatic activation; Technical by default, or the first section with entries; counts are whole-section; switching clears tag and search; empty-section text; "No reads match here" with a Try-other-section button), RC-03 (`#reads`, `#reads/technical`, `#reads/others`; matched against the closed list by exact comparison so `__proto__` and anything else is ignored; switching uses `history.replaceState`, so no scroll and no history entry; a deep link scrolls Reads into view), RC-04 (Section radio group in the composer, preselected with the last section chosen in the session, else the section being viewed; an empty choice is an inline, announced error; editing can move an entry; live preview says where it will appear; the book editor gets a Section select). Decisions made while building: (1) a tab's count is reads plus books, because books are listed in the same section; (2) books are filtered by section in their existing column now (the single-column layout is RC-08, Phase C); (3) plain `#reads` on a later hash change keeps the section you are on (only a fresh load applies the default); (4) the Section control is a radio group preselected for you rather than a blank choice, so adding is one click fewer and the "required" check can only fail if the form is tampered with. Results: [test.md](test.md).
- 2026-10-22: Phase B merged (PR #16, `5707926`) and shipped in the intermediate release v1.6 (tag `v1.6`). 2026-10-23: the owner published two reads under Others through the live admin screen (a real end-to-end use of RC-04).
- 2026-10-26: **Shipped in v2.0** (release PR; the tag is pushed after the owner says merge). Phases A (PR #14), B (PR #16) and C checks (RC-07, RC-08) done; deferred in writing: removing the book-only editor
