# Review: PC-B Podcasts section, composer and Blog retirement

Process: [REVIEW-GATE.md](../REVIEW-GATE.md). Requirements: [SPEC-PC](../specs/podcast-links/spec.md) PC-02, PC-03, PC-05 (Phase B). This phase was in the gate's "recommended" list, not the gated list; the author ran the review anyway because it adds a publish path and rendered input. The reviewer's report is kept apart from the author's security log; the author did not edit the verdict.

| Item | Value |
|------|-------|
| Scope | `js/app.js` (podcast card, renderPodcasts, composer, edit and delete handlers, publish list, `#blog` redirect, boot), `js/reads-lib.js` (validatePodcastEntry, serializePodcasts, filterPodcasts, podcastTags, redirectHash, platformOf, podcastView), `index.html`, `scripts/health-check.js`, fixtures and smoke cases. Out of scope: CSS, workflows, older code Phase B did not change |
| Author model | Claude Sonnet 5.5 |
| Reviewer model | Claude Opus 5.5 (separate agent, fresh context, read-only) |
| Reviewed commit | e2fae8d (main) plus the uncommitted Phase B working tree |
| Reviewer verdict | APPROVE |
| Owner acknowledgement | pending |

Verdict of the first review (the line the reviewer ended with): `VERDICT: APPROVE WITH CONDITIONS. Findings 1 to 3 should be fixed, or accepted in writing, before merge, because a load failure, a concurrent publish or an edit-then-delete can silently overwrite the owner's published podcasts.` The re-review (same reviewer, after the fixes) ended `VERDICT: APPROVE. All five findings are fixed and my attacks found no way to lose or overwrite data; the three new low findings are minor follow-ups.` That is the verdict in the table above; see "Re-review".

## Findings

| # | Severity | Where | Scenario (reviewer's words, shortened) | Fix | Status |
|---|----------|-------|----------------------------------------|-----|--------|
| 1 | Medium | `app.js` boot, composer, publish | If `podcasts.json` times out, returns 5xx or is malformed, `state.podcasts` stays empty and is not flagged; visitors see "No podcasts yet", and the owner's next publish PUTs a one-entry list over every existing podcast. Reads has the same older pattern | Flag any failure other than 404 (and bare values); fallback line, composer refuses, publish skips the file. Reads: publish blocked, visitor display unchanged | Fixed (TC-PC-A08). Re-review: fixed |
| 2 | Medium | `publishFile` | The "refuse to publish over a newer file" guard only used the copy loaded at boot: another device publishing new entries or `schema_version: 2` was silently lost when this tab published | Keep the content as loaded or last written; refuse if GitHub's current content differs, is not JSON, or the file was absent at boot | Fixed (TC-PC-A09). Re-review: fixed, verified against a copy of `publishFile` with a fake GitHub API |
| 3 | Medium | `app.js` edit and delete handlers | Edit entry *i*, delete an earlier entry with the form open, Save: it overwrites whatever now sits at *i* (or writes past the end). Same in the Reads composer. TC-PC-A04 did not combine edit and delete | Keep the entry object, look its position up on submit, refuse with a message if it was deleted | Fixed for both composers (TC-PC-A10, three cases). Re-review: fixed |
| 4 | Low | `publishFile` | "Validate" was only a JSON round trip, so entries CI rejects (a `null` entry, bad dates, non-string tags) were republished unchanged and failed CI after the commit | Run the CI rules on the serialized file before the PUT | Fixed for podcasts: `RL.validatePodcastsFile`, shared with CI (TC-PC-A11 and a parity test over every rule fixture). Not done for reads (older code) |
| 5 | Low | `reads-lib.js` | Tags named `__proto__`, `constructor`, `toString` disappear from or corrupt the chip list (counting in a plain object). Not exploitable | Count with `Object.create(null)` | Fixed for podcasts and Reads (unit test) |
| 6 | Info | docs | `TC-SH-D02` failed because docs linked to this record before it existed | Write the record | Fixed by this file |

## Checked and found sound (reviewer)

- Escaping: every podcast field reaches the DOM through `esc` in text and attribute context (card, preview, chips, `data-ptag`, `data-pfilter`, `aria-label`); status messages use `textContent`; no stored value is used in a selector (read; smoke TC-PC-A07 passed).
- Link schemes: `javascript:`, `JAVASCRIPT:`, `vbscript:`, `data:`, `//host`, a newline inside the scheme and any userinfo all normalise to null; `"><svg>` in a path is percent-encoded (ran).
- Rendered hrefs come only from `RL.normalizeUrl`; the LinkedIn link uses `encodeURIComponent`; the composer and CI agree on links for every probed input (ran).
- Platform label: closed host list, exact or subdomain match, else the plain host; look-alikes (`open.spotify.com.evil.io`, punycode) show the real host (ran).
- `rel="noopener noreferrer"` on all three external anchors (read; smoke U03).
- `#blog` redirect: anchored regex, `location.replace` cannot loop, nothing from the fragment reaches the DOM, the target is a constant (read; smoke R01).
- Visitors: submit checks `body.admin`, tools and composer hidden by CSS; with no token an API call carries no credential. The new code never reads, stores or logs the token.
- Limits: title 140, show 80, comment 280, tags 5 of 24, `schema_version` first; code-unit counting matches CI (ran).
- Sort and filter: cards use the original index, so edit, copy and share hit the right entry after sorting and filtering (read).
- Privacy and CSP: no iframe, audio, video or image, no cookie or storage key (smoke U07); CSP unchanged.
- Blog removal: no blog code or `blog.json` fetch left in `js/`; the health check still requests `blog.json` as the spec requires.
- Ran the validator (0 errors) and the smoke run (60 of 60 at that time).

## Not checked (reviewer)

The CSS changes and whether `.tools` stays hidden on narrow layouts; the GitHub Actions workflow (does a failing validator block the Pages deploy); `navigator.share` on real mobile browsers; the spec text beyond the PC-02, PC-03 and PC-05 lines; older code Phase B did not change.

## Author's notes (not part of the verdict)

- Findings 1 and 2 also describe the Reads publish path, which predates this phase. The fixes were applied to both files; the visitor behaviour of Reads is unchanged.
- The new guard is deliberately conservative: if GitHub Pages has not caught up after the owner's own earlier publish, or another device published, the owner is told to wait a minute, reload and try again, and nothing is written.
- Evidence for the fixes: 2 new unit tests (parity with CI for every rule fixture; prototype-named tags) and 6 new smoke cases (A08 to A11), all failed before the fixes; after them 233 unit tests (one fails only on the missing link to this record, now fixed) and 66 of 66 smoke cases pass.

## Re-review

Requested from the same reviewer after the fixes (2026-10-23). Verdict: **APPROVE**. The reviewer copied the real `publishFile` into a script with a fake GitHub API and ran six cases: remote differing only in whitespace (write allowed); a second publish in the same session (allowed, snapshot updated); same content with a different key order (refused: safe but a needless refusal); missing at boot and still missing (allowed); missing at boot but present now (refused); remote not valid JSON (refused). It also re-read each fix, ran the unit tests (234), the validator and the 66 smoke cases (all passing at that time), and tried to find a way to lose or overwrite data and did not.

| # | Severity | Where | Finding | Status |
|---|----------|-------|---------|--------|
| R1 | Low | `app.js` boot | "Not found" was detected by matching ` 404` at the end of the error text; an older Chrome words a JSON parse error as "...at position 404", which would show a broken file as empty (it still could not be published over) | Fixed after the verdict: `SafeLib.fetchJson` attaches `err.status` and boot tests `status === 404` (unit test with exactly that message). Not re-checked by the reviewer |
| R2 | Low | `publishFile` | The GitHub read did not set `cache: 'no-store'`; a browser-cached copy could make a quick second publish refuse | Fixed after the verdict: both GitHub reads use `no-store`. Not verified against real GitHub, as the reviewer could not call it. Not re-checked |
| R3 | Low | refusal message | After a publish and a reload, Pages can serve the old file for minutes; the owner is refused and told to wait, but not that unpublished drafts are lost on reload | Fixed after the verdict: the message now says so. Not re-checked |
| R4 | Info | refusal message | A remote file that is not JSON is reported as "changed on GitHub" (after a reload the page shows "could not be loaded" and publishing stays blocked until it is fixed by hand) | Accepted: safe and adequate |
| R5 | Info | publish message | A bad entry is named by its position in the file (`podcasts[i]`) while the page lists newest first; bad entries do render with Edit and Delete | Accepted for now |

**Not checked by the reviewer:** real GitHub and GitHub Pages caching; Reads validation beyond the existing CI rules; the wording of parse errors in Firefox and Safari. **Not re-checked by the reviewer:** the changes marked "after the verdict" (R1 to R3).
