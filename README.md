# Studio by Debasis Ray

*Learning never ends!*

Product studio hub for [@debasisr66](https://github.com/debasisr66): one site that showcases small, focused products, with release notes, a blog and a reading list.

**Live:** https://debasisr66.github.io/studio/

## What it does

- **Products:** a card grid built from public GitHub repos, showing description, language, stars, latest version and a download link.
- **Updates:** a feed of the latest GitHub Releases, with notes and attached files.
- **What's new:** the version is shown in the footer and a **What's new** button lists every release in plain language.
- **Reads:** a curated reading list with a LinkedIn-style "Share a read…" composer (owner only), tag filters, search, and share buttons (LinkedIn, copy link, native share).
- **Profile photo and logo:** the owner can upload a profile photo in the admin layer; Studio has its own abstract logo.
- **Blog and Books:** editable in the browser through a small admin layer (⚙) that publishes straight to this repo.
- **Stays current by itself:** a nightly sync, plus an instant sync when a product repo publishes a release.

It is a plain static site: no build step, no npm, no frameworks, and nothing loaded from another site (fonts are self-hosted). Hosted on GitHub Pages from `main`, which is protected by branch rulesets; releases go through a pull request. A read-only safety net (CI checks on every push and a daily health check) watches content, security settings and the sync.

## How it fits together

```
product repo ── release / README push ──▶ notify workflow ──▶ studio sync ──▶ content/cache.json ──▶ site
```

Data flows one way: product repos notify the hub, and the hub only reads them. Details in [Architecture](docs/ARCHITECTURE.md).

## Repository layout

| Path | Purpose |
|------|---------|
| `index.html`, `css/site.css` | Page markup and the stylesheet (strict CSP: no inline script or style) |
| `fonts/`, `assets/logo.svg` | Self-hosted fonts (with licences) and the Studio logo |
| `js/app.js`, `js/reads-lib.js`, `js/token-store.js`, `js/image-lib.js` | Site logic and admin layer; pure helpers (unit-tested): reads, admin token and idle lock, profile photo rules |
| `tests/` | Node unit tests (`node --test tests/*.test.js`) |
| `scripts/validate-site.js`, `scripts/health-check.js` | CI validation and the daily health check |
| `content/products.json` | Registry of which repos to show (edit this to add a product) |
| `content/cache.json` | Live GitHub data, written by the sync workflow (do not edit) |
| `content/blog.json`, `content/reads.json` | Blog and reading content, edited via the admin layer |
| `content/changelog.json` | Release notes behind the footer version and What's new (edited by git) |
| `scripts/sync-products.js` | Sync script (Node, no dependencies) |
| `.github/workflows/sync.yml` | Nightly, on-dispatch and manual sync |
| `.github/workflows/ci.yml`, `health.yml` | Tests and validation on every push; daily health check (read-only) |
| `.github/workflows/keepalive.yml`, `.github/dependabot.yml` | Weekly keep-alive so scheduled workflows are not switched off; weekly Actions updates |
| `docs/rulesets/`, `docs/brand/` | Branch rulesets for `main`; logo concepts |
| `docs/` | Documentation and the notify workflow template |

## Add a product

1. Add an entry to `content/products.json`:
   ```json
   { "repo": "debasisr66/MyApp", "name": "My App", "tagline": "One line", "category": "Productivity", "featured": false, "hidden": false }
   ```
   Add `"url": "https://…"` if it has a live site.
2. Run `GH_TOKEN=$(gh auth token) node scripts/sync-products.js`, then commit and push.
3. For instant updates, copy [`docs/notify-studio.yml`](docs/notify-studio.yml) into that repo and add the `STUDIO_DISPATCH_TOKEN` secret. Without it, updates arrive with the nightly sync.

## Docs

- [Product introduction](docs/product-intro.md): what Studio is and how Penny sits in it (stability, capabilities, open limits)
- [Architecture](docs/ARCHITECTURE.md): how the hub works
- [Learning guide](docs/LEARNING-GUIDE.md): step-by-step setup, commands, tokens and the rotation runbook
- Release set (v1.3): [Security](docs/security.md) · [Impact](docs/impact.md) · [Plan](docs/plan.md) · [Design](docs/design.md) · [Tests and traceability](docs/test.md) · [Build commands](docs/build.md) · [Model use](docs/model-use.md)

## License

See [LICENSE](LICENSE).
