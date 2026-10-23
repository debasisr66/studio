# Studio PRD

Status: Draft; **Studio 2.0 direction proposed (§22)**
Last updated: 2026-10-21
Specs: see [docs/specs/](specs/README.md) (index and traceability convention)

## 1. Product summary

Studio is a static, GitHub-hosted product studio hub for Debasis Ray. It is designed to act as a single front door for a portfolio of projects: showing product cards, recent release notes, curated reading and writing content, and a lightweight owner-operated admin layer.

The product is intentionally simple: it avoids a backend, framework, and external dependencies. It runs as a static site on GitHub Pages, reads from GitHub APIs, and relies on a small admin layer to publish repo-managed content safely.

## 2. Problem statement

The owner manages multiple public repositories and wants a single place to:

- present product work in a polished, low-friction way
- keep product metadata current without manual edits
- surface the latest release notes and download links
- share writing and reading recommendations in the same site
- maintain privacy and trust by avoiding analytics, trackers, and third-party assets

Before Studio, this information was scattered across repositories, project pages, release notes, and personal content sources. Studio centralizes that experience while preserving a one-way data flow and static deployment model.

## 3. Product vision

Create a credible, low-maintenance product studio home that feels like a product in its own right: visually clear, technically disciplined, and automatically refreshed from source-of-truth data on GitHub.

## 4. Goals

### Primary goals
- Showcase a portfolio of public products with consistent cards, metadata, and actions
- Automatically refresh repo metadata, stars, language, and latest release info
- Show the newest release notes and downloadable artifacts without manual publishing work
- Offer a lightweight public blogging and reading experience
- Allow owner-only admin edits for content that should be managed in-browser
- Preserve security, privacy, and operational simplicity

### Secondary goals
- Minimize maintenance burden and operational complexity
- Keep the site static and hosted cheaply on GitHub Pages
- Use plain JavaScript and repository-managed content to keep the system understandable
- Strengthen trust with explicit guardrails, validation, and read-only data flows

## 5. Non-goals

- Building a backend or user account system
- Hosting user-generated content from arbitrary sources
- Allowing product repos to write back into their own repositories via Studio
- Supporting complex CMS workflows or rich editorial tooling
- Running a multi-tenant SaaS platform
- Replacing GitHub as the source of truth for release and repo data

## 6. Users and personas

### 6.1 Visitor / audience
A curious person discovering the owner’s products, writing, and updates.

Needs:
- discover projects quickly
- understand what each project does
- see current releases and downloads
- browse reading and writing content without friction

### 6.2 Owner / maintainer
The person managing the portfolio and content.

Needs:
- add a product to the hub without custom code or a build step
- keep product data current automatically
- publish blog posts and reads with minimal friction
- keep the site operational with a small maintenance burden

### 6.3 Product repo maintainer
A repository owner whose project is listed on Studio.

Needs:
- publish a release and have Studio reflect it automatically
- keep product info in the product repo as the source of truth
- optionally use a dispatch token to trigger immediate refresh

## 7. Product scope

### In scope
- Product registry with configurable overrides
- Product cards with metadata and actions
- Release feed from GitHub Releases
- Reads, split into **Technical** and **Others** (v2.0), and **Podcast links** (v2.0). The blog is retired in v2.0
- Owner-only admin editing experience
- Nightly sync and immediate update triggers from product repos
- Static HTML/CSS/JS architecture on GitHub Pages
- Validation and health checks
- Lightweight feature-spec documentation in `docs/specs/`

### Out of scope for v1
- Full CMS with role-based permissions
- Server-side rendering or database-backed infrastructure
- Analytics dashboards or user personalization
- Native mobile app or cross-platform client
- Public API for external content ingestion

## 8. User experience

### 8.1 Primary flow: discover products
1. User opens the Studio site.
2. Site renders a grid of product cards from the registry and cache.
3. Each card shows project name, category, description, language, stars, release info, and actions.
4. User can open the project, download the latest asset, or open source.

### 8.2 Primary flow: follow product updates
1. Product repo publishes a release or README update.
2. Product repo triggers a dispatch or the nightly sync job runs.
3. Studio fetches repo metadata and latest release details via GitHub API.
4. `content/cache.json` is updated and the site refreshes via Pages deployment.

### 8.3 Primary flow: manage content
1. Owner opens admin modal from the site.
2. Owner authenticates with a GitHub PAT for the owner account.
3. Owner edits blog posts or reading list entries.
4. The site validates content and publishes each changed file with a GitHub Contents API PUT.
5. Files are committed individually, preserving a clear change trail.

## 9. Functional requirements

### 9.1 Product registry and display
- Studio must maintain a product registry in `content/products.json`.
- Each entry must support repository identification and optional overrides such as:
  - name
  - tagline
  - category
  - featured placement
  - hidden flag
  - URL
  - preferred download asset pattern
- Product cards must render fallback content if registry data or cache data is missing.
- Hidden products must not appear in the public site or sync process.

### 9.2 Automatic sync
- The system must sync product metadata from GitHub using a Node script with no external dependencies.
- It must fetch repo metadata and latest release data via GitHub API.
- It must read a registry and write `content/cache.json` in a validated, idempotent manner.
- It must handle partial failure without losing prior cache entries.
- It must stop fetching when API rate limits are low, preserving safe behavior.
- It must support nightly runs, manual runs, and repository_dispatch triggers.

### 9.3 Release notes and downloads
- The site must display a feed of recent release notes and metadata.
- Each product card must show a version and the latest release where available.
- Download actions must resolve to a specific asset when configured, otherwise fall back to the release page.
- The footer version and “What’s new” dialog must show changelog content in plain language.

### 9.4 Reads and podcasts (changes in v2.0)
- **Reads** are curated links managed as a repo content file, split into two sub-items: **Technical** and **Others** (SPEC-RC). Every read belongs to exactly one.
- **Podcasts** replace the blog: the owner adds links to podcasts and episodes with a short take (SPEC-PC). The blog section and its admin editor are retired; old `#blog` links continue to work by landing on Podcasts.
- Both are editable through the admin interface and validated before publishing; both share one set of link rules (clean http(s) addresses only).
- Sections appear in one fixed, simple order for every visitor: Products, Updates, Reads, Podcasts (SPEC-UX). There is no usage tracking and no reordering by use.
- File updates must be validated before publishing to reduce broken content.

### 9.5 Admin security model
- The admin layer must require a GitHub PAT.
- The token must be checked against `GET /user` and validated to match the owner account.
- The token must be stored in browser session storage only; if unavailable, an in-memory fallback can be used.
- The token must be cleared on logout, idle timeout, or tab close.
- The site must never store the token in `localStorage`, cookies, or repo content.

### 9.6 Safety and content integrity
- The site must enforce strict CSP rules: no inline scripts, no inline styles, and no remote assets.
- All text must be escaped before presentation.
- URLs must be sanitized to `http`/`https` only.
- Content JSON must be validated before publish or write.
- Every write should use a GET-SHA-before-PUT pattern to avoid overwriting stale data.
- The sync job must only read from product repos; it must never write into them.

### 9.7 Feature specs and documentation discipline
- Studio maintains a lightweight feature-spec workflow in `docs/specs/`.
- Each feature spec is written before implementation when the change affects behavior, data model, trust, or operational reliability.
- Specs capture the problem, goal, requirements, acceptance criteria, security considerations, and validation plan.
- Larger changes may also include feature-level `plan.md`, `design.md`, and `test.md` documents under the same spec folder.
- Repo-level docs remain the product’s broader history and release record; feature specs are the implementation trace for specific workstreams.
- Every spec requirement has an ID (`TR-01`…), is traced to a PRD section, test cases and release `REQ-nn` rows, and is indexed in [specs/README.md](specs/README.md).

## 10. Non-functional requirements

### 10.1 Performance
- The site must load quickly as a static page with small content files.
- Product refreshes should not block page rendering.
- Sync should be resilient to one repo failing without breaking the entire collection.

### 10.2 Reliability
- The system must degrade gracefully if GitHub APIs fail or a repo is unreachable.
- Previous valid cache data should remain usable when a fresh fetch fails.
- The site must work with missing or partial content without crashing the interface.

### 10.3 Security and privacy
- Self-hosted fonts and assets must avoid third-party tracking.
- No analytics, trackers, or remote scripts are allowed.
- Product repos are only read, never mutated by the hub.
- Personal admin tokens remain browser-scoped and not persisted broadly.

### 10.4 Maintainability
- The project must avoid build dependencies and framework overhead.
- Validation, health checks, and tests must catch regressions automatically.
- Documentation must explain the architecture, operating model, and fail-safe checks.

## 11. Data model

### 11.1 `content/products.json`
Represents the registry of products to show.

Required fields:
- `repo` — GitHub repository in `owner/name` form
- optional overrides for name, tagline, category, featured, hidden, URL, and download_asset

### 11.2 `content/cache.json`
Represents the last synced GitHub data for each product.

Shape:
- `synced_at`
- `products` keyed by repo name
- each product includes description, stars, language, topics, pushed_at, html_url, latest_release

### 11.3 Blog and reads content
- `content/blog.json` stores blog post objects.
- `content/reads.json` stores books and articles.
- Content is designed to be human-readable JSON and editable through the admin layer.

## 12. Architecture and system design

### 12.1 Static front-end
- `index.html` provides the page structure and sections.
- `css/site.css` contains the visual language and tokens.
- `js/app.js` manages rendering and admin flows.
- `js/reads-lib.js` contains reads-specific logic and helpers.
- `js/token-store.js` manages PAT storage and idle lock behavior.
- `js/image-lib.js` validates and processes uploaded profile images.

### 12.2 Sync workflow
- `scripts/sync-products.js` reads the registry and GitHub API state.
- It validates content before writing to cache.
- It uses guarded fetches, stale fallback, and idempotent writes.
- GitHub Actions runs it nightly and on manual/dispatch triggers.

### 12.3 Safety net
- `scripts/validate-site.js` validates JSON, schema, URLs, and CSP-related constraints.
- `scripts/health-check.js` verifies that the live site and cache remain coherent.
- GitHub Actions CI runs tests and validation on pushes and pull requests.

### 12.4 Spec-driven delivery
Studio keeps a lightweight, feature-scoped spec layer in `docs/specs/` to support changes that need clear behavior and acceptance boundaries. This complements the release-level docs and keeps operational decisions easy to trace without creating heavy project overhead.

## 13. Release criteria

Studio is release-ready when all of the following are true:

1. Product onboarding is operational
   - A new product can be added by editing `content/products.json`.
   - The sync script can successfully populate the cache without manual correction.
   - Product cards render with sensible fallbacks for missing metadata.

2. Data freshness is reliable
   - The sync job completes on schedule or on demand.
   - Release data and repo metadata are updated without stale or broken output.
   - A repo failure does not break the entire site or erase previous valid data.

3. Content publishing works for the owner
   - Blog and reads entries can be created, edited, and deleted through the admin flow.
   - Publishing preserves content validity and avoids accidental overwrites.
   - Changes are traceable through commit history.

4. Safety checks are active and enforced
   - CI validation and health checks complete successfully for routine changes.
   - The site remains secure under the strict CSP and asset constraints.
   - The admin token remains browser-scoped and expires or clears as expected.

5. User experience is stable and comprehensible
   - The site loads cleanly on desktop and mobile.
   - Product cards, release feed, and reads/blog sections are visible and usable.
   - Failure states are human-readable and non-blocking.

6. Operational discipline is documented
   - Sync, token rotation, and recovery steps are documented.
   - The repository owner can identify the source of an operational issue without ad hoc debugging.

## 14. Security requirements and controls

### 14.1 Threat model
Studio is a static site with minimal attack surface, but the following risks matter:

- malicious or invalid content being published through the admin flow
- token theft or token persistence in browser storage
- unsafe external URLs or content injection through frontend rendering
- stale or corrupted cache data affecting product presentation
- accidental writes to product repos or repository history from the hub

### 14.2 Security controls
- Strict CSP: `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com; base-uri 'none'; form-action 'none'`
- No inline scripts or inline styles
- No external trackers or analytics scripts
- Self-hosted fonts and assets only
- All user-visible text is HTML-escaped before rendering
- URL validation allows only `http` and `https` inputs
- Content schemas are validated before JSON is written or published
- The sync workflow reads only public product repos; it never writes to them
- Admin token is checked against the authenticated GitHub user and must match the owner account
- Token lifetime is scoped to the browser tab/session and cleared on logout or idle timeout
- Files are updated using a GET-SHA-before-PUT pattern to reduce overwrite risk

### 14.3 Security acceptance bar
The product should not be considered ready for broader public use until:
- the owner knows how to rotate the PAT and clear session data
- validation and health checks fail on invalid content or unsafe changes
- no remote script or tracker is present in the deployed site
- the sync workflow remains read-only with respect to product repos

## 15. Success metrics

Success should be measured in both product and operational terms.

### 15.1 User-facing success metrics
- Product portfolio is discoverable without needing manual navigation or custom tooling
- Visitors can understand what the owner builds within seconds of landing on the site
- Release notes and download actions are visible and current for each listed product
- Blog and reading content remain easy to browse and share

### 15.2 Operational success metrics
- New product additions take less than one session to complete without engineering help
- Sync runs complete successfully on schedule or on demand
- Broken product repos do not impact the rest of the site
- CI and health check runs remain green after routine changes
- Content publication errors are caught before data is committed or rendered

### 15.3 Target thresholds
These thresholds are intentionally modest and practical for a personal product studio:
- 100% of listed products render a valid card with either live or fallback metadata
- 100% of sync runs either succeed or fail safely without deleting prior cache data
- 0 known security policy violations in the deployed site
- 0 published admin edits that break JSON shape or site rendering
- 0 product repo writes triggered by the Studio sync job

## 16. Tentative roadmap

### Phase 1: Stabilize the core hub
Status: mostly delivered in v1.1 to v1.5 (registry validation, fallbacks, sync safety, runbook). The remaining work is specified in [SPEC-SH](specs/stabilize-core-hub/spec.md) and is the first step of Studio 2.0.
- Finalize the product registry and cache contract
- Improve fallback behavior for missing repo metadata
- Tighten validation for release assets and changelog presentation
- Document owner operations: add product, rotate PAT, fix sync issues

### Phase 2: Strengthen product trust and reliability
Status: **shipped as v1.5** (SPEC-TR).
Spec: [SPEC-TR](specs/product-trust-reliability/spec.md) (draft, awaiting approval). Requirements TR-01…TR-13 cover the four items below.
- Define feature specs for reliability work under `docs/specs/` before implementing schema validation, cache freshness checks, and recovery guidance
- Expand automated checks for schema quality and safe URLs
- Improve health-check coverage for cache freshness and release parity
- Add better recovery guidance for failed syncs and stale data
- Review whether branch protection or required CI should be enforced for this repo

### Phase 2.5: Studio 2.0 (in progress; SH, RC and PC phases A and B built, v1.6 intermediate release live; UX and Phase C remain)
Four specs, built in this order (each later one depends on the earlier):
1. [SPEC-SH](specs/stabilize-core-hub/spec.md): stabilise the core hub (section isolation, browser smoke test, content contract, owner operations, schema versions)
2. [SPEC-RC](specs/reads-categories/spec.md): Reads split into Technical and Others
3. [SPEC-PC](specs/podcast-links/spec.md): Podcast links replace the Blog
4. [SPEC-UX](specs/simple-layout/spec.md): simpler, more intuitive layout in one fixed order (the usage-based ordering idea was dropped by the owner on 2026-10-21)
Release: **v2.0** (a major version because navigation and content files change). Rollback tag: `v1.5`. Impact and plan: [docs/impact.md](impact.md), [docs/plan.md](plan.md).

### Phase 3: Editorial and discoverability improvements
- Add richer blog and reads UX without increasing complexity
- Improve filtering, search, and shared-link experiences for reads
- Add lightweight metadata curation for product categories and featured items
- Review content strategy and presentation for visitor clarity

### Phase 4: Expand the studio as a durable personal platform
- Add a clearer content roadmap and editorial cadence
- Evaluate whether additional product categories or collections make sense
- Consider a more formal release policy for Studio itself
- Decide whether Studio should remain a highly disciplined static site or grow into a broader portfolio tool

## 17. Risks and trade-offs

### Risks
- GitHub Actions scheduled runs can be delayed, so the nightly sync may not align with expected timing.
- Cache drift can occur if a repo’s release workflow does not trigger the dispatch hook.
- Branch protection or workflow restrictions could impact operational automations if the repo policy changes.
- The admin model depends on browser behavior and owner token hygiene.

### Trade-offs
- Static architecture keeps complexity low but limits dynamic features.
- Read-only integration from product repos reduces automation risk but requires disciplined operational practices.
- One personal admin token in the browser keeps the site simple but makes token handling a product concern.

## 18. Open questions

- Should Studio eventually support additional curated content types beyond blog and reads?
- ~~Does the owner want a more formal branch protection / required CI strategy beyond alerts and validation?~~ Answered by the tested decision in [docs/rulesets/README.md](rulesets/README.md): history protected for everyone; CI gating by process, because a CI-required rule blocks the sync and keep-alive bots. The decision record and revisit triggers are TR-11 in the spec.
- Would a more explicit public roadmap improve discoverability and trust for visitors?
- Should there be stronger product-level release governance, such as required release metadata or quality checks for listed repos?
- Should the owner add a formal editorial review step for reading and podcast content before publication?
- (2.0) Should books follow the Technical / Others split like articles? Recommended: yes (SPEC-RC Q1).
- (2.0) Keep `content/blog.json` as an archive after the blog is retired, or delete it? Recommended: keep, unrendered (SPEC-PC Q2).

## 19. Recommended next steps

1. Define a clearer product roadmap by theme (products, writing, updates, reading list).
2. Confirm the public contract for registry and release metadata handling.
3. Review which acceptance checks should become enforced by branch protection versus advisory CI.
4. Document the operational runbook for token rotation, sync failures, and manual recovery.
5. Add a concise maintainer guide for adding or retiring products from the registry.
6. Formalize the owner’s security checklist for PAT rotation, content validation, and safe deployment changes.

## 20. Appendix: repository evidence used in this PRD

This PRD is based on the repository’s current docs and implementation, including:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/product-intro.md`
- `content/products.json`
- `scripts/sync-products.js`
- `js/app.js`, `js/reads-lib.js`, `js/token-store.js`, `js/image-lib.js`
- the project documentation under `docs/`

These sources confirm the product’s current direction: a static, GitHub-first, content-driven studio hub that prioritizes simplicity, security, privacy, and automation over a traditional backend-heavy model.

## 21. Short product statement

Studio is a lightweight, privacy-first product studio hub that presents a portfolio of projects, keeps release information current automatically, and provides a small editorial layer for writing and reading.

## 22. Studio 2.0 workstreams and traceability

| Owner request | Spec | Requirements | PRD sections it changes | Depends on |
|---------------|------|--------------|-------------------------|-----------|
| Stabilize the core hub | [SPEC-SH](specs/stabilize-core-hub/spec.md) | SH-01 … SH-08 | 9.1, 9.2, 10.2, 11, 13, 16 (Phase 1) | none (first) |
| Reads has two sub-items: Technical and Others | [SPEC-RC](specs/reads-categories/spec.md) | RC-01 … RC-09 | 7, 9.4, 11.3 | SH (schema versions, smoke test) |
| Blog replaced with Podcast links | [SPEC-PC](specs/podcast-links/spec.md) | PC-01 … PC-09 | 7, 9.4, 11.3 | SH |
| Adding an item must be quick and work in any order from the owner's iPhone: paste first, unlock only when posting, publish, lock again (added 2026-10-23) | [SPEC-QA](specs/quick-add/spec.md) | QA-01 … QA-10 | 9.4, 11.3, 14 | RC, PC (the composers and the guarded publish) |
| Simpler, more intuitive layout (usage-based ordering was part of the request and was dropped by the owner on 2026-10-21) | [SPEC-UX](specs/simple-layout/spec.md) | UX-01 … UX-07 | 7, 8 | RC, PC (final section set) |

Release targets for 2.0 (measurable, checked in each spec's test plan):
- 0 sections that can take the page down: one failing section never stops the others (SH-01)
- 100% of content files covered by a contract and a validator rule with a fixture (SH-03)
- 0 broken old links: `#blog`, `#reads` and every existing deep link still land somewhere sensible (PC-05, UX-04)
- No new third-party request or cookie; no storage about visitors; the only new storage key is one owner-only draft key in the owner's tab, written after the owner uses Quick add and never holding the token (SPEC-QA QA-07; CSP unchanged)
- Page weight stays within the existing budgets (`validate-site.js` `BUDGETS`)
