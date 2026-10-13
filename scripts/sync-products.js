#!/usr/bin/env node
// Refreshes content/cache.json from the GitHub API. Read-only against product repos.
// No dependencies: uses Node's built-in fetch. Partial failures never abort the run.
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
  if (rateStop) throw new Error('rate-limit guard tripped; skipping ' + p);
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

async function fetchProduct(repo) {
  const info = await gh(`/repos/${repo}`);
  if (!info) throw new Error('repo not found or not public');
  const rel = await gh(`/repos/${repo}/releases/latest`);
  const out = {
    description: info.description || '',
    stars: info.stargazers_count,
    language: info.language || '',
    topics: info.topics || [],
    pushed_at: info.pushed_at,
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

function setOutput(k, v) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
}

(async () => {
  const registry = readJson(REGISTRY, null);
  if (!Array.isArray(registry)) {
    console.error('::error::content/products.json is missing or not an array; aborting without changes');
    setOutput('changed', 'false');
    process.exit(1);
  }
  const previous = readJson(CACHE, { products: {} });
  const prevProducts = (previous && previous.products) || {};
  const next = {};

  for (const entry of registry) {
    const repo = entry && entry.repo;
    if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      console.warn(`::warning::Skipping invalid registry entry: ${JSON.stringify(entry)}`);
      continue;
    }
    if (entry.hidden) continue;
    try {
      next[repo] = await fetchProduct(repo);
      console.log(`ok   ${repo}`);
    } catch (e) {
      console.warn(`::warning::fail ${repo}: ${e.message}`);
      if (prevProducts[repo]) next[repo] = prevProducts[repo]; // keep stale data rather than lose it
    }
  }

  const changed = JSON.stringify(next) !== JSON.stringify(prevProducts);
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
})().catch(e => {
  console.error('::error::sync failed: ' + e.message);
  setOutput('changed', 'false');
  process.exit(1);
});
