# Spec: A simpler layout that adapts to what each visitor uses

| | |
|---|---|
| Spec ID | `SPEC-UX` (requirements `UX-01` … `UX-10`) |
| Status | **Draft: awaiting owner approval** |
| Owner | Debasis Ray |
| Created | 2026-10-21 |
| Parent | [PRD](../../PRD.md) §7, §8, §10.3; [§22](../../PRD.md) |
| Depends on | [SPEC-RC](../reads-categories/spec.md), [SPEC-PC](../podcast-links/spec.md) (the final set of sections), [SPEC-SH](../stabilize-core-hub/spec.md) |
| Target | Studio v2.0 (last of the four) |

## 1. Summary

Make the page more intuitive while keeping it simple: **Products first, Updates next, then the remaining sections ordered by how much the visitor actually uses them.** "Used more" is counted per visitor, on their own device only, because Studio has no analytics and must not gain any.

## 2. Evidence

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Section order is fixed: Products, Updates, Blog, Reads. The header nav has four links, the bottom nav three (Updates is missing there), so the two navs disagree | `index.html` nav and bottom nav |
| F2 | After RC and PC the content sections are Reads (Technical, Others) and Podcasts: two top-level sections, so ordering is a two-way choice plus a default sub-item | SPEC-RC, SPEC-PC |
| F3 | Studio has no usage data and by rule cannot collect any (CSP, PRD §10.3: no analytics, no trackers), so site-wide frequency is unavailable; only the visitor's own device can know their use | PRD §10.3, CSP |
| F4 | The page already keeps one harmless local preference (`studio-seen-version`) behind a storage-blocked fallback, so the pattern exists | `js/app.js` `lsGet`, `storageOk` |
| F5 | Reads has two sub-headings and a two-column Reading list / Books layout; the section header patterns differ between sections | `index.html` |

## 3. Interpretation to confirm (Q2)

"Whatever is used more should appear below the product cards and updates" is read as: **Products and Updates stay on top, in that order; sections below them reorder by use.** If instead everything including Updates should reorder, that is a one-line change to the unit list.

## 4. Goals and measures

There is no analytics to measure real use, so goals are checked by tests and an owner walk-through, not by dashboards.

| Goal | Measure | Target |
|------|---------|--------|
| Simple, predictable structure | Top-level destinations in the header and in the bottom nav | the **same 4**, in page order: Products, Updates, then the two adaptive sections |
| Adapts to the visitor | After repeated use of one section on a device, that section is above the other on the next visit | **yes**, with hysteresis |
| Private by construction | Bytes of usage data sent anywhere; new network requests; cookies | **0, 0, 0** |
| Stable | Layout shift caused by reordering; flip-flop between visits | **0 CLS from reorder**; no reorder without a clear leader |
| No dead links | Existing anchors and deep links | **all land correctly** |

## 5. Non-goals

- Analytics, A/B tests, heatmaps, session replay or any server-side or cross-device tracking.
- Personalising content (what is shown), only the order of sections and the default sub-item.
- Reordering Products or Updates; moving things while the visitor is reading (no live reordering).
- A settings screen.

## 6. Requirements

**UX-01 (P0): Section structure.** Order: hero, Products, Updates, then the adaptive group {Reads, Podcasts}. Default order of the adaptive group: Reads, then Podcasts.

**UX-02 (P0): One section pattern.** Every section has the same anatomy: heading, one-line description, content, a clear empty state, and (owner only) one add action. The two-column Reading list / Books layout is gone (SPEC-RC RC-08). Cards share spacing and a 44 px minimum touch target.

**UX-03 (P0): Navigation consistency.** Header nav and bottom nav list the same four destinations in the page's current order, with `aria-current` on the section in view. The nav follows the adaptive order. What's new, theme toggle, logo and skip link are unchanged.

**UX-04 (P0): Local usage signals.** Counted events: opening a section from the nav; switching the Reads sub-item; using a filter or search; opening a read or podcast link; copying or sharing one. Units (a fixed list): `reads`, `podcasts`, `reads.technical`, `reads.other`. Stored under one key (`studio-use-v1`) in `localStorage` as `{ v:1, u:{ unit:{ s:<decayed score>, t:<last update, whole days since 1970> } } }`, at most a few hundred bytes. On each event: `s = s × 0.5^((today − t) / 30) + 1`, then `t = today`. Unknown units are ignored.

**UX-05 (P0): Privacy by construction.** Usage data is never transmitted, never put in a URL or cookie, never read by anything except the layout code. If storage is blocked or full, nothing breaks and the default order is used. A test asserts no new network request or storage key beyond the one above.

**UX-06 (P0): Ordering rule.** Score = the stored decayed score (each event adds 1; the total halves every 30 days), read with the same decay applied up to today. Computed **once at page load**, never while the page is open. The adaptive group reorders only when the leader's score is at least **3** and at least **1.5×** the runner-up; otherwise the default order stays (hysteresis, so the page does not flip-flop). The same rule picks the default Reads sub-item (SPEC-RC RC-02).

**UX-07 (P0): No jump, no motion.** The order is applied before the sections first render, so there is no visible reflow (layout shift from the reorder: 0); no animation is added; `prefers-reduced-motion` is respected.

**UX-08 (P0): Links stay stable.** `#products`, `#updates`, `#reads`, `#reads/technical`, `#reads/others`, `#podcasts` always go to that section regardless of the adaptive order; `#blog` goes to `#podcasts` (SPEC-PC PC-05).

**UX-09 (P1): Transparency and reset.** A footer line "Studio remembers which sections you use, on this device only." with a **Reset my layout** button that clears the key and restores the default order immediately on next load (and says so).

**UX-10 (P2): Owner default order.** An owner-editable default order in a content file, and an admin preview of the default. Not needed for 2.0.

## 7. Security and trust

- No new network call, cookie, host or script; CSP unchanged.
- Stored data is a closed shape validated on read (unknown keys dropped, numbers clamped, maximum size enforced); corrupt or hostile local data falls back to defaults.
- No identifiers: nothing in the stored data distinguishes one visitor from another; it cannot be used to fingerprint across sites.
- Deep-link fragments are matched against a closed list.

## 8. Edge cases

| Case | Expected |
|------|----------|
| First visit, or storage blocked (private window) | Default order; no errors |
| Two sections nearly equal | Default order stays (hysteresis) |
| Owner uses the page a lot while editing | Counts as ordinary use on that device only |
| Reset clicked | Key cleared; next load uses defaults; note shown |
| Corrupt JSON in the key | Treated as empty |
| Visitor with an old bookmark `#blog` | Lands on Podcasts |
| Reads sub-item preference differs from section preference | Independent units; both obey the rule |

## 9. Open questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Per-device only (recommended) or site-wide counts? Site-wide would need analytics or a backend, which PRD §10.3 forbids | Owner | **Yes for UX-04 design** |
| Q2 | Confirm that Products and Updates stay fixed on top and only the sections below adapt (§3) | Owner | No |
| Q3 | Thresholds: score ≥ 3 and 1.5× lead, 30-day half-life. Acceptable defaults? | Owner | No |
| Q4 | Default order Reads then Podcasts, or the reverse? | Owner | No |
| Q5 | Is the footer reset line acceptable, or should the note be shown only after the layout first adapts? | Owner | No |

## 10. Rollout and phasing

| Phase | Contents | Gate |
|-------|----------|------|
| A | UX-01 to UX-03 (static structure and nav, default order only) | Smoke test: both navs identical, anchors work |
| B | UX-04 to UX-08 (signals, rule, privacy, stability) | Unit tests of the scoring module; network/storage assertions |
| C | UX-09 | Reset path tested |

Because Phase A changes the structure without adaptation, the release can ship A alone if needed. Rollback: tag `v1.5`; the stored key is ignored by old code.

## 11. Traceability

| Req | PRD ref | Tests (see test.md) | Code or doc touched |
|-----|---------|---------------------|---------------------|
| UX-01 | §8 | TC-UX-S01–S03 | `index.html` |
| UX-02 | §8 | TC-UX-P01–P04 | `index.html`, `css/site.css` |
| UX-03 | §8 | TC-UX-N01–N05 | `index.html`, `js/app.js` |
| UX-04 | §10.3 | TC-UX-U01–U06 | new `js/layout-lib.js`, `js/app.js` |
| UX-05 | §10.3, §14 | TC-UX-V01–V05 | same, smoke test |
| UX-06 | §8 | TC-UX-R01–R08 | `js/layout-lib.js` |
| UX-07 | §10.1 | TC-UX-C01–C03 | `js/app.js`, `css/site.css` |
| UX-08 | §8 | TC-UX-L01–L05 | `js/app.js` |
| UX-09 | §10.3 | TC-UX-T01–T03 | `index.html`, `js/app.js` |
| UX-10 | §16 | none (P2) | none |

## 12. Status log

- 2026-10-21: Draft created from code findings F1-F5. Awaiting owner answers (Q1 blocking for UX-04).
