# Test plan: Simpler layout

Spec: [spec.md](spec.md) (`SPEC-UX`). IDs `TC-UX-<group><nn>`. ⬜ not run. Cases run in the browser smoke test (SPEC-SH SH-02) plus an owner walk-through; there is no scoring or storage logic to unit-test.

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-UX-S01 | UX-01 | DOM order: hero, Products, Updates, Reads, Podcasts | pass | ✅ |
| TC-UX-S02 | UX-01 | Order identical on repeated loads, locked and unlocked, with storage blocked | pass | ✅ |
| TC-UX-P01 | UX-02 | Every section has heading, one-line description, empty state | pass | ✅ |
| TC-UX-P02 | UX-02 | Add action appears only when unlocked, one per section | pass | ✅ |
| TC-UX-P03 | UX-02 | Touch targets ≥ 44 px at 375 px; no overflow | pass | ✅ |
| TC-UX-P04 | UX-02 | Two-column Reading list / Books layout is gone | pass | ✅ |
| TC-UX-N01 | UX-03 | Header and bottom nav show the same four links | pass | ✅ |
| TC-UX-N02 | UX-03 | Nav order equals page order | pass | ✅ |
| TC-UX-N03 | UX-03 | `aria-current` follows the section in view | pass | ✅ |
| TC-UX-N04 | UX-03 | Keyboard: skip link works; tab order matches visual order | pass | ✅ |
| TC-UX-N05 | UX-03 | What's new, theme toggle, logo unchanged | pass | ✅ |
| TC-UX-L01 | UX-04 | `#products`, `#updates`, `#reads`, `#podcasts` reach the right section | pass | ✅ |
| TC-UX-L02 | UX-04 | `#reads/technical` and `#reads/others` | pass | ✅ |
| TC-UX-L03 | UX-04 | `#blog` → Podcasts | pass | ✅ |
| TC-UX-L04 | UX-04 | Unknown hash (`#xyz`, `#__proto__`, `#reads/<script>`) does nothing harmful | pass | ✅ |
| TC-UX-L05 | UX-04 | Anchors work with storage blocked | pass | ✅ |
| TC-UX-A01 | UX-05 | Keyboard-only pass: every control reachable, focus visible | pass | ✅ |
| TC-UX-A02 | UX-05 | Contrast ≥ 4.5:1 for text in both themes | pass | ✅ |
| TC-UX-A03 | UX-05 | 200% zoom: no loss of content or function | pass | ✅ |
| TC-UX-A04 | UX-05 | `prefers-reduced-motion` respected | pass | ✅ |
| TC-UX-A05 | UX-05 | No horizontal scroll at 375 px and 1280 px | pass | ✅ |
| TC-UX-F01 | UX-06 | Owner walk-through: within 5 seconds say what Studio is, find Penny, find the latest release (owner step) | 🔒 | ✅ owner, 2026-10-26: run on the sandbox, on a real iPhone |

Phase A run 2026-10-23: unit `tests/spec-ux-phase-a.test.js` (12) and 25 smoke cases (`TC-UX-*`, `scripts/smoke.js`), all green; see [test.md section N](../../test.md). Not run: A01 to A04 (Phase B) and F01 (owner step). N04 here covers the skip link and the header tab order only; the full keyboard pass is A01. P02: Reads has two owner controls (see the spec status log).

Regression: 142-test suite, RC and PC suites, health and CI green; page weight within budgets; CSP unchanged; no new request, storage or cookie.

Exit criteria: P0 rows ✅ (UX-01 to UX-04); P1 ✅ or deferred in writing.

## Status log
- 2026-10-21: Draft created; nothing run.
- 2026-10-21: Rewritten after the owner dropped usage-based ordering: 22 cases (was 42).
- 2026-10-23: Phase A cases run and green (S, P, N, L, A05); A01 to A04 and F01 not run.
- 2026-10-26: Phase B cases run and green (A01 to A04, P03 at 375 px, F01 measured part); F01 owner walk-through still pending. A03 uses widths 320 and 640 as the proxy for zoom. See [test.md section P](../../test.md).
- 2026-10-26: Owner checks on a real iPhone and in Chrome: VoiceOver fine; Safari fine at the largest zoom; **Chrome at the largest zoom (about 256 CSS px) showed blank space on the right and cut-off or jumbled content** (footer, header, Reads area). Reproduced by two new cases (`TC-UX-A03` at 256 and 200 px, which failed first: 39 and 95 px of sideways scroll), fixed in `css/site.css` (max-width 340 px block), PR for owner review. Earlier reflow cases stopped at 320 px and skipped the tabs and chips, which is why they missed it.
- 2026-10-26: F01 done by the owner on the sandbox on a real iPhone (owner-reported; no timing or notes recorded). The blank space under the footer found in that run was fixed before merge (PR #30).
