# Studio and Penny — Product Introduction

*Studio by Debasis Ray — learning never ends!* · https://debasisr66.github.io/studio/ · current version **v1.5**

## In one paragraph

**Studio** is a small product studio's front door: one address where each product, its latest release, its downloads and the writing around it are found, kept current automatically from the products' own repositories. **Penny** is its first flagship product, a private, offline-first personal expense manager. Studio shows how a product team can ship several independent products behind one brand with almost no operating overhead: no servers, no database, no accounts, and no third party contacted when someone visits.

## How Studio works

| Layer | What it does |
|-------|--------------|
| **Hub site** | Product cards (Open app, Download, Source), an Updates feed of release notes, a Blog, **Reads** (a curated, shareable reading list the owner adds to like a post), the owner's profile photo, the Studio logo, and a **What's new** button with the version in the footer |
| **Live data** | A sync refreshes each product's description, version and downloads from GitHub nightly, and within minutes of a product release |
| **One-way flow** | Products notify the hub; the hub only reads them. The hub can never change a product |
| **Privacy** | Fonts, logo and every other asset are served by Studio itself: visiting contacts no one else, and there are no trackers or analytics |
| **Owner tools** | A small admin layer (unlocked with a personal token that lives only in the browser tab) for the blog, reads and profile photo; photos are cropped, resized and stripped of location data before publishing |
| **Safety net** | Strict security policy (no inline script or style, nothing from other sites), 142 automated tests, CI on every change, a daily health check that also watches the sync (it must have succeeded in the last 48 hours), release assets and the scheduled jobs, a sync that turns red (while keeping each product's last good data) when any product fails, a runbook for every alert, a weekly keep-alive so the nightly updates are never switched off, automation pinned to exact versions with weekly update proposals, and full git history for rollback |
| **Release discipline** | Every release goes through impact analysis, plan, design, test-first build, a visual comparison against the previous release, a security review and a pull request with green CI |
| **Protection of the record** | The main branch's history cannot be rewritten or deleted by anyone, including the owner |
| **Run cost** | Static hosting on GitHub Pages; no backend to patch or monitor |

**What Studio does not claim:** GitHub cannot force "CI must pass" on this site without also blocking its own automation (tested and documented), so green CI is a rule of the release process rather than a technical lock; and a mistaken content change made from the admin screen is caught by CI afterwards, not prevented.

## Where Penny sits

Penny is registered in Studio as a **featured Productivity product**. Its card offers **Open app** (the hosted app), **Download** (the packaged source/app archive from its latest release) and **Source**. Every Penny release appears in Studio's Updates feed with its notes, with no manual step. Penny owns its code, tests and documentation in its own repository; Studio owns discovery and presentation.

## Penny at a glance

A mobile-friendly personal expense manager in Indian rupees. All data stays in the user's own browser; there is no account and no server database.

| Capability | What it gives the user |
|------------|------------------------|
| Expense tracking | Add, edit and delete with date, amount, category, description, tags and payment method (UPI, cards, cash, transfer, wallet) |
| Monthly clarity | Spend, budget and money-left cards, a category chart, and a warning when the budget is exceeded |
| Fast search | Free text plus operators such as `#groceries`, `rail:upi`, `coffee OR tea`, `-rail:cash`, `min:100`, `today` |
| Data portability | Export CSV or Excel; import CSV, Excel or a JSON backup after a preview, with an undo snapshot; optional linked JSON file kept up to date |
| Voice entry | Speak English, Hindi or Spanish; a draft is shown in English for correction; **nothing is saved without the user's approval** |
| Currency estimates | INR, USD, EUR and GBP conversion from a daily or manual rate; records always stay in INR |
| Control and recovery | Settings, delete one month or all, double-confirmed reset, guarded undo, saved tags |
| Privacy-safe diagnostics | Error-only logs by default, optional 30-minute debug, no expense data or spoken text in logs |
| Run anywhere | Hosted web app, or a local container started with one command (`penny --start`) |

## Stability and engineering evidence (v3.2)

| Area | Evidence |
|------|----------|
| Cadence | Repository created 12 Oct 2026; v3.1 released 16 Oct; **v3.2 released 19 Oct** |
| Automated tests | **633 pass, 0 fail, 0 skipped**, both locally and inside the container build (up from 189 in the earlier V3 verification), including a 351-test Hindi/Hinglish corpus (with unsafe-phrase cases), 100 structured Spanish phrases and colour-contrast checks |
| Independent review | A separate reviewer reproduced attacks against the language and data handling; every finding was fixed and kept as a permanent regression test. No remaining high-impact finding in the reviewed scope |
| Deployment verification | CI and Pages succeeded; 13 of 13 published runtime files matched the source; the downloadable archive's checksum matched |
| Data protection | Atomic writes with revision checks (stale tabs cannot silently overwrite newer data), previews before imports, undo snapshots, upgrades preserve saved expenses and budgets, reset only by explicit confirmation |
| Security posture | Static client-side app with no accounts or server; content-security policy; spreadsheet library self-hosted with a recorded checksum; imports reject formulas, macros and external links; reviewed against the OWASP Top 10:2025 (a targeted review, not a certification) |
| Runtime hardening | Container runs as a non-root user with a read-only filesystem, dropped privileges and a health check |
| Traceability | Plan, design, requirement-to-test traceability, release notes and rollback guidance are kept with the code |

## What is deliberately not claimed

| Open item | Why it matters |
|-----------|----------------|
| Real iPhone microphone capture and repeated Hindi/Spanish audio | Tested with typed transcripts; real audio quality depends on the phone and the browser's speech service |
| Native-speaker review of Hindi and Spanish | The offline parser handles a bounded expense vocabulary; it is not general translation and flags unfamiliar words instead of guessing |
| Screen reader, 200% zoom and uncoached usability testing | Responsive and contrast checks exist, but full accessibility acceptance is still open |
| Public container image, signing and fresh vulnerability scan | Container is verified as a local source build only |
| Data lives in the browser | Clearing site data deletes records; regular JSON backups are the safeguard |
| Security certification | None claimed |

## Readiness

| Question | Answer |
|----------|--------|
| Stable for personal use today? | **Yes**: heavily tested, verified in deployment, safe upgrade and recovery paths |
| Behaves like a product, not a prototype? | **Yes**: versioned releases, notes, downloads, tests, review, traceability, rollback |
| Ready to promote to a wide audience? | **Not yet**: close the voice-on-device, language review and accessibility items first |
| What does Studio add? | A single credible home that keeps Penny's releases, downloads and story current with no manual work, built to the same engineering standard as the product it presents |

*Sources: Penny's README, release notes, V3.2 verification record and security review (figures as recorded on 19 October 2026); Studio's architecture, test and security documents (figures as recorded on 20 October 2026, v1.4).*

## Roadmap: Studio 2.0 (proposed; not yet built)

| Change | What a visitor or the owner gets |
|--------|----------------------------------|
| Stabilised core | One failing section can no longer affect the rest of the page; rendering is tested automatically; every content file has a written contract |
| Reads: Technical and Others | Two clear sections in Reads, each with its own filters and search, and a direct link to each |
| Podcasts replace the Blog | The owner shares podcast and episode links with a short take; no embedded players, no third parties |
| Simpler, adaptive layout | Products and Updates first, then Reads and Podcasts ordered by what the visitor uses most, remembered on that device only, resettable, with no analytics |

Specs, impact, plan and security pre-review: [docs/specs/](specs/README.md), [impact](impact.md), [plan](plan.md), [security](security.md) §11. The current version remains **v1.5** until 2.0 ships.

