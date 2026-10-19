#!/usr/bin/env node
// Daily health check. Read-only; no dependencies. Exits 1 (red run, GitHub emails the owner) when:
//   - the live site or its key files do not answer, or
//   - a product's latest GitHub release differs from what content/cache.json says (broken sync/dispatch).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = (process.env.HEALTH_URL || 'https://debasisr66.github.io/studio').replace(/\/$/, '');
const TOKEN = process.env.GH_TOKEN || '';
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/* Pure: which visible products have a cached release tag that differs from GitHub's latest.
   latestByRepo maps repo -> tag string or null (no release); a repo absent from the map had a fetch failure and is skipped. */
function findDrift(registry, cache, latestByRepo) {
  const out = [];
  for (const p of registry || []) {
    if (!p || !p.repo || p.hidden) continue;
    const entry = cache && cache.products && cache.products[p.repo];
    if (!entry) { if (p.repo in latestByRepo) out.push(`${p.repo}: not in cache.json at all`); continue; }
    if (!(p.repo in latestByRepo)) continue;
    const cached = (entry.latest_release && entry.latest_release.tag) || null;
    const live = latestByRepo[p.repo];
    if (cached !== live) out.push(`${p.repo}: cache says ${cached || 'no release'}, GitHub says ${live || 'no release'}`);
  }
  return out;
}

async function latestTag(repo) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'studio-health' };
  if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return (await res.json()).tag_name || null;
}

async function main() {
  const problems = [], notes = [];

  // 1. site is up and serves its key files
  for (const p of ['/', '/js/app.js', '/js/reads-lib.js', '/content/products.json', '/content/cache.json', '/content/reads.json', '/content/blog.json']) {
    try {
      const r = await fetch(SITE + p, { redirect: 'follow' });
      if (!r.ok) problems.push(`${SITE}${p} returned ${r.status}`);
      else if (p.endsWith('.json')) JSON.parse(await r.text());
    } catch (e) { problems.push(`${SITE}${p}: ${e.message}`); }
  }

  // 2. cache is in step with GitHub releases
  const registry = readJson('content/products.json');
  const cache = readJson('content/cache.json');
  const latest = {};
  for (const p of registry.filter(x => x && x.repo && !x.hidden)) {
    try { latest[p.repo] = await latestTag(p.repo); }
    catch (e) { notes.push(`could not check ${p.repo}: ${e.message}`); }
  }
  problems.push(...findDrift(registry, cache, latest));

  notes.forEach(n => console.log('note  ' + n));
  problems.forEach(p => console.log('ERROR ' + p));
  console.log(problems.length ? `\nUNHEALTHY: ${problems.length} problem(s)` : '\nHEALTHY: site answers and the cache matches GitHub releases');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Studio health: ${problems.length ? 'UNHEALTHY' : 'HEALTHY'}\n${problems.map(p => `- ❌ ${p}`).join('\n')}${notes.map(n => `\n- ℹ️ ${n}`).join('')}\n`);
  process.exit(problems.length ? 1 : 0);
}

module.exports = { findDrift };

if (require.main === module) main().catch(e => { console.error('::error::health check crashed: ' + e.message); process.exit(1); });
