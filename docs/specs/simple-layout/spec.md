# Spec: A simpler, more intuitive layout

| | |
|---|---|
| Spec ID | `SPEC-UX` (requirements `UX-01` … `UX-07`) |
| Status | **Shipped in v2.0 (2026-10-26 release PR). Phase A (PR #27, review [UX-04](../../reviews/UX-04.md)) and Phase B (PR #30, review [UX-05](../../reviews/UX-05.md)) merged; owner walk-through done on a real iPhone; extreme-zoom fix (PR #32); footer dates (PR #28)** |
| Owner | Debasis Ray |
| Created | 2026-10-21 · revised 2026-10-21 (usage-based ordering dropped by the owner) |
| Parent | [PRD](../../PRD.md) §7, §8; [§22](../../PRD.md) |
| Depends on | [SPEC-RC](../reads-categories/spec.md), [SPEC-PC](../podcast-links/spec.md) (the final set of sections), [SPEC-SH](../stabilize-core-hub/spec.md) |
| Target | Studio v2.0 (last of the four) |

## 1. Summary

Make the page more intuitive while keeping it simple: **one fixed, predictable order (Products, Updates, Reads, Podcasts), one consistent section pattern, and the same navigation everywhere.** An earlier draft also reordered sections by how much each visitor used them; the owner dropped that as adding no value, so there is no usage tracking, no stored preference and no reordering of any kind.

## 2. Evidence

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Section order is Products, Updates, Blog, Reads. The header nav has four links but the bottom nav only three (Updates is missing), so the two navs disagree | `index.html` nav and bottom nav |
| F2 | Section headers differ in pattern (some have a sub-line, some an add button, Reads has two sub-headings and a two-column Reading list / Books layout) | `index.html` |
| F3 | After RC and PC the sections are Reads (Technical, Others) and Podcasts, in place of Reads and Blog | SPEC-RC, SPEC-PC |
| F4 | Deep links today: `#products`, `#updates`, `#blog`, `#reads`; `#blog` is retired by SPEC-PC | `index.html` |

## 3. Goals and measures

There is no analytics in Studio, so goals are verified by tests and an owner walk-through.

| Goal | Measure | Target |
|------|---------|--------|
| Simple structure | Top-level destinations in the header and in the bottom nav | the **same 4**, in page order: Products, Updates, Reads, Podcasts |
| Consistent sections | Sections with the same anatomy (heading, one-line description, content, empty state) | **all** |
| No dead links | Existing anchors and deep links | **all land correctly** |
| First-screen clarity | Walk-through: say what Studio is, find Penny, find the latest release | **within 5 seconds**, owner-judged |
| Accessible and responsive | Keyboard-only use, 44 px targets, no horizontal scroll at 375 px, contrast | **pass** |

## 4. Non-goals

- Any usage tracking, analytics, local usage counters, stored layout preference or reordering by use (dropped by the owner).
- A settings screen, drag-to-arrange, or theming beyond the existing light and dark.
- Changing what Products or Updates show.

## 5. Requirements

**UX-01 (P0): Fixed section order.** Hero, Products, Updates, Reads, Podcasts. The order is the same for every visitor on every visit.

**UX-02 (P0): One section pattern.** Every section has the same anatomy: heading, one-line description, content, a clear empty state, and (owner only, when unlocked) one add action. The two-column Reading list / Books layout is gone (SPEC-RC RC-08). Cards share spacing and a 44 px minimum touch target.

**UX-03 (P0): Navigation consistency.** Header nav and bottom nav list the same four destinations in page order, generated from one list so they cannot disagree, with `aria-current` on the section in view. What's new, theme toggle, logo and skip link are unchanged.

**UX-04 (P0): Links stay stable.** `#products`, `#updates`, `#reads`, `#reads/technical`, `#reads/others` and `#podcasts` go to that section; `#blog` goes to `#podcasts` (SPEC-PC PC-05); an unknown hash does nothing harmful.

**UX-05 (P1): Accessibility and responsiveness.** Keyboard-only pass with a visible focus order that matches the visual order; touch targets ≥ 44 px; no horizontal scroll at 375 px; text contrast ≥ 4.5:1 in both themes; works at 200% zoom; `prefers-reduced-motion` respected.

**UX-06 (P1): First-screen clarity.** The first screen on phone and desktop shows what Studio is and the start of Products without scrolling past decoration; the profile photo and hero stay compact. Verified by the owner walk-through.

**UX-07 (P2): Owner-set order later.** Section order comes from one ordered list in code, so a future owner-editable order is a small change. Not built in 2.0.

## 6. Security and trust

- No new network call, storage, cookie, host or script; CSP unchanged.
- Fragments are matched against a closed list of known sections and sub-items; anything else is ignored and never inserted into the page.
- Nothing about a visitor is recorded.

## 7. Edge cases

| Case | Expected |
|------|----------|
| Old bookmark `#blog` | Lands on Podcasts |
| `#reads/xyz` or `#__proto__` | Ignored; default Reads sub-item |
| Admin locked or unlocked | Layout and order identical; add actions appear only when unlocked |
| Section empty | Friendly empty state, never blank |
| Narrow phone (375 px) | Four bottom-nav items fit, with labels, at 44 px |

## 8. Open questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Labels "Reads" and "Podcasts" in the nav (as in the specs) | Owner | No |
| Q2 | Should Updates stay above Reads and Podcasts? Recommended: yes (decided: Products then Updates stay on top) | Owner | Closed 2026-10-21 |

Closed 2026-10-21: usage-based ordering is **dropped** (owner).

## 9. Rollout and phasing

| Phase | Contents | Gate |
|-------|----------|------|
| A | UX-01 to UX-04 (structure, section pattern, navs, links) | Smoke test: both navs identical, anchors work |
| B | UX-05, UX-06 | Keyboard, contrast, zoom, 375 px, owner walk-through |

Rollback: tag `v1.5`.

## 10. Traceability

| Req | PRD ref | Tests (see test.md) | Code or doc touched |
|-----|---------|---------------------|---------------------|
| UX-01 | §8 | TC-UX-S01–S02 | `index.html` |
| UX-02 | §8 | TC-UX-P01–P04 | `index.html`, `css/site.css` |
| UX-03 | §8 | TC-UX-N01–N05 | `index.html`, `js/app.js` |
| UX-04 | §8 | TC-UX-L01–L05 | `js/app.js` |
| UX-05 | §10, §13.5 | TC-UX-A01–A05 | `css/site.css`, `index.html` |
| UX-06 | §8 | TC-UX-F01 | `index.html`, `css/site.css` |
| UX-07 | §16 | none (P2) | none |

## 11. Status log

- 2026-10-21: Draft created, including usage-based ordering.
- 2026-10-21: Owner dropped usage-based ordering ("not adding any value"). Requirements UX-04 to UX-07 (scoring, storage, privacy, ordering rule, no-jump, reset) removed; spec renamed from "adaptive layout" to "simple layout"; deep links became UX-04; accessibility and first-screen clarity added. Approved.
- 2026-10-23: **Phase A built** on `v2/ux-a-build` (tests first: 12 unit and 25 smoke cases written and shown failing; 5 unit and 14 smoke cases were red before the build, the rest guard behaviour that already held). What changed: every section head is now one pattern (`h2` plus one `p.sec-desc` line; the right-hand `.sub` and Products' "Live from GitHub" note moved into the line); the bottom nav gained **Updates** and both navs are filled from one list (`SECTIONS` in `js/app.js`; the same four links also stay in `index.html` for a page where scripts fail, and a unit test keeps them equal); the two-column Reading list / Books layout is gone (one column, a "Books" block under the reads of the open sub-item, hidden when that sub-item has no books, shown to the owner so a book can still be added; the book editor is unchanged); bottom-nav items are 44 px high. Finding on the way: a cold load of `#updates`, `#reads` or `#podcasts` landed far from the section (the browser places the anchor before the lists render and the page then grows), so boot now scrolls to a section named in the fragment once it has rendered, matching only the four exact ids of the closed list. Decisions: (1) **UX-02 "one add action"**: Reads keeps two owner controls (Share a read, and + Add book inside the Books block) because the book editor stays for now (RC-08); every other section has one; a known deviation. (2) Updates icon `↻`. (3) Books stay a sub-block of the open sub-item, not a sub-item of their own (that is SPEC-RC Phase C). Independent review of UX-04 (G2): [reviews/UX-04.md](../../reviews/UX-04.md).
- 2026-10-26: **Phase B built** on `v2/ux-b-build` (tests first: 5 unit and 11 smoke cases written and shown failing for the parts that were wrong: phone targets, first screen; contrast, reflow and real-Tab focus already held and are kept as guards). Measured on the page, not assumed: text contrast in both themes (28 text styles, at least 4.5:1); real Tab key presses over the DevTools protocol (every stop has a visible ring, order follows the page, first stop is the skip link; the case fails if a ring is removed, proven by mutation); reflow at 320 px and 640 px (a stand-in for 400% and 200% zoom, which headless Chrome cannot set); every control outside running text at least 44 px high on a phone (about 40 were not: chips, share buttons, release links, tags, summaries, footer button, reads titles); reduced motion (CSS block and no scripted smooth scroll); first screen. **UX-06**: the hero was 524 px tall on a phone and 850 px before the first product on a laptop; now the Products heading and the first product show in the first screen at 375x812, 375x667 (heading) and 1280x800. Hero padding, headline size and width, photo (72 to 56 px on a phone) were reduced; nothing was removed. Independent review (G3): [reviews/UX-05.md](../../reviews/UX-05.md). Open: **F01, the owner's 5-second walk-through**, and a real iPhone and screen-reader pass.
- 2026-10-26: Independent review G3 done: first verdict APPROVE WITH CONDITIONS (two high findings, fixed tests-first: dark-theme contrast on version tags and the active bottom-nav item; touch chips under 44 px), re-check **APPROVE**. Record: [reviews/UX-05.md](../../reviews/UX-05.md).
- 2026-10-26: **Shipped in v2.0** (release PR; the tag is pushed after the owner says merge). Phase A (PR #27, review [UX-04](../../reviews/UX-04.md)) and Phase B (PR #30, review [UX-05](../../reviews/UX-05.md)) merged; owner walk-through done on a real iPhone; extreme-zoom fix (PR #32); footer dates (PR #28)
