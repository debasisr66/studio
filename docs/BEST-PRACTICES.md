# Studio best practices

The practices Studio follows, grouped by area. Each is visible in this repository; this is a description of how the site is built and run, not a formal certification. Current release: v2.1.

**In short:** keep it simple, keep it private, test everything automatically, and make every change reviewable and reversible.

## Architecture

- **Static-first, no backend.** Served by GitHub Pages: nothing to patch, scale or secure on a server.
- **Data separate from code.** Content lives in versioned JSON files with documented shapes, and CI enforces that the [content contract](CONTRACT.md) matches the files.
- **One-way integration.** Studio only reads from the product repositories, never writes to them.
- **Fails small.** A broken section shows a short notice while the rest of the page works, and every data request has a time limit.
- **Graceful fallbacks.** If live data is missing, basic product cards still show.

Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Design and user experience

- **Mobile-first and responsive**, with matching navigation on phone, tablet and desktop.
- **Accessibility built in, not added later.** The target is WCAG AA: keyboard use, visible focus, a skip link, proper tab and dialog roles, 44 px touch targets, contrast checks, reduced motion and high zoom.
- **Design tokens.** Colours and spacing are defined once as CSS variables, which gives the light and dark themes.
- **Plain-language interface.** Empty states, error messages and owner instructions are written for people, not systems.

Details: [design.md](design.md).

## HTML, CSS and JavaScript

- **No framework, no build step, no npm packages.** Plain, readable code with nothing to keep upgrading.
- **Logic kept in small modules.** Rules such as link checks, categories and safety helpers live in small pure modules that are unit-tested on their own, apart from the page code.
- **No inline scripts or styles anywhere**, which is what makes the strict security policy possible. The one exception is a single checked `application/ld+json` data block for search engines: browsers never run it, and CI checks that it is valid JSON, small, holds no markup and links to real profiles.
- **Self-hosted fonts and assets**, with a size budget per file checked in CI to stop bloat.
- **Semantic HTML**, with all displayed text escaped before it reaches the page.

## Security

- **Strict browser policy (CSP).** Only Studio itself and the GitHub API are allowed: no third-party scripts or hosts, no cookies, no tracking.
- **All input treated as untrusted.** Links pass one strict rule, link fragments are matched against fixed lists, and everything is shown as plain text.
- **Least-privilege token handling.** The owner's token lives only in the browser tab, is asked for just when posting, and is cleared afterwards.
- **Locked-down automation.** Workflows have minimum permissions, actions are pinned to exact versions with weekly update proposals, and no extra secrets are kept.
- **Independent review.** Security-sensitive changes are reviewed by a second AI model, then by a short human check. See [REVIEW-GATE.md](REVIEW-GATE.md).

Details: [security.md](security.md).

## Deployment and operations

- **One pull request per change**, merged only with green checks and the owner's approval.
- **Automated gates on every change:** unit tests, a content validator and a real headless-browser check.
- **Safe publishing.** Each save checks the file's current version before writing, so a stale copy never overwrites a newer one, and files are saved one at a time.
- **Monitoring:** a daily health check, a weekly keep-alive so scheduled jobs are not switched off, and an email alarm with fix steps when checks fail ([CI-RED-FIX.md](CI-RED-FIX.md)).
- **Tagged releases with a tested one-command rollback**, and protected history on `main` (no force-push, no deletion).

Details: [build.md](build.md), [OPERATIONS.md](OPERATIONS.md), [RUNBOOK.md](RUNBOOK.md).

## Structure and documentation

- **Spec first, tests first.** Every change starts as a numbered requirement with a matching test, written and seen failing before the code exists.
- **Traceability:** product requirements → spec → test → code → release record, linked by IDs. See [PRD.md](PRD.md), [specs](specs/README.md) and [test.md](test.md).
- **Living operational documents:** architecture, runbook, operations guide, security log and content contract. Tests check that the documents' links and rules stay in step with the code.

How these practices came about: [ENGINEERING-JOURNEY.md](ENGINEERING-JOURNEY.md).
