#!/usr/bin/env node
// Daily health check. Read-only; no dependencies. Exits 1 (red run, GitHub emails the owner) when:
//   - the live site or its key files do not answer, or
//   - a product's latest GitHub release differs from what content/cache.json says (broken sync/dispatch), or
//   - the sync workflow has not succeeded in the last 48 hours, or
//   - the newest finished CI run on main failed (CI is a process rule, not a required check, so a red main must be loud).
'use strict';
const fs = require('fs');
const path = require('path');
const RL = require('../js/reads-lib.js');
const CIRED = require('./ci-red.js');

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

/* CI is not a required check (the bots must push straight to main), so a red CI on main is made loud here instead. runs: ci.yml runs on main as the Actions API
   returns them (newest first). Only a finished run counts; cancelled runs (superseded by a newer push) and running ones are skipped. */
function findCiRed(runs) {
  var done = (Array.isArray(runs) ? runs : []).filter(function (r) { return r && r.status === 'completed' && r.conclusion && r.conclusion !== 'cancelled' && !isNaN(Date.parse(r.updated_at)); })
    .sort(function (a, b) { return Date.parse(b.updated_at) - Date.parse(a.updated_at); });
  if (!done.length || ['success', 'skipped', 'neutral'].includes(done[0].conclusion)) return [];
  return [`CI is red on main: the newest finished run ${done[0].conclusion} (${done[0].html_url || 'see the Actions tab'}, ${done[0].updated_at}).`];
}

/* Release parity beyond the tag (TR-07). releasesByRepo: repo -> latest release as GitHub returns it ({assets:[{name, browser_download_url}], tag_name?}) or null;
   a repo absent from the map was not fetched and is skipped. For products with a download_asset pattern: GitHub's release must contain a match,
   and the cached download link for that match must be GitHub's. (A different tag is findDrift's job and is not repeated here.) */
function findAssetParity(registry, cache, releasesByRepo) {
  const out = [];
  for (const p of registry || []) {
    if (!p || !p.repo || p.hidden || !p.download_asset || !(p.repo in releasesByRepo)) continue;
    const rel = releasesByRepo[p.repo];
    if (!rel) continue;
    const live = RL.pickAsset((rel.assets || []).map(a => ({ name: a.name, download_url: a.browser_download_url })), p.download_asset);
    if (!live) { out.push(`${p.repo}: configured download_asset "${p.download_asset}" matches no asset in the latest release`); continue; }
    const c = cache && cache.products && cache.products[p.repo] && cache.products[p.repo].latest_release;
    if (!c || (rel.tag_name !== undefined && c.tag !== rel.tag_name)) continue;
    const cached = RL.pickAsset(c.assets, p.download_asset);
    if (!cached || cached.download_url !== live.download_url)
      out.push(`${p.repo}: cached download for "${p.download_asset}" differs from GitHub (cache: ${cached ? cached.download_url : 'none'}, GitHub: ${live.download_url})`);
  }
  return out;
}

/* Warnings: cached repos that are hidden or no longer in the registry. */
function findOrphans(registry, cache) {
  const visible = new Set((registry || []).filter(p => p && p.repo && !p.hidden).map(p => p.repo));
  return Object.keys((cache && cache.products) || {}).filter(r => !visible.has(r))
    .map(r => `${r} is in cache.json but hidden or not in the registry (remove it from cache.json when convenient)`);
}

/* existsByRepo: repo -> true/false from GitHub (false = 404). Names visible products whose repository is gone. */
function findMissingRepos(registry, existsByRepo) {
  return (registry || []).filter(p => p && p.repo && !p.hidden && existsByRepo[p.repo] === false)
    .map(p => `${p.repo}: repository not found on GitHub (renamed, made private or deleted)`);
}

/* Every problem line carries a pointer to the matching runbook section (TR-08). */
const FIXES = [
  [/CI is red on main/i, 'ci-is-red-on-main'],
  [/last successful sync|no successful run/i, 'sync-failed-or-did-not-run'],
  [/not found on GitHub/i, 'sync-failed-or-did-not-run'],
  [/download_asset|cached download/i, 'release-or-download-missing'],
  [/disabled|is not active|will not run/i, 'scheduled-workflow-disabled'],
  [/cache says|not in cache\.json/i, 'stale-or-drifting-cache'],
  [/returned \d{3}|: (fetch failed|.*ECONN|.*ENOTFOUND)/i, 'live-site-files-404'],
];
function withFix(problem) {
  if (/Fix: docs\/RUNBOOK/.test(problem)) return problem;
  const hit = FIXES.find(([re]) => re.test(problem));
  return `${problem} Fix: docs/RUNBOOK.md#${hit ? hit[1] : 'stale-or-drifting-cache'}`;
}

async function latestRelease(repo) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'studio-health' };
  if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function repoExists(repo) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'studio-health' };
  if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
  const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return true;
}

async function main() {
  const problems = [], notes = [];

  // 1. site is up and serves its key files
  for (const p of ['/', '/css/site.css', '/assets/logo.svg', '/fonts/inter-latin.woff2', '/fonts/jetbrains-mono-latin.woff2', '/js/app.js', '/js/reads-lib.js', '/js/safe-lib.js', '/js/token-store.js', '/js/image-lib.js', '/content/products.json', '/content/cache.json', '/content/reads.json', '/content/blog.json', '/content/podcasts.json', '/content/changelog.json', '/content/profile.json']) {
    try {
      const r = await fetch(SITE + p, { redirect: 'follow' });
      if (!r.ok) problems.push(`${SITE}${p} returned ${r.status}`);
      else if (p.endsWith('.json')) JSON.parse(await r.text());
    } catch (e) { problems.push(`${SITE}${p}: ${e.message}`); }
  }

  // 2. cache is in step with GitHub releases
  const registry = readJson('content/products.json');
  const cache = readJson('content/cache.json');
  const latest = {}, releases = {}, exists = {};
  for (const p of registry.filter(x => x && x.repo && !x.hidden)) {
    try {
      const rel = await latestRelease(p.repo);
      releases[p.repo] = rel;
      latest[p.repo] = (rel && rel.tag_name) || null;
      if (!rel) exists[p.repo] = await repoExists(p.repo);   // no release: is it a missing repo or just unreleased?
    } catch (e) { notes.push(`could not check ${p.repo}: ${e.message}`); }
  }
  problems.push(...findMissingRepos(registry, exists));
  for (const r of Object.keys(exists).filter(r => exists[r] === false)) { delete latest[r]; delete releases[r]; }   // reported above; do not also call it drift
  problems.push(...findDrift(registry, cache, latest));
  problems.push(...findAssetParity(registry, cache, releases));
  findOrphans(registry, cache).forEach(w => notes.push('warning: ' + w));

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

  // 5. CI is green on main (a process rule only, see docs/rulesets/README.md)
  try {
    const repo = process.env.GITHUB_REPOSITORY || 'debasisr66/studio';
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'studio-health' };
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=5`, { headers });
    if (res.ok) {
      const runs = (await res.json()).workflow_runs;
      problems.push(...findCiRed(runs));
      // inside GitHub Actions only: open, update or close the one issue that carries the fix steps (a local run must not write anything)
      if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY) notes.push(await CIRED.syncIssue({ fetch, repo: process.env.GITHUB_REPOSITORY, token: TOKEN, runs, doc: fs.readFileSync(path.join(ROOT, CIRED.DOC), 'utf8') }));
    } else notes.push(`could not read CI runs: GitHub API ${res.status}`);
  } catch (e) { notes.push('could not read CI runs: ' + e.message); }

  notes.forEach(n => console.log('note  ' + n));
  const shown = problems.map(withFix);
  shown.forEach(p => console.log('ERROR ' + p));
  console.log(problems.length ? `\nUNHEALTHY: ${problems.length} problem(s)` : '\nHEALTHY: site answers and the cache matches GitHub releases');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Studio health: ${problems.length ? 'UNHEALTHY' : 'HEALTHY'}\n${shown.map(p => `- ❌ ${p}`).join('\n')}${notes.map(n => `\n- ℹ️ ${n}`).join('')}\n`);
  process.exit(problems.length ? 1 : 0);
}

module.exports = { findCiRed, findDrift, findInactiveWorkflows, findSyncStale, findAssetParity, findOrphans, findMissingRepos, withFix, SYNC_MAX_AGE_HOURS };

if (require.main === module) main().catch(e => { console.error('::error::health check crashed: ' + e.message); process.exit(1); });
