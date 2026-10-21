# Security — Studio

Threat model, control inventory and review log. Living document: updated every release. Last review: **v1.4, 2026-10-20** .

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
