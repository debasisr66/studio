# Security — Studio

Threat model, control inventory and review log. Living document: updated every release. Last review: **v1.5 (SPEC-TR logs §8-10); v2.0 pre-implementation review §11 (planned)** .

This is a design-and-test review of a small static site, with evidence from the test runs in [test.md](test.md). It is not a penetration test and not a certification.

## 1. What is being protected

| Asset | Why it matters |
|-------|----------------|
| The owner's GitHub fine-grained tokens (admin token, dispatch token) | Write access to the `studio` repo (and so to the live site) |
| The integrity of the live site and its content | Visitors trust what they read and the links they click |
| Visitors' browsing | No accounts and no analytics; the aim is to leak nothing about them to anyone |
| The sync pipeline | A bad cache or workflow would publish wrong data |

Trust boundaries: visitor's browser ↔ GitHub Pages (static files) · admin's browser ↔ GitHub API (token) · product repos → hub (read-only API) · Penny workflow → hub (dispatch token).

There is no server code, no database and no user account system.

## 2. Threats and controls

| # | Threat | Controls in place | Evidence | Residual risk |
|---|--------|-------------------|----------|---------------|
| T1 | **Script injection** through content (reads, blog, changelog, release notes, repo descriptions) | Every dynamic string is HTML-escaped; links pass an http(s) allowlist; strict CSP forbids inline script, inline style and `eval`; CI rejects `<`/`>` and links in the changelog | TC-S01–S08 (v1.1), TC-S09–S12 (v1.3): hostile payloads render as text, `window.__pwn` stays unset, zero CSP violations | Low |
| T2 | **Token theft from the browser** by script running on this origin | Token in `sessionStorage` only (this tab; gone when it closes); never in `localStorage`, cookies, URL or DOM; 30-minute idle lock; legacy stored tokens deleted; strict CSP removes the usual routes for running attacker script | TC-K09–K13, unit tests TC-K01–K08 | **Medium, accepted**: any script that does run on the origin could read `sessionStorage`; a static site has no way to hide a token from its own page |
| T3 | **Over-broad token** | Fine-grained tokens limited to the `studio` repo; Contents read and write only; dispatch and admin tokens are separate; the dispatch token lives only as a secret in the product repo | Setup steps and runbook in the learning guide | Low; depends on the owner following the steps |
| T4 | **Malicious or accidental commit** (including a compromised token) | Git history is the audit trail and backup; CI validates content shape on every push; no npm dependencies; Actions limited to `contents: read` (CI, health) and `contents: write` on the hub only (sync) | CI runs, `git revert` runbook | Low–medium: CI alerts but does not block merges (no branch protection) |
| T5 | **Supply chain** | No package manager and no build step; the two first-party actions are pinned by **commit hash** (first verified as the v4.4.0 commits; Dependabot's first proposals, checkout v7.0.1 and setup-node v7.1.0, were checked in dry-run mode and merged on 2026-10-20); Dependabot proposes weekly updates; CI rejects any unpinned action, any workflow without a permissions block, and `contents: write` outside the sync and keep-alive workflows | TC-W10–W14 | Low: the pins must be kept current (Dependabot) |
| T6 | **Clickjacking** (the page framed by another site) | None possible in-page: GitHub Pages does not let you send `frame-ancestors` or `X-Frame-Options`, and a meta CSP ignores `frame-ancestors` | Documented limitation | Low: admin controls need a present token; acceptable now, fixable with a CDN adding headers |
| T7 | **Third-party content** | Fonts are self-hosted with their licences; CSP `style-src` and `font-src` are `'self'` only; CI rejects third-party hosts, external links and external CSS urls; no analytics, trackers or metadata services. The only third parties a visitor can reach are ones they choose to click (LinkedIn share) | TC-F01, TC-V20–V24 | **Low (was: Google saw every visit)** |
| T8 | **Outbound link abuse** (tab-napping, referrer leakage) | Every external link has `rel="noopener noreferrer"` | TC-A05 | Low |
| T9 | **Share-link injection** | Only normalised http(s) URLs are shared; `encodeURIComponent` on the LinkedIn URL | TC-U12, TC-B09 | Low |
| T10 | **Workflow abuse** | CI and health: `permissions: contents: read`, no secrets; sync: `contents: write` on this repo only; product repos are only ever read | Workflow files | Low |
| T11 | **Availability** | GitHub Pages; daily health check at 12:00 UTC (after the sync, which GitHub starts hours late); the health check also fails if any workflow is disabled; a weekly keep-alive adds one empty commit only when `main` has been quiet for 30 days, so GitHub does not switch scheduled workflows off after 60 days | TC-A01–A09, TC-H10–H12 | Medium: no SLA; GitHub does not publish an exact definition of "repository activity", so keep-alive relies on commits to `main`, the known-good signal |
| T12 | **Hostile or sensitive image upload** (owner-only, so mainly a mistake or a malicious file chosen in error) | Type allowlist (PNG, JPEG, WebP; no SVG, no GIF); size and pixel limits; the file is decoded and re-encoded by the browser into a fresh 512 px JPEG, so scripts, polyglots and **all metadata (including GPS)** do not survive; only a validated JPEG data URL is published; CI checks the committed file's signature, size and dimensions | TC-P01–P05, TC-P03 (planted GPS marker absent from output), TC-V25–V27 | Low. The photo is public once published (the dialog says so) |
| T13 | **Repository process failures** (a bad change reaching `main`; history rewritten or deleted) | A *history* ruleset: nobody, including the owner, can force-push or delete `main` (tested on a throwaway branch with identical rules; in force on `main`). Releases go through a pull request and are merged only when CI is green. A *CI-required* ruleset was tested and **not kept**: it rejects the bots' direct pushes and GitHub does not allow the Actions app as a bypass actor on a personal repository | TC-B01–B07 | **Medium, accepted**: CI cannot technically block the owner's merges or the bots' pushes; a bad content commit from the admin screen is caught by CI afterwards (red run and email), not prevented |
| T14 | **A second write path** (the keep-alive workflow can commit) | `contents: write` only in that workflow and in sync (CI-enforced allowlist); it makes only empty commits, touches no file, uses no secret, takes its message from its own script through an environment variable (never interpolated into the shell), and is unit-tested | TC-A01–A09, TC-W12 | Low |

## 3. Control inventory (as of v1.3)

| Control | Where |
|---------|-------|
| CSP: `default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.github.com; base-uri 'none'; form-action 'none'` | `index.html` (checked in CI by `validate-site.js`) |
| No inline `<script>`, `<style>` or `style=`; no JS that emits style attributes | CI rules |
| Escaping of all rendered text; http(s)-only URL handling | `js/app.js`, `js/reads-lib.js` |
| Token store (`sessionStorage`, memory fallback, legacy purge) | `js/token-store.js` |
| Admin limited to login `debasisr66`; idle lock; lock button | `js/app.js` |
| One file per commit, SHA read before write, JSON re-parsed before write, identical content skipped | `publishFile` |
| Content and site validation; unit tests | CI |
| Daily health check (site up, cache equals GitHub releases) | `health.yml` |
| Read-only access to product repos; one-way dispatch | `sync-products.js`, `notify-studio.yml` |
| Self-hosted fonts with licences; no third-party host in CSP or page; rupee coverage | `fonts/`, `css/site.css`, CI |
| Photo rules (type, size, pixels, re-encode, metadata removal); manifest path restricted; published JPEG validated | `js/image-lib.js`, `js/app.js`, CI |
| Actions pinned by hash; permissions declared; write only where a bot must commit; Dependabot | `.github/`, CI |
| Branch ruleset "history protected" (no deletion, no force-push, for everyone); definitions in `docs/rulesets/` | Repository settings |
| Keep-alive (weekly, empty commit only after 30 quiet days); health check also reports disabled workflows | `keepalive.yml`, `health.yml` |

## 4. v1.3 review log

Scope: admin token storage, strict CSP (styles), What's new and changelog, version display.

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| S-01 | Token is stored in `sessionStorage` after unlock and **not** in `localStorage` | Pass | TC-K11 |
| S-02 | A token left in `localStorage` by v1.2 is deleted on load and not copied | Pass | TC-K09 |
| S-03 | Token absent from DOM, cookies, URL and every `localStorage` value after unlock | Pass | TC-K11 |
| S-04 | A token for another GitHub account is rejected and nothing is stored | Pass | TC-K10 |
| S-05 | After reload in the same tab the session persists; **Lock** clears it; a fresh tab has no token | Pass | TC-K13, TC-K06 |
| S-06 | Blocked or full storage falls back to memory and persists nothing | Pass (unit tests) | TC-K03, K04; not exercised in a real browser |
| S-07 | Publish sends the session token as a Bearer header, one file per commit, with the file's SHA; identical content is skipped | Pass (stubbed API, no real write) | TC-K12 |
| S-08 | CSP forbids `'unsafe-inline'` for **styles** and scripts; `index.html` and the JS contain no inline style or script | Pass | TC-C01–C04, validator on the repo |
| S-09 | Zero CSP violations across: page load, What's new, composer with live preview, dialogs, theme toggle, release notes expanded, admin unlock | Pass | Fresh-tab run, empty console |
| S-10 | Dynamic styling (avatar hue, language dot) works under the strict CSP | Pass | Computed-style comparison; painted values checked |
| S-11 | Hostile changelog (markup in title and items, bad version and date, `javascript:` text) renders as inert text; no `img`, `script` or `a` elements; no code runs | Pass | TC-S11 |
| S-12 | Missing changelog hides the button and version and leaves the page intact | Pass | TC-W03 |
| S-13 | No `eval`, `new Function`, `document.write` or `outerHTML =` in the JS; no new third-party host; no new dependency | Pass | Source search, CSP |
| S-14 | No token-like strings in the repository, docs or tests | Pass | Pattern scan at commit |
| S-15 | Workflow permissions unchanged (CI and health read-only; sync as before) | Pass | `git diff` on `.github/` is empty |

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| F-1 | Info | A console message "Applying inline style violates the Content Security Policy" appeared during testing. It was caused by the test harness deliberately injecting a `<style>` element to prove the CSP blocks it; a fresh tab running the real page showed no messages | Explained, no action |
| F-2 | Info | Admin token still readable by script that runs on the origin (T2). v1.3 shortens its life and removes the loopholes that make running such script easier | Accepted, documented |
| F-3 | Low | No `frame-ancestors` or HSTS control on GitHub Pages (T6) | Accepted; CDN with headers is the fix |
| F-4 | Low | Google Fonts requested from Google (T7) | Open: self-hosting is the planned fix |
| F-5 | Low | Actions pinned by tag, not by commit hash (T5) | Open, low priority |

**No open High or Critical findings.**

## 5. Owner responsibilities

- Use fine-grained tokens scoped to `debasisr66/studio` only, with the minimum permission (Contents: Read and write). Keep the admin token and the dispatch token separate.
- Never paste a token into chat, a file or a commit. Treat "shown once" literally.
- After using admin on a shared computer, click **Lock & sign out** and close the tab.
- Put a calendar reminder a week before each token expires; follow the rotation runbook in the learning guide.
- Turn on GitHub's failed-workflow notifications so a red CI or health run reaches you.
- If a token may have leaked: revoke it first, then regenerate, then audit commits and runs (runbook).

## 6. Not covered

Penetration testing, dependency audit of GitHub-hosted runners, GitHub account security (2FA, sessions), and the security of the Penny and debasis-web applications themselves.

## 7. v1.4 review log

Scope: self-hosted fonts, logo, profile photo upload and publishing, workflow changes (pinning, keep-alive, health), repository rulesets.

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| S-16 | No request leaves the page for a third party; CSP `style-src` and `font-src` are self-only | Pass | TC-F01, TC-F04 |
| S-17 | Font licences present beside every font; the fonts cover the rupee sign | Pass | TC-V23, TC-V24 |
| S-18 | All actions pinned by commit hash; hashes verified to be the intended release | Pass | TC-W10, TC-W14 |
| S-19 | Workflow permissions: CI and health read-only (health also `actions: read`); write only in sync and keep-alive; CI enforces it | Pass | TC-W11, TC-W12 |
| S-20 | Keep-alive makes only an empty commit, from its own message, with no interpolation into the shell; decision logic tested | Pass | `keepalive.yml`, TC-A01–A09 |
| S-21 | Photo upload accepts only PNG, JPEG and WebP; rejects SVG (including one disguised as PNG), GIF, PDF, corrupt, empty, tiny and oversized files | Pass | TC-P05 |
| S-22 | Photo output is always a fresh JPEG; location and camera metadata do not survive | Pass | TC-P03 |
| S-23 | Photo publish validates the base64 and the JPEG data URL; one file per commit; the manifest path is restricted to `content/*.jpg` so it cannot point the page at another site | Pass | TC-P08, TC-V26 |
| S-24 | CI validates the committed photo and manifest | Pass | TC-V25–V27 |
| S-25 | The logo SVG contains no script, handlers, foreign objects or external references; CI enforces it for every SVG | Pass | TC-V29 |
| S-26 | Zero CSP violations across the photo dialog, preview, publish and the new header | Pass | TC-P12 |
| S-27 | Admin token handling unchanged and still correct: `sessionStorage` only; the idle lock is now unit-tested | Pass | TC-K20–K23 |
| S-28 | The sync workflow differs only by the pinned hash; its permissions, triggers and steps are unchanged | Pass | TC-W14, TC-R19 |
| S-29 | No token-like strings in the repository; tests used only clearly fake tokens | Pass | TC-R21 |
| S-30 | History is protected for everyone (force-push and deletion rejected); the admin screen's direct commit and the bots' commits still work; the CI-required ruleset was found to block the bots and was not kept | **Pass** (with the documented limit) | TC-B01–B07 |
| S-31 | Dependabot's proposals keep commit-hash pins and pass CI; the workflows they change (sync, keep-alive, health) ran green in dry-run mode on their branches | Pass | TC-W16 |

### v1.4 findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| F-4 | Low | Google Fonts requested from Google | **Closed** (self-hosted) |
| F-5 | Low | Actions pinned by tag, not hash | **Closed** (pinned; Dependabot added) |
| F-6 | Medium (process) | CI cannot technically gate the owner's merges or the bots' direct pushes: a required-check ruleset blocks the bots (proved) and the Actions app cannot be exempted on a personal repo. Mitigation: history protected for everyone; CI gating by process; CI-after-the-fact alerts for content commits | Accepted, documented (T13). Possible later design: gate deployment instead of merging |
| F-7 | Low | The profile photo is public and permanent in git history once published (removing it later does not remove the old commit) | Accepted; the preview dialog says it will be public |
| F-8 | Info | The page was unstyled for a short time on the branch because of an editing slip; no visitor impact (never deployed). CI now rejects a stylesheet without its tokens | Closed |
| F-9 | Low | Scheduled workflows start hours late, so a check scheduled "after" another can run before it | Closed (health moved to 12:00 UTC; delays documented) |

**No open High or Critical findings.** F-6 is a documented process limit, not a vulnerability.

## 8. SPEC-TR Phase A review log (2026-10-21)

Scope: strict URL rule (TR-01), cache envelope checks (TR-02), runbook and protection decision record (TR-09, TR-11). Nothing in the page, the CSP, workflows or permissions changed.

| Check | Result |
|-------|--------|
| New attack surface | None: validation only tightens, in CI and in a pure helper; no new request, secret, dependency or permission (`git diff main -- .github` empty) |
| URL rule | Rejects whitespace and control characters anywhere (`new URL()` silently trims or strips them), embedded credentials (also stops a secret being published inside a link), non-http(s) schemes, `https:///x` (host not written out), over-long strings |
| Regex safety | Linear, anchored patterns; no nested quantifiers (no ReDoS) |
| Existing content | Passes the stricter rule with no new error or warning |
| Browser behaviour | `normalizeUrl` (admin composer) unchanged; the new `isPublishableUrl` is additive |
| Residual | CI still cannot technically block the owner or the bots (TR-11 decision record) |

## 9. SPEC-TR Phase B review log (2026-10-21)

Scope: partial sync failure is visible (TR-05) and sync freshness check (TR-06).

| Check | Result |
|-------|--------|
| Workflow permissions | Unchanged: `sync.yml` still `contents: write` (allowed list), `health.yml` still `contents: read` + `actions: read`. The only workflow edit is the commit step condition |
| Read-only toward product repos | Unchanged; sync still only GETs |
| Does "red" skip the safe commit? | No: proven by a drill on a throwaway branch (fetch red, commit step ran, run red). `!cancelled()` skips the commit only on cancellation |
| Prior data safety | Failed products keep their previous entry; all-fail leaves the file untouched (unit-tested) |
| Secret exposure | Summary text uses only product names and API status lines; no headers or tokens are echoed (test checks content) |
| Residual | A successful manual dry run counts as a sync success for the 48 h check (the API does not reveal dry runs). Low impact: the next scheduled run still has to pass |
| Drill hygiene | Throwaway branch only; `main` and its cache untouched; branch deleted |

## 10. SPEC-TR Phase C review log (2026-10-21)

Scope: registry integrity, fixture-proven rules, asset parity, missing-repo and orphan reporting, Fix pointers.

| Check | Result |
|-------|--------|
| New attack surface | None. Health makes up to one extra read-only GET per product that has no release (`/repos/<repo>`); same token, same permissions |
| `scripts/health-check.js` now requires `js/reads-lib.js` | Pure helper, no I/O; same file the page loads |
| Rules can no longer rot silently | 23 enumerated rules each have a failing fixture; a missing fixture fails the suite (proven by removing one) |
| Output safety | Fix pointers are static runbook anchors; product-controlled text appears only in the GitHub step summary and log as plain text |
| Residual | `KNOWN_CATEGORIES` is a soft (warning) list; an unknown category never blocks publishing |

## 11. v2.0 pre-implementation security review (2026-10-21; design-level, nothing built)

Scope: [SPEC-SH](specs/stabilize-core-hub/spec.md), [SPEC-RC](specs/reads-categories/spec.md), [SPEC-PC](specs/podcast-links/spec.md), [SPEC-UX](specs/simple-layout/spec.md). This is the threat analysis done **before** building so controls are designed in; the results column is filled in during the build, never in advance.

### 11.1 New or changed threats

T15 and T16 (visitor usage data and corrupt local data) were dropped on 2026-10-21 when the owner removed the usage-based ordering: Studio stores nothing about visitors and adds no storage key, so those threats no longer exist. Ids are left unused so references stay stable.

| ID | Threat | Spec | Control designed in | Test that must pass | Result |
|----|--------|------|--------------------|---------------------|--------|
| T17 | **Fragment injection via hash routing** (`#reads/<payload>`, `#__proto__`) | RC-03, UX-04 | Fragment matched against closed lists; anything else ignored; never inserted into the DOM | TC-RC-L03, TC-UX-L04 | ⬜ |
| T18 | **Malicious podcast or read link** (`javascript:`, credentials, control characters, tracking) | PC-01, PC-04, RC-06 | Shared strict URL rule (TR-01) on write and in CI; host-keyed platform label from a closed list | TC-PC-V01, U02, D02 | ⬜ |
| T19 | **Error path injection** (a malformed file puts markup in an exception that is shown) | SH-01 | Fixed fallback text; exception goes to the console only | TC-SH-I03 | ✅ |
| T20 | **Schema-version bypass** (unknown version silently accepted, or old data mis-read) | SH-04 | Known versions only in CI; runtime defaults documented; failure is a section fallback | TC-SH-V01–V03 | ✅ (SH Phase A) |
| T21 | **New CI tool risk** (headless Chrome and a local static server on the runner) | SH-02 | Server binds to localhost on a random port for the step only; no secrets in the step; no network egress needed; pinned action versions unchanged | TC-SH-B03, B04; `git diff .github` review | ✅ (SH Phase A) |
| T22 | **Embedded content creep** (iframes or players for podcasts) | PC-02 | No embeds; CSP `default-src 'none'` and the validator keep third-party hosts out; smoke test asserts no iframe/audio | TC-PC-U07 | ✅ (SH Phase B, reads) |
| T23 | **Data loss in migration** | RC-05 | Before/after comparison; additive keys; rollback proof with v1.5 code | TC-RC-M01–M03 | ✅ (RC Phase A, §11.7) |
| T24 | **Retired blog leaves a dangling path** (old link, stale code with an editor) | PC-05 | Redirect; code removed; archive file unrendered and validated | TC-PC-R01–R04 | ⬜ |

### 11.2 Controls that must remain unchanged (checked at each phase)

| Control | Check |
|---------|-------|
| CSP: no inline code, no third-party host, `connect-src` only `self` and `api.github.com` | Validator rule green; diff of the CSP meta empty |
| Admin token: tab-only, idle lock, never persisted or logged | TC-TR-N04-style owner publish; token-store tests unchanged |
| Workflow permissions and pins | `git diff main -- .github` shows only the smoke step; CI rule for pins stays green |
| Sync read-only toward product repos | `sync-products.js` and `sync.yml` not modified in 2.0 |
| No new dependency, secret or permission | Review of the PRs |

### 11.3 Review checklist to complete during the build

- [ ] For each phase: new input paths listed (URL fields, hash, storage, content files) and each has a validator or closed-list control.
- [ ] XSS payloads (`<img onerror>`, `javascript:`, `data:`) in every new field render inert (composer preview, cards, tabs, platform label).
- [ ] Network log shows no new request or host during heavy use.
- [ ] No new storage key or cookie is written (Studio stores nothing about visitors).
- [x] Rollback rehearsed: v1.5 code on migrated data renders correctly (RC Phase A, §11.7).
- [ ] Residual risks written down at the end of §11 with owner acknowledgement.

### 11.4 Residual risks expected (to confirm after build)

A successful smoke test proves rendering in one browser engine only. CI still cannot technically block the owner or the bots (TR-11 decision unchanged).

### 11.5 SH Phase A results (2026-10-21)

| Check | Result |
|-------|--------|
| T19 error-path injection | The fallback is a constant string (`SafeLib.FALLBACK_TEXT`); unit test passes an error containing `<img onerror>` and `TypeError` and none of it appears; smoke asserts no exception text on the page |
| T21 CI tool risk | The smoke server binds to `127.0.0.1` on a random port and exists only for the step; the step has no secrets and needs no network beyond localhost; `ci.yml` permissions unchanged (`contents: read`); no new third-party action; Chrome is the runner's preinstalled browser; the step has a 2-minute cap (29 s observed) |
| CSP / third parties | `index.html` diff is one same-origin script tag; validator OK; no inline code; no new host |
| Token handling | Untouched; smoke injects a clearly fake test token into `sessionStorage` on localhost only to prove admin mode switches on; it is never sent anywhere |
| Behaviour change to review | `boot()` now tolerates JSON `null` files and never skips `enableAdmin()`; failures are logged to the console only (no remote reporting) |
| Residual | One browser engine (Chromium) is tested; a hung content file still delays first render by up to 8 s |
| Independent review (added 2026-10-22) | [reviews/SH-02.md](reviews/SH-02.md): reviewer Claude Opus 5.5, first verdict APPROVE WITH CONDITIONS, after fixes **APPROVE**. The author does not grade this item; see the record for findings, the accepted risk N2 and what was not checked |

### 11.6 SH Phase B results (2026-10-21)

| Check | Result |
|-------|--------|
| T20 schema-version bypass | CI accepts only the known version; a browser refuses to show or edit a newer file and the admin publish skips `reads.json` in that state (so a stale page cannot overwrite a newer file); a missing or older version is tolerated with defaults, never a crash |
| Silent key loss on publish | Found and fixed: the admin built `{books, articles}` by hand; it now uses one tested serializer that always writes the version first |
| Surface | No new network call, host, storage, secret, dependency or permission; `index.html`, CSP and workflows untouched this phase |
| Docs as a control | The contract and the runbook can no longer drift silently: CI fails on a missing file, rule id or broken link in the test suite |
| Residual | The "refuse to publish over a newer file" guard has no stubbed-API test yet (code inspection only) |

### 11.7 RC Phase A results (2026-10-22)

| Check | Result |
|-------|--------|
| T23 data loss in migration | Before/after comparison of every field of the 5 reads and the book is identical apart from the added `category`; the pre-migration file is kept as a test fixture; rollback rehearsed: the `v1.5` tag code renders the migrated file (products, updates, all 5 reads, no console error) |
| New input path | One new field, `category`. Closed list (`CATEGORIES`), validated in CI (`reads-category`, fixture, runbook row, contract entry), defaulted to `other` in the browser; it is not rendered anywhere yet, and is never used as markup or a class |
| Version gate | CI accepts exactly `schema_version` 2; the browser accepts 1 and 2 and still refuses a newer file (unchanged smoke case `TC-SH-V03`). The admin publish writes version 2 through the serializer, which also fills a missing category so the admin cannot publish a file CI rejects (stubbed-API smoke case; also proven to fail when the fill is removed) |
| Surface | No new network call, host, storage key, secret, dependency or permission; `index.html`, CSP, workflows, `changelog.json` untouched |
| Finding | Between the data merge and any rollback, `main` (SH Phase B) alone would show the Reads fallback for a version 2 file, because it only understands version 1. Code and data therefore change in one commit and the rollback target is the `v1.5` tag, not the previous commit |
| Residual | The rollback rehearsal was run by hand (a scratch export of the tag), not in CI |

### 11.8 PC Phase A results (2026-10-22)

| Check | Result |
|-------|--------|
| New input path | One new content file, `podcasts.json`, validated in CI with the shared strict URL rule (clean http(s), no credentials or control characters, at most 2048 characters) and the Reads limits; eight rules, each with a failing fixture. It is not fetched or rendered by the page yet, so no visitor-facing surface changed |
| Platform label (T-class: untrusted text in a label) | `platformOf` is a closed host list matched on the exact host or a true subdomain; look-alikes (`evilspotify.com`, `spotify.com.evil.io`) get their plain domain, and unusable input gives an empty label. The result is text only; the page will escape it in Phase B |
| Version gate | CI accepts exactly `schema_version` 1; the browser helper refuses only a newer version (same pattern as Reads) |
| Surface | No new network call, host, storage key, secret, dependency or permission; `index.html`, `app.js`, CSS, CSP, workflows and `changelog.json` untouched |
| Residual | The admin cannot yet publish this file (Phase B), so the composer-side checks (T22 embeds, publish over a newer file) are still open for that phase |

### 11.9 RC Phase B results (2026-10-22)

| Check | Result |
|-------|--------|
| New input path: the URL fragment | `#reads/<slug>` is compared for exact equality with the slugs of the closed list; anything else (`xyz`, `__proto__`, `constructor`, encoded bytes, 5000 characters, markup) selects the default section and never reaches a selector or the DOM; unit and smoke cases cover each |
| New input path: the Section field | Radio group built from `CATEGORIES`; the value is validated against the list on submit (`requireCategory`); the book editor's select is built the same way; the stored value is the closed-list string, never user text |
| XSS (T-class) | Payloads in title, comment and tags (`<img onerror>`, `<script>`, `"><svg onload>`) stay inert in the preview, the list and the tab list (smoke E04: no handler ran, no element created, text shown literally). Tab labels, slugs, ids and counts are escaped or numeric |
| State and storage | No new storage key or cookie; the remembered section lives only in memory for the session; `history.replaceState` changes the fragment only |
| Surface | No new network call, host, secret, dependency or permission; CSP and workflows untouched; `changelog.json` untouched |
| Residual | The mobile nav highlight and the single-column books layout are UI work in later phases; keyboard and contrast pass for the whole page is SPEC-UX Phase B |

### 11.10 PC Phase B (2026-10-23)

Author's notes only; the verdict belongs to the independent reviewer.

| Item | Note |
|------|------|
| Independent review | [reviews/PC-B.md](reviews/PC-B.md): reviewer Claude Opus 5.5; see the record for the verdict, the findings (three medium: a failed load could be published over, a concurrent or stale publish could lose newer content, an edit index could go stale after a delete; two low) and what was not checked |
| New input paths | The podcast composer (link, title, show, take, tags; validated by `RL.validatePodcastEntry`, the same limits and strict link rule as CI), the `#blog` fragment (anchored regex, constant target) and `podcasts.json` as a rendered file (escaped in every context; newer version or failed load shows the fallback line) |
| Publish path | One file per commit through the existing flow; now also refuses when GitHub's copy differs from the one this page loaded (conservative: wait, reload, retry) and runs the CI rules on the whole file first |
| Surface | No new network host, storage key, cookie, secret, dependency or permission; nothing embedded; CSP and workflows unchanged; `changelog.json` untouched |
| Residual | Reads has the older whole-file validation gap (its entries are only JSON round-tripped before publish); the Reads composer still offers the Podcast format until Phase C |

### 11.11 SPEC-QA Quick add: pre-implementation review (2026-10-23; design-level, nothing built)

Author's pre-review. The independent reviewer's verdict for Phase A (gate G4) is [reviews/QA-A.md](reviews/QA-A.md). Phase B (gate G5, prefill by link, T26) was dropped on 2026-10-23 and never merged, so **no `#add=` handling exists on `main`**: T26 does not apply and T25 covers only the pasted text; this table was the threat list the reviewer was briefed with.

| # | Threat | Req | Control | Test | Status |
|---|--------|-----|---------|------|--------|
| T25 | **Injection through pasted text or the `#add=` fragment** (markup, `javascript:`, `data:`, credentials in a link, oversized values) | QA-02, QA-09 | Every value ends in `normalizeUrl`, `validateEntry` or `validatePodcastEntry`; output escaped everywhere; oversize and malformed inputs ignored with a message | TC-QA-P04, P05, F03, F05, S01 | ⬜ |
| T26 | **A crafted `#add=` link posts or misleads** | QA-09 | Prefill only; a banner says so; never submits; the owner must press Post and give the token; fragment cleared after reading | TC-QA-F01, F04 | ⬜ |
| T27 | **Silent clipboard read** | QA-02 | Read only inside the tap handler of Paste from clipboard; never on load or open; content used only as a link candidate; never logged or sent | TC-QA-P07 | ⬜ |
| T28 | **The draft key becomes a second place a secret or visitor data lives** | QA-07 | One owner-only `sessionStorage` key; link, title, take, tags and kind only; never the token; absent for visitors; cleared on success and Cancel | TC-QA-D02, D03, D04 | ⬜ |
| T29 | **Token exposure while moving to just-in-time unlock** | QA-04 | Token still only in the tab's `sessionStorage`; never in DOM text, console or the draft; prompt cancel and failure paths write nothing | TC-QA-U03, U04, U06 | ⬜ |
| T30 | **Admin left open, or locked while publishing** | QA-06 | Lock on success only; failure keeps the session and the draft; idle lock (30 min) and manual lock unchanged | TC-QA-L03, L04, L05 | ⬜ |
| T31 | **A visitor reaches the sheet** (`#add`) | QA-01 | The sheet holds no data and writes nothing; Post asks for a token; no API call is made without one | TC-QA-E03, S02, U07 | ⬜ |
| T32 | **Autofill change causes the token to be offered for saving in the wrong place** | QA-04 | A real login form (`autocomplete="current-password"` plus a labelled username field `studio-admin`), scoped to this origin; saving to the owner's password manager (Chrome's, or the iPhone Passwords app) is the owner's choice and is the intended place; the site stores nothing new | TC-QA-U05, O01 | ⬜ |
| T33 | **The new path bypasses the SPEC-PC publish guards** | QA-05 | Quick add calls the same publish function (unloaded or changed content refused, whole-file validation, skip identical) | TC-QA-L06 | ⬜ |
| T34 | **Stored or derived token (PIN, passkey) added later "for convenience"** | n/a | Rejected in the spec (D1, D2); a change of that kind needs a new spec and review | n/a | Decided |

**Controls that must remain unchanged (checked at each phase):** token only in tab `sessionStorage`; 30-minute idle lock; CSP strict with no new host; no cookie; the content contract and validators; the PC-B publish guards; escaping in every context; `git diff main -- .github content` empty.

**Review checklist to complete during the build**
- [ ] New input paths listed (paste, share text, `#add`, `#add=`, draft key, token form) and each has a validator or closed control.
- [ ] XSS payloads in every new field render inert (sheet, preview, published card).
- [ ] Network log: no new host; no API call before a token is given.
- [ ] Storage: exactly the admin token key (when unlocked) and the draft key (when used); neither exists for a visitor.
- [ ] Auto-lock proven for the success path and absent on failure; token gone from storage afterwards.
- [ ] Independent review (G4 after Phase A, G5 after Phase B) done; verdict linked; owner acknowledged.
- [ ] Owner device checks O01-O06 recorded.

**Residual risks expected (to confirm after the build):** Face ID autofill may not work on the owner's phone (convenience only); a discarded tab can still lose a draft; a model review is not a human audit.

### 11.12 SPEC-QA Phase A: author's notes (2026-10-23; the verdict is the reviewer's, not the author's)

These are the author's notes only. The independent review is [reviews/QA-A.md](reviews/QA-A.md); this section says nothing about pass or fail.

| Threat | What was built | Evidence |
|--------|----------------|----------|
| T25 injection | `extractLink` accepts only explicit http(s) links and runs them through `normalizeUrl`; titles are text; values reach the DOM through `textContent` or `esc` | unit P04/P05, smoke P04, S01 |
| T27 clipboard | one `readText` call, inside the Paste click handler; a hand paste uses the event's own data | unit P07, smoke P07 |
| T28 draft key | `studio-quick-draft`, five text fields (`RL.serializeDraft`), tab `sessionStorage`; cleared by Cancel, Escape and success. **Deviation from the wording of QA-07 and T28:** the page cannot tell the owner from a visitor before the token is given, so anyone who types in the sheet gets the key in their own tab (their own text, nothing sent, cleared by Cancel). A visitor who never uses the sheet has none | smoke D01-D04, unit D01-D03 |
| T29 token | unchanged store; prompt is a separate form, field cleared on close; stale check results after Cancel are ignored (review finding F2, fixed) | smoke U02-U08 |
| T30 lock | `lock(true)` after every successful publish (sheet and Publish changes); failure keeps the session, the sheet and the draft | smoke L03-L05, L11 |
| T31 visitor | no API call before a token; token must belong to the owner login | smoke S02, U07, U03 |
| T32 autofill | real form, readonly `studio-admin` username, `current-password`, no `autocomplete="off"`; sandbox uses `studio-admin-sandbox`. Unknown until O01: whether Chrome saves and fills it | unit U05, smoke U05 |
| T33 guards | one function, `publishContent`, used by Publish changes and Quick add; `publishFile` also refuses when the page has not finished loading the file (review finding F1, fixed) | smoke L06, L09 |

Other changes to review: publish requests now time out after 20 s where `AbortSignal.timeout` exists (F6); the whole file is written, so pending inline changes to the same file go public with a Quick add and the sheet warns first (F3); `reads-lib.js` budget 20 to 26 KB. Known and accepted: the sandbox and the real site share the origin `debasisr66.github.io`, so in one tab the token key and the draft key are shared between `/studio` and `/studio-sandbox` (F11); a model review is not a human audit; Face ID autofill may not work (convenience only).

### 11.13 SPEC-UX Phase A: author's notes (2026-10-23; the verdict is the reviewer's, not the author's)

These are the author's notes only. The independent review is [reviews/UX-04.md](reviews/UX-04.md); this section says nothing about pass or fail. Independent review: [reviews/UX-04.md](reviews/UX-04.md), verdict APPROVE WITH CONDITIONS.

| Item | What was built | Evidence |
|------|----------------|----------|
| New input path | the URL fragment already reached the router (`#reads/…`, `#blog`, `#add`). Phase A adds one use: after boot, `SECTIONS.find(x => location.hash === '#' + x[0])` then `scrollIntoView` on that element. The match is exact equality against four literals, so the fragment is never a selector, an id lookup or markup | unit L04 (no line mixes `location.hash` with `innerHTML`, no fragment used as a selector), smoke L04 (eight hostile fragments), L01 to L03 |
| Navs | built by `innerHTML` from the constant `SECTIONS` only (no content file, no fragment) | unit N02, smoke N01 |
| Visitor invariant | no new storage key, cookie, request or host; the in-view observer still only sets `aria-current` | unit (key set), smoke privacy case |
| CSP and workflows | `index.html` CSP meta unchanged; no inline script or style; `.github` untouched | validator, unit |
| Layout | one column in Reads; Books block hidden by a class when the open sub-item has none (owner still sees it, so `+ Add book` is reachable) | smoke P04, P02 |

Not covered by the author: Safari and real-device behaviour of `scrollIntoView` and smooth scrolling; a human audit. A model review is not a penetration test.

### 11.14 SPEC-UX Phase B: author's notes (2026-10-26; the verdict is the reviewer's, not the author's)

These are the author's notes only. The independent review is [reviews/UX-05.md](reviews/UX-05.md); this section says nothing about pass or fail.

| Item | What was built | Evidence |
|------|----------------|----------|
| Visitor invariant | CSS only in the page (sizes, spacing); no new storage key, cookie, request, host or script; CSP unchanged | unit privacy case, smoke privacy case from Phase A |
| Test harness | `scripts/smoke.js` gained `ctx.tab` (real Tab key events to the local headless Chrome) and a per-case `height`; still local only, no new network use | smoke |
| Motion | the reduced-motion block is unchanged and now has a unit test; no scripted smooth scrolling | unit A04 |

Not covered by the author: a human accessibility audit, real devices, assistive technology.
