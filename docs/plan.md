# Plan — Studio v1.1

Date: 2026-10-19 · Owner: Debasis Ray · Status key: ✅ done · ⏳ pending · 🔒 needs owner

## Goals

1. HCI-guideline UI (see [design.md](design.md)).
2. Branding: **Studio by Debasis Ray — learning never ends!**
3. Reads: add and share links like a LinkedIn post (owner-only, no backend, no third-party services).
4. Meet non-functional and security requirements, and **break nothing**: Penny, debasis-web and the sync pipeline run as before.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Who can add | Owner only, via the admin token | No new backend or abuse surface |
| Link preview | Manual title and comment | No third party sees what you read |
| Sharing out | LinkedIn share link, Copy link, native share sheet | Covers desktop and phone with no SDKs |
| Delivery | Branch `v1.1`, tag `v1.0` as rollback | Pages deploys only from `main` |

## Phases

| Phase | Work | Gate | Status |
|-------|------|------|--------|
| 0. Safety net | `git pull --rebase`; tag `v1.0`; branch `v1.1` | Tag pushed | ✅ |
| 1. Library (test first) | `js/reads-lib.js` + `tests/reads-lib.test.js` | 16/16 tests pass | ✅ |
| 2. UI | Branding, HCI pass, composer, cards, filters, share, CSP; script extracted to `js/app.js` | Loads with zero console errors and zero CSP violations | ✅ |
| 3. Verification | Browser checks at 375, 768 and desktop; XSS payloads; accessibility audit; regression on protected files | All pass (see [test.md](test.md)) | ✅ |
| 4. Docs | impact, plan, design, test, build, model-use | Reviewed | ✅ |
| 5. Merge and deploy | Merge `v1.1` to `main`, push, check Pages | Owner approval; Pages build success | ✅ (`c5b3d0f`) |
| 6. Live smoke test | Live URL, product cards, Penny and debasis-web links, nightly sync dry run | Checklist in [test.md](test.md) §6 | ✅ |
| 7. First real publish | Add one read as admin and publish | Needs owner's token | ⏳ 🔒 |
| 8. Tag | Tag `v1.1` | After phase 7 passes | ⏳ |

## Acceptance criteria

- A1: Title, header, hero and footer carry the new branding.
- A2: Owner can post, edit and delete a read; visitors cannot see or use the composer.
- A3: Reads can be filtered by tag and searched; each card has LinkedIn share and Copy link (plus native share where supported).
- A4: Existing reads (`{title, url, note}`) still display.
- A5: `git diff main` is empty for `.github/`, `scripts/`, `content/products.json`, `content/blog.json`.
- A6: Sync dry run still passes; Penny and debasis-web links still work.
- A7: Zero CSP violations; hostile input in title, comment, tags and URL renders as inert text.
- A8: No horizontal scroll at 375 px; keyboard-only operation works end to end.

## Out of scope

Public submissions, link-preview services, comments or likes, analytics, a backend, changes to Penny or debasis-web, replacing Google Fonts.

## Next candidates (not committed)

Reading-list RSS feed; export reads as Markdown; an admin token validity check on load; self-hosting fonts to remove the last third-party request.

## Checklist for the merge step

- [x] Owner approves merge
- [x] `git checkout main && git pull --rebase && git merge --no-ff v1.1`
- [x] `git push` and confirm `gh run list` shows Pages success
- [x] Run the live smoke checklist
- [ ] Add one read with the admin token; confirm it appears after the Pages rebuild
- [ ] `git tag v1.1 && git push origin v1.1`
