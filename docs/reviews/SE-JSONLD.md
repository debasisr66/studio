# Review: SE-JSONLD SEO data block (JSON-LD) exception to "no inline script"

Process: [REVIEW-GATE.md](../REVIEW-GATE.md). Reason for the gate: the change relaxes a security rule (CI used to reject any inline `<script>` in `index.html`). The reviewer was given the files, the requirement and a threat list, not the author's conclusions. Author's notes: [security.md](../security.md) §11.15.

| Item | Value |
|------|-------|
| Scope | `index.html` (JSON-LD block, `<noscript>` placement, placeholder meta removed), `scripts/validate-site.js` (`scanScripts`, `checkJsonLd`, noscript and placeholder checks in `validateIndex`), `tests/seo-jsonld.test.js`, one assertion in `tests/spec-qa-phase-a.test.js` (TC-QA-S03) |
| Author model | Claude Opus 5.5 |
| Reviewer model | Claude Sonnet 5.5 (separate agent, fresh context, read-only) |
| Reviewed commit | 0474589 (first review); fixes re-checked at e37c875 |
| Reviewer verdict | APPROVE |
| Owner acknowledgement | 2026-11-20: the owner instructed the merge in chat ("merge PR #56"); a separate confirmation that the checkpoint below was read was not given |

First verdict (0474589), copied verbatim: `VERDICT: APPROVE WITH CONDITIONS` ("fix F1 and F2 … before merge. F3 to F5 can follow"). Re-check verdict (e37c875), copied verbatim: `VERDICT: APPROVE`.

## Findings

| # | Severity | Where | Scenario (reviewer, shortened) | Fix | Status |
|---|----------|-------|-------------------------------|-----|--------|
| F1 | Medium | `checkJsonLd`, "has src" test | `src=` matched anywhere in the tag, so `<script data-src="x">alert(1)</script>` passed CI as if external (the old rule had the same gap; the CSP still blocked it at runtime) | Attribute tokenizer (`scanScripts`); test JL12 | Fixed in e37c875; re-check: closed |
| F2 | Medium | `checkJsonLd`, type detection | The first `type=` text was used even inside another attribute's value: `data-x="type=application/ld+json" type="module"` with a JSON body would pass | Real attribute parse; the JSON-LD tag may carry only `type`; test JL13 | Fixed in e37c875; re-check: closed |
| F3 | Low | tag scan | `<script/type=…>` handled differently from the HTML tokenizer (not a bypass) | Same tokenizer; JL13 | Fixed in e37c875; re-check: closed |
| F4 | Low | placeholder check | Only a trailing bare `...` was caught; `<meta ... name="x">`, `content="..."`, `href=...` passed | Wider pattern; test JL14 | Fixed in e37c875; re-check: closed |
| F5 | Low | noscript check | A `<body` inside a comment or JSON-LD string could hide a `<noscript>` placed before the body | Strip comments and script bodies; test JL15 | Fixed in e37c875; re-check: closed |
| F5b | Low | noscript check | A `<body` inside an attribute value (`<meta content="<body >">`) could still hide it | Strip quoted attribute values (quote-aware); test JL16, which failed first | Fixed afterwards, not re-checked |
| F6 | Info | JSON-LD content | Only top-level `url` and `sameAs` are checked; `worksFor.url` may be a home page by design | none | Accepted (as specified) |
| F7 | Info | TC-QA-S03 | Its own inline-script regex had the F1 blind spot | Uses `scanScripts` now | Fixed in e37c875 |
| T1 | Info | test run | TC-SH-D02 failed in the working tree because this record did not exist yet | This file | Fixed (this file) |

## Checked and found sound (reviewer)

- `application/ld+json` is not executed by browsers; the CSP (`script-src 'self'`, no `unsafe-inline`) is unchanged and TC-QA-S03 still compares the whole policy string.
- Plain and crafted bypasses fail: no type, `text/javascript`, `module`, lookalike types, extra or glued attributes, repeated `src` or `type`, unclosed tags or quotes, a second inline script, a script inside a comment (fails closed).
- The JSON-LD content rules (one block, ≤ 4 KB, no `</` or `<!--`, clean non-home-page profile links) hold, and the real `index.html` passes them.
- All six placeholder shapes tried are flagged without false positives on ordinary text.

## Not checked (reviewer)

- Behaviour in real browsers and search-engine crawlers (rich results).
- Mutation runs of JL12-JL15 against the old code (the author showed them failing first).
- Edge cases where the tokenizer and a full HTML parser differ that cannot pass a block (`</` is rejected inside it).

## Human checkpoint (owner)

Before merge, per [REVIEW-GATE.md](../REVIEW-GATE.md): read the Findings table above, confirm the `index.html` diff adds no new `<script src>`, `<link>` or host and that the CSP meta tag is unchanged, then fill **Owner acknowledgement**.
