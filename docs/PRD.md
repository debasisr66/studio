# Studio PRD

Status: Draft
Last updated: 2026-10-20

## 1. Product summary

Studio is a static, GitHub-hosted product studio hub for Debasis Ray. It is designed to act as a single front door for a portfolio of projects: showing product cards, recent release notes, a curated reading list, and a lightweight blog, all kept current automatically from product repositories on GitHub.

The product is intentionally simple: it avoids a backend, framework, and external dependencies. It runs as a static site on GitHub Pages, reads from GitHub APIs, and relies on a small admin layer to edit content directly in the repository using a GitHub personal access token held only in the browser session.

## 2. Problem statement

The owner manages multiple public repositories and wants a single place to:

- present product work in a polished, low-friction way
- keep product metadata current without manual edits
- surface the latest release notes and download links
- share writing and reading recommendations in the same site
- maintain privacy and trust by avoiding analytics, trackers, and third-party assets

Before Studio, this information was scattered across repositories, project pages, release notes, and personal content sources. Studio centralizes that experience while preserving a one-way data flow from product repos to the hub.

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
- Blog content and reading list content
- Owner-only admin editing experience
- Nightly sync and immediate update triggers from product repos
- Static HTML/CSS/JS architecture on GitHub Pages
- Validation and health checks

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

### 9.4 Blog and reads
- Studio must support a blog and reading list as content files managed in the repo.
- These files must be editable through the site admin interface.
- Data model should support posts, articles, and books.
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

## 13. Acceptance criteria

### Release-ready criteria
- A product can be added by editing `content/products.json` and running the sync script.
- Studio displays at least the product name, description, language, stars, and latest release info.
- The release feed updates automatically from GitHub releases.
- The site continues to render even when one product or API call fails.
- Blog and reads content can be published by the owner with admin credentials.
- The site remains secure under the strict CSP and asset-policy constraints.
- CI and health checks continue to pass for normal changes.

## 14. Risks and trade-offs

### Risks
- GitHub Actions scheduled runs can be delayed, so the nightly sync may not align with expected timing.
- Cache drift can occur if a repo’s release workflow does not trigger the dispatch hook.
- Branch protection or workflow restrictions could impact operational automations if the repo policy changes.
- The admin model depends on browser behavior and owner token hygiene.

### Trade-offs
- Static architecture keeps complexity low but limits dynamic features.
- Read-only integration from product repos reduces automation risk but requires disciplined operational practices.
- One personal admin token in the browser keeps the site simple but makes token handling a product concern.

## 15. Success metrics

- New product entries can be added without custom engineering work.
- Product information remains current without manual, repetitive updates.
- Release notes appear promptly after product releases.
- No major broken site states occur during sync or content publication.
- Site remains fast, static, and privacy-safe.

## 16. Open questions

- Should Studio eventually support additional curated content types beyond blog and reads?
- Does the owner want a more formal branch protection / required CI strategy beyond alerts and validation?
- Would a more explicit public roadmap improve discoverability and trust for visitors?
- Should there be stronger product-level release governance, such as required release metadata or quality checks for listed repos?

## 17. Recommended next steps

1. Define a clearer product roadmap by theme (products, writing, updates, reading list).
2. Confirm the public contract for registry and release metadata handling.
3. Review which acceptance checks should become enforced by branch protection versus advisory CI.
4. Document the operational runbook for token rotation, sync failures, and manual recovery.
5. Add a concise maintainer guide for adding or retiring products from the registry.

## 18. Appendix: repository evidence used in this PRD

This PRD is based on the repository’s current docs and implementation, including:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/product-intro.md`
- `content/products.json`
- `scripts/sync-products.js`
- `js/app.js`, `js/reads-lib.js`, `js/token-store.js`, `js/image-lib.js`
- the project documentation under `docs/`

These sources confirm the product’s current direction: a static, GitHub-first, content-driven studio hub that prioritizes simplicity, security, privacy, and automation over a traditional backend or complex CMS.

## 19. Short product statement

Studio is a lightweight, privacy-first product studio hub that presents a portfolio of projects, keeps release information current automatically, and provides a small editorial layer for writing and reading content, all without a backend or external tracking.


