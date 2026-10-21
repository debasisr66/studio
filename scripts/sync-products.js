#!/usr/bin/env node
// Refreshes content/cache.json from the GitHub API. Read-only against product repos.
// No dependencies: uses Node's built-in fetch. A failing product never stops the others and never loses its previous entry,
// but it is never silent either: the run reports it and ends red AFTER the good products are written (SPEC-TR TR-05).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'content', 'products.json');
const CACHE = path.join(ROOT, 'content', 'cache.json');
const API = 'https://api.github.com';
const DRY_RUN = process.env.DRY_RUN === 'true';
const TOKEN = process.env.GH_TOKEN || '';
const MIN_REMAINING = 10;

let rateStop = false;

async function gh(p) {
  if (rateStop) throw Object.assign(new Error('rate-limit guard tripped; skipping ' + p), { rateLimited: true });
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'studio-sync' };
  if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
  const res = await fetch(API + p, { headers });
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (remaining !== null && Number(remaining) < MIN_REMAINING) {
    rateStop = true;
    console.warn(`::warning::Rate limit remaining ${remaining} < ${MIN_REMAINING}; stopping further fetches`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}`);
  return res.json();
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/* Pure: turns GitHub API payloads into the cache shape. pushed_at is kept to the day on purpose:
   every push to a product repo changes the exact timestamp, which used to rewrite cache.json
   (and create a commit) several times a day. The page only ever shows the date. */
function shapeProduct(info, rel) {
  const out = {
    description: info.description || '',
    stars: info.stargazers_count,
    language: info.language || '',
    topics: info.topics || [],
    pushed_at: (info.pushed_at || '').slice(0, 10),
    html_url: info.html_url,
    latest_release: null,
  };
  if (rel) {
    out.latest_release = {
      tag: rel.tag_name,
      name: rel.name || rel.tag_name,
      body: rel.body || '',
      published_at: rel.published_at,
      download_url: rel.html_url,
      assets: (rel.assets || []).map(a => ({
        name: a.name, download_url: a.browser_download_url, size: a.size,
      })),
    };
  }
  return out;
}

function hasChanged(prevProducts, nextProducts) {
  return JSON.stringify(nextProducts) !== JSON.stringify(prevProducts);
}

async function fetchProduct(repo) {
  const info = await gh(`/repos/${repo}`);
  if (!info) throw new Error('repo not found or not public');
  const rel = await gh(`/repos/${repo}/releases/latest`);
  return shapeProduct(info, rel);
}

function setOutput(k, v) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
}

async function main() {
  const registry = readJson(REGISTRY, null);
  if (!Array.isArray(registry)) {
    console.error('::error::content/products.json is missing or not an array; aborting without changes');
    setOutput('changed', 'false');
    process.exit(1);
  }
  const previous = readJson(CACHE, { products: {} });
  const prevProducts = (previous && previous.products) || {};
  const run = await collect(registry, prevProducts, fetchProduct);
  const next = run.next;
  const md = summaryMarkdown(run);
  if (md && process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  if (run.failures.length) {
    console.error(`::error::${run.failures.length} product(s) failed to sync; previous data kept: ${run.failures.map(f => f.repo).join(', ')}`);
    process.exitCode = 1;   // set now, exit later: good products are still written and committed
  }

  const changed = hasChanged(prevProducts, next);
  if (!changed) {
    console.log('No changes; cache.json left untouched.');
    setOutput('changed', 'false');
    return;
  }

  const doc = { synced_at: new Date().toISOString(), products: next };
  const text = JSON.stringify(doc, null, 2) + '\n';
  JSON.parse(text); // validate before touching disk

  if (DRY_RUN) {
    console.log('DRY RUN: would write content/cache.json:\n' + text);
    setOutput('changed', 'false');
    return;
  }
  fs.writeFileSync(CACHE, text);
  console.log('Wrote content/cache.json');
  setOutput('changed', 'true');
}

/* Fetches every visible product. A failure keeps the previous entry (if any) and is recorded; it never throws.
   fetcher(repo) is injected so tests need no network. Returns { next, failures: [{repo, kind, reason}], succeeded }. */
async function collect(registry, prevProducts, fetcher) {
  const next = {}, failures = [];
  let succeeded = 0;
  for (const entry of registry) {
    const repo = entry && entry.repo;
    if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      console.warn(`::warning::Skipping invalid registry entry: ${JSON.stringify(entry)}`);
      continue;
    }
    if (entry.hidden) continue;
    try {
      next[repo] = await fetcher(repo);
      succeeded++;
      console.log(`ok   ${repo}`);
    } catch (e) {
      console.warn(`::warning::fail ${repo}: ${e.message}`);
      failures.push({ repo, kind: e.rateLimited ? 'rate-limit' : 'error', reason: String(e.message) });
      if (prevProducts[repo]) next[repo] = prevProducts[repo]; // keep previous data rather than lose it
    }
  }
  return { next, failures, succeeded };
}

/* 'ok' (no failures), 'partial' (some products synced, some failed), 'failed' (none synced) */
function verdict(run) {
  if (!run.failures.length) return 'ok';
  return run.succeeded > 0 ? 'partial' : 'failed';
}

/* Step-summary text; empty when everything synced. Reasons come from API status lines only (never headers or tokens). */
function summaryMarkdown(run) {
  if (!run.failures.length) return '';
  const v = verdict(run);
  const rows = run.failures.map(f => `| ${f.repo} | ${f.kind === 'rate-limit' ? 'skipped: GitHub rate limit' : 'error'} | ${f.reason.replace(/\|/g, '/')} |`).join('\n');
  return `### Product sync: ${v.toUpperCase()}\n${run.succeeded} synced, ${run.failures.length} failed. Failed products keep their previous data.\n\n| Repo | Kind | Reason |\n|------|------|--------|\n${rows}\n\nFix steps: docs/RUNBOOK.md (sections "Sync failed or did not run", "GitHub rate limit").\n`;
}

module.exports = { shapeProduct, hasChanged, collect, verdict, summaryMarkdown };

if (require.main === module) {
  main().catch(e => {
    console.error('::error::sync failed: ' + e.message);
    setOutput('changed', 'false');
    process.exit(1);
  });
}
