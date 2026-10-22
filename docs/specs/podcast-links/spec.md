# Spec: Podcast links replace the Blog

| | |
|---|---|
| Spec ID | `SPEC-PC` (requirements `PC-01` … `PC-09`) |
| Status | **Approved by the owner (2026-10-21); Phase A built on `v2/pc-a` (PR open, awaiting merge approval); B and C not started** |
| Owner | Debasis Ray |
| Created | 2026-10-21 |
| Parent | [PRD](../../PRD.md) §7, §9.4, §11.3; [§22](../../PRD.md) |
| Depends on | [SPEC-SH](../stabilize-core-hub/spec.md) SH-01, SH-02, SH-04 |
| Target | Studio v2.0 |

## 1. Summary

The blog has never been used (`content/blog.json` holds zero posts). Replace it with **Podcasts**: the owner shares links to podcasts and episodes worth hearing, each with a short take, the way Reads works for articles. No audio is hosted and nothing is embedded.

## 2. Evidence

| # | Finding | Evidence |
|---|---------|----------|
| F1 | `blog.json` is `{"posts": []}`: nothing to migrate, nothing to lose | `content/blog.json` |
| F2 | Blog touches the nav (header and bottom), a section, `renderBlog`, the `post` editor schema, and the publish list | `index.html`, `js/app.js` lines 63-69, 159-168, 450, 508 |
| F3 | Reads already has everything a link list needs: composer, strict URL rules, tags, share, validation, duplicate check | `js/reads-lib.js`, `renderReads` |
| F4 | `kind: "podcast"` already exists as a Reads format, which will overlap with this section | `KINDS` in `js/reads-lib.js`, composer `<select>` |
| F5 | The CSP (`default-src 'none'`, no frames) forbids embedded players and any third-party host | `index.html` CSP meta |
| F6 | Old `#blog` links may exist in shared places; today they scroll to the Blog section | anchors |

## 3. Goals and measures

| Goal | Measure | Target |
|------|---------|--------|
| Owner shares a podcast link in under a minute | Steps from unlock to published | add form: ≤ 4 fields to fill (link, title, optional show, optional take) |
| No dead ends | Old `#blog` link lands on Podcasts | **100%** |
| No new third party | New hosts in CSP or network requests | **0** |
| Same safety as Reads | URL, escaping, validation rules | identical, one shared rule set |

## 4. Non-goals

- Hosting, embedding, streaming or auto-playing audio (CSP forbids; privacy).
- Fetching titles, covers or episode lists from podcast platforms or RSS (no third-party calls).
- A new blog or long-form writing. Retired, not replaced.
- Podcast sub-items (the Technical / Others split is Reads only).

## 5. Requirements

**PC-01 (P0): Data model.** New `content/podcasts.json`: `{ "schema_version": 1, "podcasts": [ { id, added (YYYY-MM-DD), title (required, ≤ 140), url (required), show (optional, ≤ 80), comment (optional, ≤ 280), tags (optional, ≤ 5 of ≤ 24 chars) } ] }`. One `url` per entry; a link may point to a show or an episode.

**PC-02 (P0): The Podcasts section.**
- [ ] Replaces the Blog section and nav items (header and bottom nav). Label: **Podcasts**; id `podcasts`.
- [ ] Each card: title as an external link, show name, platform label derived from the host (Spotify, Apple Podcasts, YouTube, otherwise the domain), date, comment, tags, a **Listen →** link opening in a new tab with `rel="noopener noreferrer"`, and the same Share on LinkedIn / Copy link / Share… row as Reads.
- [ ] Newest first; tag chips and search appear only when there are 4 or more entries (as Reads does today); empty state "No podcasts yet. Check back soon."
- [ ] No iframe, audio element or third-party image.

**PC-03 (P0): Admin.** Owner-only "Share a podcast" composer (reusing the Reads composer pattern): link and title required; show, take and tags optional; live preview; edit and delete; publishing writes `content/podcasts.json` through the existing safe flow (GET sha, validate, skip if identical, PUT). The blog editor, `+ New post` and the `post` schema are removed.

**PC-04 (P0): Validation.** `validatePodcasts` in CI using the shared strict URL rule (TR-01) and rule ids with failing fixtures (`podcast-url-clean`, `podcast-title`, `podcast-schema-version`, `podcast-duplicate-url` as a warning, `podcast-tags`, `podcast-comment`) added to `RULES`, the runbook and `docs/CONTRACT.md` (SH-03).

**PC-05 (P0): Retire the blog safely.**
- [ ] Remove the Blog section, nav links, `renderBlog`, the `post` editor and the blog entry in the publish list.
- [ ] `#blog` (and `#blog/...`) navigates to `#podcasts`.
- [ ] `content/blog.json` stays in the repo as an unrendered archive (Q2) and keeps validating; the page no longer fetches it. Health keeps checking that it is served.
- [ ] Release notes (changelog 2.0) tell visitors the blog is now Podcasts.

**PC-06 (P1): Reads `podcast` kind.** The composer stops offering "Podcast" as a Reads format; existing entries with that kind (none today) and the validator keep accepting it. A one-line hint in the Reads composer points to the Podcasts section.

**PC-07 (P1): Duplicates and normalisation.** Same normalisation as Reads (strip tracking parameters, lowercase host, drop fragments); a duplicate URL gives a warning in the composer and in CI.

**PC-08 (P1): Seed content.** The owner supplies at least 3 podcast links before launch so the section is not empty on day one. Chosen sources (2026-10-21): **Lex Fridman, ThePrimeagen, Yuval Noah Harari**; the exact show or episode URLs are supplied by the owner at seeding time (a link to a show is valid, Q1). Not a blocker for the code.

**PC-09 (P2): Not now.** RSS or platform lookup, audio previews, per-show pages.

## 6. Security and trust

- No new host, no embeds, no scripts; CSP unchanged.
- All text escaped; URL rules shared with Reads (clean http(s), no credentials or control characters, ≤ 2048).
- The platform label comes from a closed list keyed on the host; unknown hosts show the plain domain (never untrusted markup).
- Admin token handling unchanged; the composer cannot publish an invalid file.

## 7. Edge cases

| Case | Expected |
|------|----------|
| Visitor opens an old `#blog` link | Lands on Podcasts |
| Podcast URL is a Spotify show page, an Apple episode, a YouTube video | Each gets its platform label |
| URL with tracking parameters | Stored clean |
| `podcasts.json` missing or invalid | Section shows its fallback line; rest of page unaffected (SH-01) |
| Owner publishes while Pages is lagging | Existing publish flow and sha check handle it |
| Duplicate link | Warning, not error |

## 8. Open questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Is a link to a show as valid as a link to an episode? Recommended: yes (one URL field, optional show name) | Owner | No |
| Q2 | Keep `blog.json` as an archive (recommended; zero risk) or delete it? | Owner | No |
| Q3 | Which podcast links should seed the section at launch? | Owner | Before launch, not before coding |
| Q4 | Label: "Podcasts" (recommended) or "Podcast links" | Owner | No |

**Decisions (owner, 2026-10-21):** Q1 a show link is as valid as an episode link; Q2 keep `blog.json` as an unrendered archive; Q3 seed content comes from **Lex Fridman, ThePrimeagen and Yuval Noah Harari** (these are people or shows, not links: the owner supplies the exact podcast or episode URLs when seeding, and none are invented here); Q4 label "Podcasts".

## 9. Rollout and phasing

| Phase | Contents | Gate |
|-------|----------|------|
| A | PC-01, PC-04 (data and validator; section not visible yet) | Fixtures and contract green |
| B | PC-02, PC-03, PC-05 (swap Blog for Podcasts, redirect) | Smoke test covers section, redirect, empty state |
| C | PC-06, PC-07, PC-08 | Owner seed content and admin publish check |

Rollback: tag `v1.5` restores the Blog section; `podcasts.json` is ignored by old code.

## 10. Traceability

| Req | PRD ref | Tests (see test.md) | Code or doc touched |
|-----|---------|---------------------|---------------------|
| PC-01 | §11.3 | TC-PC-D01–D03 | `content/podcasts.json`, `js/reads-lib.js` (or new `js/podcast-lib.js`) |
| PC-02 | §9.4 | TC-PC-U01–U08 | `index.html`, `js/app.js`, `css/site.css` |
| PC-03 | §9.4 | TC-PC-A01–A06 | `index.html`, `js/app.js` |
| PC-04 | §9.6 | TC-PC-V01–V07 | `scripts/validate-site.js`, `tests/fixtures/` |
| PC-05 | §9.4, §13 | TC-PC-R01–R05 | `index.html`, `js/app.js`, `scripts/health-check.js` |
| PC-06 | §9.4 | TC-PC-K01–K02 | `index.html` |
| PC-07 | §9.6 | TC-PC-N01–N02 | `js/reads-lib.js` |
| PC-08 | §13.1 | TC-PC-S01 | `content/podcasts.json` |
| PC-09 | §16 | none (P2) | none |

## 11. Status log

- 2026-10-21: Draft created from code findings F1-F6. Awaiting owner answers to Q1 to Q4.
- 2026-10-21: Approved by the owner with the recommended answers; decisions recorded in section 8-9 above.
- 2026-10-22: Phase A built on `v2/pc-a`: PC-01 (`content/podcasts.json` with `schema_version` 1 and no entries; `platformOf`, `podcastView` and the version helpers in `js/reads-lib.js`) and PC-04 (`validatePodcasts`, run by `validate-site.js`; eight rules with fixtures, RUNBOOK rows and CONTRACT entries: the six listed plus `podcast-show` and `podcast-duplicate-id`). The duplicate-link check keeps the query string so different YouTube videos are different links. No visible change: `index.html`, `app.js`, CSS, workflows, health check and the changelog are untouched. Results: [test.md](test.md).
