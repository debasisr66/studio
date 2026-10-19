# Impact Analysis — Studio v1.1

Date: 2026-10-19 · Branch: `v1.1` · Rollback tag: `v1.0`

## 1. Change summary

| # | Change | Type |
|---|--------|------|
| C1 | Branding: "Studio by Debasis Ray — learning never ends!" (title, header, hero, footer, meta) | UI text |
| C2 | HCI / accessibility pass (focus, labels, dialog behavior, contrast, touch targets, reduced motion, skeletons) | UI |
| C3 | Reads: LinkedIn-style composer, edit, tag filter, search, share (LinkedIn, copy link, native share) | Feature |
| C4 | Security: Content-Security-Policy, `noopener noreferrer`, tag/URL sanitising, 30-minute admin idle lock | Hardening |
| C5 | Inline script moved from `index.html` to `js/app.js` (needed so CSP can forbid inline scripts) | Refactor |
| C6 | Defect fixes found during testing: horizontal overflow on phones from long URLs in release notes; raw `[text](url)` Markdown in release notes; very long release notes collapsed | Fix |

## 2. What is touched and what is not

| Component | Touched? | Notes |
|-----------|----------|-------|
| `index.html` | Yes | Markup and CSS; script extracted |
| `js/app.js` | New | Former inline script, plus new features |
| `js/reads-lib.js` | New | Pure helpers, no DOM access |
| `tests/reads-lib.test.js` | New | 16 Node tests, no dependencies |
| `content/reads.json` | **Schema extended, file unchanged** | Additive optional fields only |
| `content/blog.json`, `products.json`, `cache.json` | No | `git diff main` is empty for these |
| `.github/workflows/sync.yml`, `scripts/sync-products.js` | No | Verified by diff and a dry run |
| `docs/notify-studio.yml` | No | |
| PennyExpenseManager repo and its workflow | No | No commits, no secrets changed |
| debasis-web repo | No | Read-only, as before |
| Tokens and secrets | No | `STUDIO_DISPATCH_TOKEN` unchanged; no new tokens |
| GitHub Pages config | No | Still `main`, root |

## 3. Data compatibility

`content/reads.json` articles keep their original shape `{title, url, note}`. New optional fields: `id`, `added`, `kind`, `tags[]`, `comment`.

- Old entries render unchanged: `comment` falls back to `note` (`entryView` in `js/reads-lib.js`).
- Editing an old entry writes `comment` and removes `note`. Unedited entries are never rewritten.
- `books` is untouched. `blog.json` is untouched.
- Rolling back to `v1.0` against a v1.1-written `reads.json` is safe: v1.0 ignores unknown fields and shows `title`/`url`/`note` (new entries have no `note`, so they would show title only).

## 4. Blast radius

- **Public site:** nothing changes until `v1.1` is merged to `main`. Pages deploys from `main` only.
- **Other apps:** Penny and debasis-web are separate repositories and sites. They share nothing with Studio at runtime. The only link is the one-way notify workflow, which is unchanged.
- **Sync pipeline:** unchanged. It writes only `content/cache.json`; the site reads it the same way.
- **Admin publishing:** the publish routine (`publishFile`) is carried over unchanged. It still writes one file per commit, after a SHA read and JSON validation.

## 5. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|-----------|--------|
| R1 | CSP blocks something needed (fonts, GitHub API) | Medium | High (broken page) | CSP allows only Google Fonts and `api.github.com`; page loaded with zero violations in the browser pane | Mitigated; recheck after deploy |
| R2 | Script extraction breaks load order | Low | High | `reads-lib.js` loads before `app.js`; verified loads and runs | Mitigated |
| R3 | New fields confuse old readers | Low | Low | Additive schema; legacy rendering tested | Mitigated |
| R4 | Stored XSS via title, comment, tags or URL | Medium | High | All output escaped; URL scheme allowlist; CSP forbids inline script; payload tests pass | Mitigated |
| R5 | Admin token exposure | Low | High | Unchanged storage (`localStorage` only), new 30-minute idle lock, no token in DOM or logs | Mitigated; residual risk is browser storage |
| R6 | Third-party leakage of reading habits | Low | Medium | No metadata service, no third-party favicons; LinkedIn is contacted only when the visitor clicks Share | Mitigated by design |
| R7 | Layout regressions on small screens | Medium | Medium | Checked at 375, 768 and desktop; an existing overflow defect was found and fixed | Mitigated |
| R8 | Merge conflict with the nightly sync bot | Medium | Low | `git pull --rebase` before push; the bot only touches `cache.json` | Accepted |
| R9 | Admin publish path not exercised end to end | Medium | Medium | The code path is unchanged from v1.0; needs one real publish with the owner's token after deploy | **Open** (see `test.md` TC-M01) |
| R10 | Google Fonts remains a third-party request | Low | Low | Existing behavior; no new third parties added | Accepted |

## 6. Rollback

```bash
git revert <merge-commit>          # preferred: keeps history
# or return the site to the pre-change state from the tag:
git checkout v1.0 -- index.html && rm -rf js && git commit -m "Roll back to v1.0 UI" && git push
```

No data migration exists, so there is nothing to undo in `content/`.
