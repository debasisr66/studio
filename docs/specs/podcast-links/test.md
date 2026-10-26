# Test plan: Podcast links replace the Blog

Spec: [spec.md](spec.md) (`SPEC-PC`). IDs `TC-PC-<group><nn>`. ⬜ not run.

| ID | Req | Case | Expected | Status |
|----|-----|------|----------|--------|
| TC-PC-D01 | PC-01 | `platformOf` for Spotify, Apple Podcasts, YouTube hosts | right labels | ✅ |
| TC-PC-D02 | PC-01 | Unknown host | plain domain, never markup | ✅ |
| TC-PC-D03 | PC-01 | Entry view fills defaults for missing optional fields | pass | ✅ |
| TC-PC-U01 | PC-02 | Blog section and nav items gone; Podcasts present in header and bottom nav | pass | ✅ |
| TC-PC-U02 | PC-02 | Card shows title link, show, platform, date, comment, tags | pass | ✅ |
| TC-PC-U03 | PC-02 | Listen link opens a new tab with `noopener noreferrer` | pass | ✅ |
| TC-PC-U04 | PC-02 | Share on LinkedIn, copy link, native share work | pass | ✅ |
| TC-PC-U05 | PC-02 | Newest first; chips and search only with ≥ 4 entries | pass | ✅ |
| TC-PC-U06 | PC-02 | Empty state text | pass | ✅ |
| TC-PC-U07 | PC-02 | No iframe, audio or third-party image in the DOM; no new network host | pass | ✅ |
| TC-PC-U08 | PC-02 | 375 px and 1280 px: no overflow | pass | ✅ |
| TC-PC-A01 | PC-03 | Composer opens only when unlocked | pass | ✅ |
| TC-PC-A02 | PC-03 | Link and title required; inline announced errors | pass | ✅ |
| TC-PC-A03 | PC-03 | Live preview matches the published card | pass | ✅ |
| TC-PC-A04 | PC-03 | Edit and delete; draft until Publish | pass | ✅ |
| TC-PC-A05 | PC-03 | Publish writes only `content/podcasts.json` (stubbed API: GET sha, validate, PUT once; identical content skips) | pass | ✅ |
| TC-PC-A06 | PC-03 | No blog editor, no `+ New post`, no `post` schema left | pass | ✅ |
| TC-PC-V01 | PC-04 | Unsafe or malformed URL (whitespace, credentials, `javascript:`) | CI error `podcast-url-clean` | ✅ |
| TC-PC-V02 | PC-04 | Missing or over-long title | CI error `podcast-title` | ✅ |
| TC-PC-V03 | PC-04 | Missing or unknown `schema_version` | CI error `podcast-schema-version` | ✅ |
| TC-PC-V04 | PC-04 | Duplicate URL | warning `podcast-duplicate-url` | ✅ |
| TC-PC-V05 | PC-04 | Too many or too long tags; comment over 280 | CI errors | ✅ |
| TC-PC-V06 | PC-04 | Every new rule has a fixture and runbook row (TR-04 guard) | pass | ✅ |
| TC-PC-V07 | PC-04 | Real `podcasts.json` passes | pass | ✅ |
| TC-PC-R01 | PC-05 | `#blog` and `#blog/x` land on Podcasts | pass | ✅ |
| TC-PC-R02 | PC-05 | Page does not fetch `blog.json`; file still served and valid | pass | ✅ |
| TC-PC-R03 | PC-05 | Health check still green (file served) | pass | ✅ |
| TC-PC-R04 | PC-05 | No dead code: no reference to `renderBlog`, `post` schema, `#addPost` | pass | ✅ |
| TC-PC-R05 | PC-05 | Changelog 2.0 explains the change in plain text | pass | ⬜ |
| TC-PC-K01 | PC-06 | Reads composer no longer offers Podcast; hint present | pass | ✅ |
| TC-PC-K02 | PC-06 | A Reads entry with kind `podcast` still validates and renders | pass | ✅ |
| TC-PC-N01 | PC-07 | Tracking parameters stripped, host lowercased | pass | ✅ |
| TC-PC-N02 | PC-07 | Duplicate warning in composer and CI | pass | ✅ |
| TC-PC-S01 | PC-08 | At least 3 seed podcasts (Lex Fridman, ThePrimeagen, Yuval Noah Harari) published by the owner with real URLs (owner step) | 🔒 | ⬜ |

Regression: Reads, Products, Updates, What's new, profile photo, theme toggle, admin unlock and publish for reads; 142-test suite green; CSP clean.

Exit criteria: P0 rows ✅ (PC-01 to PC-05); owner Q2 and Q3 answered before launch. **Phase A: PC-01 and PC-04 rows ✅ (V07: the real file is valid and empty). Phase B: PC-02, PC-03 and PC-05 rows ✅ except R05 (the 2.0 changelog is written in the release PR) and N02 (Phase C).**

## Status log
- 2026-10-21: Draft created; nothing run.
- 2026-10-22: PC Phase A run (`v2/pc-a`): `tests/spec-pc-phase-a.test.js` (13 tests, all failed first), then 194 of 194 unit tests pass; smoke 17 of 17 unchanged; validator OK and shown to fail on a deliberately bad file. D01-D03 and V01-V07 ✅. Two rules beyond the spec's six (`podcast-show`, `podcast-duplicate-id`) mirror the Reads rules. Groups U, A, R, K, N, S arrive in Phases B and C.
- 2026-10-23: PC Phase B run (`v2/pc-b`): `tests/spec-pc-phase-b.test.js` (13 unit tests, 12 failed first) and 22 new smoke cases (22 failed first, plus the two timing cases that now need the Podcasts section). Now 231 of 231 unit tests, 60 of 60 smoke cases, validator OK. U01-U08, A01-A06, R01-R04, N01 ✅. Extra case beyond the plan: `TC-PC-A07` (XSS payloads in title, show, comment and tags stay inert in the preview and the card). The smoke fixtures for the old Blog (`poison-blog-null`, `missing-blog`) were replaced by `future-podcasts-version`, `missing-podcasts` and `podcasts-many`; `null-files` now also has a `null` podcasts.json. U07 also checks that no request leaves the origin. Independent review (PC-03, PC-05): [../../reviews/PC-B.md](../../reviews/PC-B.md), APPROVE WITH CONDITIONS then APPROVE after fixes; its three medium findings are covered by new cases `TC-PC-A08` (failed load), `A09` (stale or concurrent publish), `A10` (edit then delete, three cases) and `A11` (whole-file validation). R05 waits for the release PR; N02 (duplicate warning in the composer) and K, S are Phase C.
- 2026-10-26: Phase C: K01, K02 and N02 written first and shown failing (K01, N02 red; K02 passed before and stays as a guard, now also checking that the extra option is removed again). **PC-06:** Podcast is no longer offered in the Reads composer or the Quick add type list; a hint links to Podcasts; an older entry with kind `podcast` still renders and keeps its type when edited. **PC-07:** the podcast composer and Quick add refuse a link already in Podcasts (tracking parameters ignored), like Reads does; CI keeps its warning (TC-PC-A unit case). Open: **PC-08** (the owner supplies at least 3 links) and R05 (changelog 2.0, release step).
