# Test Plan and Traceability — Studio v1.1

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
| REQ-08 | TC-R05; **TC-M01** | ✅ code unchanged; ⏳🔒 live publish |
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
| TC-M01 | Unlock admin with a real token, post a read, Publish, confirm one commit to `content/reads.json` and the read appears after the Pages rebuild | ⏳🔒 |
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
- [ ] TC-M01 completed with the owner's token (pending)

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
