# Spec: Search visibility (sitemap)

| | |
|---|---|
| Spec ID | `SPEC-SE` (requirements `SE-01` … `SE-03`) |
| Status | **Shipped 2026-11-20 (PR #58, merge 0531bf5; live `/studio/sitemap.xml` 200 `application/xml`)** |
| Owner | Debasis Ray |
| Created | 2026-11-20 |
| Parent | [PRD](../../PRD.md); follows the JSON-LD exception ([security log §11.15](../../security.md), [review SE-JSONLD](../../reviews/SE-JSONLD.md)) |
| Target | `main` (no release tag needed: no visible change) |

## 1. Summary

Google does not list Studio yet. A check on 2026-11-20 found nothing blocks it: the page returns 200, there is no `noindex` tag or header, and Search Console ownership is verified. GitHub's `robots.txt` does not apply, because `github.io` is a separate host. What is missing is a **sitemap**: `https://debasisr66.github.io/studio/sitemap.xml` returned 404. The owner has requested indexing in Search Console. This spec adds one small sitemap the owner can submit there, and a CI check that keeps it correct.

## 2. Evidence (2026-11-20)

| Check | Result |
|-------|--------|
| `GET /studio/` | 200, no `X-Robots-Tag`, no `<meta name="robots">` |
| `GET /studio/sitemap.xml` | 404 |
| `GET /studio/google240bab6eaaebfd63.html` | 200 (Search Console ownership) |
| `GET debasisr66.github.io/robots.txt` | 404: the host root belongs to a different repo (`debasisr66.github.io`), so a `robots.txt` in this repo would be ignored |
| Inbound links | The `studio` repo homepage field only; the GitHub profile "Website" field is empty |

## 3. Decisions (author's recommendations; the owner asked for the PR on 2026-11-20)

| # | Question | Choice | Why |
|---|----------|--------|-----|
| D1 | Which URLs | One: `https://debasisr66.github.io/studio/` | Studio is one page; sections are `#` fragments, which search engines do not index separately. Penny and the other products live in their own repos |
| D2 | `<lastmod>` | Left out | A date that does not move with real changes is ignored by Google and becomes a stale claim; updating it by hand is overhead |
| D3 | `<changefreq>`, `<priority>` | Left out | Google ignores both |
| D4 | `robots.txt` | Not added | Only read at the host root, which this repo does not serve (§2) |
| D5 | `<link rel="canonical">` | Backlog, not built | Useful only if duplicate addresses appear; none do today |

## 4. Requirements

**SE-01 (P0): The sitemap.** `sitemap.xml` at the repo root (served at `/studio/sitemap.xml`): an XML declaration, a `<urlset>` in the `http://www.sitemaps.org/schemas/sitemap/0.9` namespace, and one `<url><loc>` per page. Acceptance: Search Console reads it as "Success" after the owner submits it.

**SE-02 (P0): CI keeps it correct.** The validator rejects a sitemap that is missing; is not a `urlset` in the sitemap namespace; has no `<loc>`; has a `<loc>` that is not an `https` address under `https://debasisr66.github.io/studio/`, or holds a `#`, a query, spaces or a duplicate; contains `<!DOCTYPE` or `<!ENTITY`; or does not list the JSON-LD `url` from `index.html`. Each message has a RUNBOOK row.

**SE-03 (P1): The owner's steps are written down.** The RUNBOOK says how to submit the sitemap and how to check indexing (`site:` search, URL Inspection).

## 5. Freeze list

`index.html`, `js/`, `css/`, `content/`, `.github/workflows/`, the CSP: unchanged. No new dependency, secret, workflow or network path.

## 6. Security

Not a gated phase ([REVIEW-GATE](../../REVIEW-GATE.md)): a static file with no script, no token, no rendering by the page and nothing about visitors. It publishes only the address that is already public. The `DOCTYPE`/`ENTITY` ban keeps the file a plain list. Author's notes: [security log §11.16](../../security.md).

## 7. Traceability

| Requirement | Test cases | Files |
|-------------|-----------|-------|
| SE-01 | TC-SE-M01, TC-SE-M09 | `sitemap.xml` |
| SE-02 | TC-SE-M02 … TC-SE-M08 | `scripts/validate-site.js` (`checkSitemap`), `tests/seo-sitemap.test.js`, `docs/RUNBOOK.md` |
| SE-03 | TC-SE-D01 | `docs/RUNBOOK.md` |

## 8. Status log

| Date | Status | Note |
|------|--------|------|
| 2026-11-20 | In progress | The owner requested indexing in Search Console and asked for the sitemap PR |
| 2026-11-20 | Shipped | PR #58 merged at the tested commit; CI, Pages and Health green; the live file matches `main`. Open: the owner submits `sitemap.xml` in Search Console (SE-01 acceptance) |
