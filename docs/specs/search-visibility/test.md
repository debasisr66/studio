# Tests: Search visibility (`SPEC-SE`)

Unit tests: `tests/seo-sitemap.test.js` (run by CI with `node --test tests/*.test.js`). The real file is also checked by `node scripts/validate-site.js`.

| ID | Requirement | Case | Expected |
|----|-------------|------|----------|
| TC-SE-M01 | SE-01 | A valid one-URL sitemap that lists the JSON-LD `url` | No errors |
| TC-SE-M02 | SE-02 | The file is missing (`null`) | Error: missing |
| TC-SE-M03 | SE-02 | No `<urlset>`, or the wrong namespace, or no XML declaration | Error |
| TC-SE-M04 | SE-02 | No `<loc>` | Error |
| TC-SE-M05 | SE-02 | `<loc>` is `http`, another host, another path, holds `#`, `?` or a space | Error naming the address |
| TC-SE-M06 | SE-02 | The same `<loc>` twice | Error: duplicate |
| TC-SE-M07 | SE-02 | `<!DOCTYPE` or `<!ENTITY` present | Error |
| TC-SE-M08 | SE-02 | The JSON-LD `url` is not listed | Error naming it |
| TC-SE-M09 | SE-01 | The real `sitemap.xml` with the real `index.html` | No errors |
| TC-SE-D01 | SE-03 | The RUNBOOK names `sitemap.xml` and every new validator message | Present |

Exit criteria: all cases pass, the validator reports 0 errors, the smoke test is unchanged, CI is green. After merge: `/studio/sitemap.xml` returns 200 with `Content-Type` XML; the owner submits it and Search Console shows "Success".
