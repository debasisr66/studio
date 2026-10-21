#!/usr/bin/env node
// Daily health check. Read-only; no dependencies. Exits 1 (red run, GitHub emails the owner) when:
//   - the live site or its key files do not answer, or
//   - a product's latest GitHub release differs from what content/cache.json says (broken sync/dispatch), or
//   - the sync workflow has not succeeded in the last 48 hours.
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

/* GitHub switches scheduled workflows off (state "disabled_inactivity") after 60 days without repository activity. Name any that are not active. */
function findInactiveWorkflows(workflows) {
  return (Array.isArray(workflows) ? workflows : [])
    .filter(w => w && typeof w.name === 'string' && typeof w.state === 'string' && w.state !== 'active')
    .map(w => `workflow "${w.name}" is ${w.state}, so it will not run (re-enable: gh workflow enable "${w.name}")`);
}

/* Freshness = when the sync last SUCCEEDED, not how old cache.json is: synced_at only moves when data changes, so a quiet,
   healthy week would look stale. 48 h absorbs hours-late scheduling plus one missed night (SPEC-TR TR-06).
   runs: workflow runs of sync.yml as the Actions API returns them. A manual dry run that succeeds also counts (documented residual). */
const SYNC_MAX_AGE_HOURS = 48;
function findSyncStale(runs, now = Date.now(), maxHours = SYNC_MAX_AGE_HOURS) {
  const fix = ' Fix: docs/RUNBOOK.md#sync-failed-or-did-not-run';
  const good = (Array.isArray(runs) ? runs : []).filter(r => r && r.conclusion === 'success' && !isNaN(Date.parse(r.updated_at)))
    .map(r => Date.parse(r.updated_at));
  if (!good.length) return ['sync.yml has no successful run on record, so the cache may be stale.' + fix];
  const last = Math.max(...good), age = (now - last) / 3600e3;
  if (age > maxHours) return [`last successful sync was ${Math.floor(age)} hours ago (${new Date(last).toISOString()}); the limit is ${maxHours} hours.` + fix];
  return [];
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
  for (const p of ['/', '/css/site.css', '/assets/logo.svg', '/fonts/inter-latin.woff2', '/fonts/jetbrains-mono-latin.woff2', '/js/app.js', '/js/reads-lib.js', '/js/token-store.js', '/js/image-lib.js', '/content/products.json', '/content/cache.json', '/content/reads.json', '/content/blog.json', '/content/changelog.json', '/content/profile.json']) {
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

  // 3. every workflow is still enabled (scheduled ones are switched off after 60 inactive days)
  try {
    const repo = process.env.GITHUB_REPOSITORY || 'debasisr66/studio';
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'studio-health' };
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows`, { headers });
    if (res.ok) problems.push(...findInactiveWorkflows((await res.json()).workflows));
    else notes.push(`could not read workflow states: GitHub API ${res.status}`);
  } catch (e) { notes.push('could not read workflow states: ' + e.message); }

  // 4. the sync itself ran successfully recently (cache.json's own age is not a signal)
  try {
    const repo = process.env.GITHUB_REPOSITORY || 'debasisr66/studio';
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'studio-health' };
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/sync.yml/runs?status=success&per_page=5`, { headers });
    if (res.ok) problems.push(...findSyncStale((await res.json()).workflow_runs));
    else notes.push(`could not read sync runs: GitHub API ${res.status}`);
  } catch (e) { notes.push('could not read sync runs: ' + e.message); }

  notes.forEach(n => console.log('note  ' + n));
  problems.forEach(p => console.log('ERROR ' + p));
  console.log(problems.length ? `\nUNHEALTHY: ${problems.length} problem(s)` : '\nHEALTHY: site answers and the cache matches GitHub releases');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Studio health: ${problems.length ? 'UNHEALTHY' : 'HEALTHY'}\n${problems.map(p => `- ❌ ${p}`).join('\n')}${notes.map(n => `\n- ℹ️ ${n}`).join('')}\n`);
  process.exit(problems.length ? 1 : 0);
}

module.exports = { findDrift, findInactiveWorkflows, findSyncStale, SYNC_MAX_AGE_HOURS };

if (require.main === module) main().catch(e => { console.error('::error::health check crashed: ' + e.message); process.exit(1); });
