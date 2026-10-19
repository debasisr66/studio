# Security — Studio

Threat model, control inventory and review log. Living document: updated every release. Last review: **v1.3, 2026-10-19**.

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
| T5 | **Supply chain** | No package manager and no build step; first-party actions only (`actions/checkout@v4`, `actions/setup-node@v4`) | Repository contents | Low: action versions are pinned by tag, not by commit hash |
| T6 | **Clickjacking** (the page framed by another site) | None possible in-page: GitHub Pages does not let you send `frame-ancestors` or `X-Frame-Options`, and a meta CSP ignores `frame-ancestors` | Documented limitation | Low: admin controls need a present token; acceptable now, fixable with a CDN adding headers |
| T7 | **Third-party content** (Google Fonts) | CSP allows only the two Google font hosts; no analytics, trackers or other third parties; no metadata or favicon services | CSP meta tag; network listing | Low: stylesheet integrity is not pinned and font requests tell Google a visitor loaded the page. Fix: self-host fonts |
| T8 | **Outbound link abuse** (tab-napping, referrer leakage) | Every external link has `rel="noopener noreferrer"` | TC-A05 | Low |
| T9 | **Share-link injection** | Only normalised http(s) URLs are shared; `encodeURIComponent` on the LinkedIn URL | TC-U12, TC-B09 | Low |
| T10 | **Workflow abuse** | CI and health: `permissions: contents: read`, no secrets; sync: `contents: write` on this repo only; product repos are only ever read | Workflow files | Low |
| T11 | **Availability** | GitHub Pages; daily health check; sync failure isolation | Health runs | Medium: no SLA; scheduled workflows stop after 60 days of repository inactivity (see impact.md V5) |

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
