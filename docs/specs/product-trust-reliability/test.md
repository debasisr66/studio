# Test plan: Product trust and reliability

## Objective

Validate that Studio’s reliability and trust improvements work as intended and that they fail safely under broken or stale data conditions.

## Test strategy

The testing approach combines:
- unit tests for validation logic
- smoke tests for UI and rendering stability
- health-check simulations for stale or missing data
- CI and workflow review for policy enforcement

## Test environments

- local Node-based validation tests
- GitHub Actions CI runners
- manual browser smoke checks
- test fixture JSON files for malformed, stale, and missing data

## Unit tests

### 1. Product registry validation
- [ ] rejects a missing repo field
- [ ] rejects invalid URL schemes
- [ ] rejects malformed category or type values
- [ ] accepts known-good product entries
- [ ] rejects a product with empty required display text

### 2. Cache validation
- [ ] rejects a missing `synced_at`
- [ ] rejects missing `products` object
- [ ] rejects invalid release metadata
- [ ] flags stale cache timestamps
- [ ] preserves prior valid data when a validation step fails

### 3. Reads/blog content validation
- [ ] rejects malformed JSON
- [ ] rejects missing required fields
- [ ] prevents invalid article or reads entry shapes
- [ ] allows known-good content items

### 4. URL safety checks
- [ ] accepts `https://example.com`
- [ ] accepts `http://example.com`
- [ ] rejects `javascript:alert(1)`
- [ ] rejects `data:text/html,...`
- [ ] rejects empty or malformed URLs
- [ ] rejects URLs with dangerous whitespace or control characters

## Browser smoke tests

- [ ] page loads normally with valid data
- [ ] page remains usable when a product entry is missing a field
- [ ] page remains usable when one product repo is unavailable
- [ ] page remains usable when release metadata is missing
- [ ] stale sync state does not break public rendering
- [ ] no CSP regression appears after validation changes
- [ ] admin modal and owner flow still works when validation is active

## Health-check scenarios

- [ ] stale cache is detected
- [ ] empty or missing cache file is detected
- [ ] missing release metadata is detected
- [ ] mismatched product count or partial sync is detected
- [ ] healthy cache passes without warnings
- [ ] health output gives actionable recovery guidance

## CI and policy review

- [ ] CI fails on malformed data fixtures
- [ ] CI passes for valid repo content
- [ ] repo protection policy is documented and reviewed
- [ ] recommended rule for required CI / branch protection is clearly documented

## Acceptance validation

This initiative is successful if:
- validation failures are explicit and actionable
- stale or invalid data is caught before it misleads users
- the owner can recover from sync issues without guesswork
- the repo protection policy is documented and intentional

## Status log

- 2026-10-21: Draft created
