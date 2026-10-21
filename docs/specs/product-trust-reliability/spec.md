# Feature spec: Product trust and reliability

## Metadata

- Feature: Product trust and reliability
- Status: Draft
- Created: 2026-10-21
- Owner: Debasis Ray
- Related issue/PR: TBD
- Target release or milestone: Next reliability pass

## Summary

Studio is a small but operationally important public site: it pulls product metadata and release data from external GitHub repos, renders a public portfolio, and publishes owner-managed content in-browser. The trust and reliability work in this spec aims to reduce silent data drift, improve recovery when sync fails, and make the repo’s protection strategy explicit.

This initiative covers four related goals:
1. Expand automated checks for schema quality and safe URLs
2. Improve health-check coverage for cache freshness and release parity
3. Add better recovery guidance for failed syncs and stale data
4. Review whether branch protection or required CI should be enforced for this repo

The goal is not to turn Studio into a complex platform. It is to keep the project trustworthy, understandable, and resilient without increasing operational overhead unnecessarily.

## Problem

The repo already has a strong static architecture and basic validation, but there are important gaps in operational trust:

- schema drift can silently break rendering if JSON shape changes
- unsafe or malformed URLs may be accepted if validation is incomplete
- stale cache data may remain in place after sync failures or missing releases
- sync health and release parity are not always visible or explicit
- repo protection is currently not clearly documented or enforced

Without these safeguards, a small change can create a misleading public experience or a hard-to-debug operational failure.

## Goal

Strengthen Studio’s reliability and trust by making the project easier to validate, easier to recover, and clearer about protection and quality gates.

## Non-goals

- Building a backend or database
- Turning Studio into a multi-tenant app
- Adding user accounts or internal dashboards
- Instrumenting a broad analytics or observability platform
- Moving away from the static GitHub Pages model

## Users and context

This affects:
- the site owner and maintainer
- visitors who rely on the product cards and release data
- future contributors working on the repo
- operational automation that runs sync and health checks

The site remains:
- static HTML/CSS/JS
- GitHub Pages hosted
- JSON-driven content
- read-only sync from product repos
- browser-scoped admin token for owner edits

## Requirements

1. Studio must validate content schema quality more aggressively for content and cache files.
2. URL validation must reject unsafe or malformed values before data is published or shown.
3. The health check must detect stale cache data, mismatched release metadata, and degraded sync state.
4. Recovery guidance must include clear recovery steps for stale cache, failed syncs, and missing release data.
5. The repo must explicitly document whether branch protection or required CI should be enforced.
6. CI and health-check coverage must be aware of both content integrity and sync correctness.
7. The system must fail safely: stale or partial data must not silently replace valid data without warning.
8. Documentation must explain operational recovery for the owner without requiring ad hoc debugging.

## User stories

- As the owner, I want sync failures to be obvious and recoverable so I can restore valid data quickly.
- As a maintainer, I want schema validation to catch breakages before they get published.
- As a visitor, I want product pages and release data to remain accurate and trustworthy.
- As the repo maintainer, I want clear branch protection guidance so the workflow is intentional and predictable.

## Acceptance criteria

- [ ] JSON schema validation catches broken or unexpected product, cache, or reads structure.
- [ ] URL validation rejects unsafe schemes and malformed values.
- [ ] Health checks fail when cache is stale, missing, or inconsistent with current release state.
- [ ] Sync failure guidance is documented for stale data recovery and manual re-sync steps.
- [ ] The repo documents a recommended branch protection or required CI policy, including trade-offs.
- [ ] The system continues to work safely when a product repo is missing, rate-limited, or partially failing.
- [ ] No security or trust regression is introduced by the validation or recovery work.

## Data and content model

Affected files and data:
- `content/products.json`
- `content/cache.json`
- `content/reads.json`
- `content/blog.json`
- `scripts/sync-products.js`
- `scripts/validate-site.js`
- `scripts/health-check.js`
- `.github/workflows/ci.yml`
- `.github/workflows/health.yml`
- `docs/PRD.md`
- `docs/plan.md`
- `docs/design.md`
- `docs/test.md`
- `docs/security.md`

Planned data checks:
- required JSON fields present
- no unexpected nulls or empty-critical fields
- URL scheme restricted to `http` or `https`
- content arrays must not include malformed entries
- cache freshness timestamps must be within acceptable window
- release parity checks identify when release metadata appears missing or inconsistent

## UI / behavior

This initiative is mostly operational and reliability-focused rather than user-facing design. However, it still needs explicit user-visible behavior:

- stale or invalid sync results should not silently show broken product data
- failed sync states should be clear in operational docs and health outputs
- the owner should be able to recover via a documented fallback path
- branch protection or required CI should be explained in repo policy terms, not by surprise

## Security and trust requirements

- No unsafe URLs or remote script injection
- No inline scripts or styles
- No tracking or remote script dependencies
- Validation must fail on malformed content before publish
- Admin flows must maintain browser-scoped token hygiene
- Sync remains read-only with respect to product repos
- Recovery steps must preserve previously valid cache data unless a full update is explicitly approved

## Edge cases and risks

- stale cache remains visible after a failed sync
- rate limiting hides release metadata or marks it as current when it is not
- malformed product repo metadata breaks product cards or UI rendering
- unsafe URL values are accepted if validation is too loose
- branch protection becomes too restrictive for lightweight operations and blocks automation
- required CI may impose friction without enough operational benefit

## Dependencies

- existing Node validation scripts
- GitHub Actions workflows
- product registry and cache files
- health-check script
- repo branch protection settings
- current docs and operational runbook

## Validation plan

- unit tests for schema and URL validation
- browser smoke tests for render stability under stale/missing data
- health-check dry runs with simulated stale or partial content
- CI run validation for required checks
- manual review of branch protection options and policy trade-offs

## Rollout and release notes

This work should be released as a trust and reliability improvement rather than a feature gimmick. It will likely be documented as:
- stronger validation and safety checks
- better stale-cache and sync-failure guidance
- clearer repository protection policy decisions
- more resilient operational behavior

## Status log

- 2026-10-21: Draft created
- 2026-10-21: Awaiting approval
