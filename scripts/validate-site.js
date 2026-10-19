#!/usr/bin/env node
// Validates content files and the site shell. Read-only; no dependencies.
// Exit code 1 on any error (warnings never fail). Used by CI and runnable locally.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RL = require('../js/reads-lib.js');

const ROOT = path.resolve(__dirname, '..');
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string';
const httpUrl = u => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } };

// size budgets in bytes: generous versus today's sizes, tight enough to catch accidental bloat
const BUDGETS = { 'index.html': 60 * 1024, 'js/app.js': 80 * 1024, 'js/reads-lib.js': 20 * 1024, total: 150 * 1024 };

function validateProducts(list) {
  if (!Array.isArray(list)) return ['products.json: must be an array'];
  const errors = [], seen = new Set();
  list.forEach((p, i) => {
    const at = `products.json[${i}]`;
    if (!isObj(p)) return errors.push(`${at}: must be an object`);
    if (!isStr(p.repo) || !REPO_RE.test(p.repo)) errors.push(`${at}: repo must look like owner/name`);
    else if (seen.has(p.repo.toLowerCase())) errors.push(`${at}: duplicate repo ${p.repo}`);
    else seen.add(p.repo.toLowerCase());
    for (const k of ['slug', 'name', 'tagline', 'category', 'download_asset']) if (p[k] !== undefined && !isStr(p[k])) errors.push(`${at}: ${k} must be a string`);
    for (const k of ['featured', 'hidden']) if (p[k] !== undefined && typeof p[k] !== 'boolean') errors.push(`${at}: ${k} must be true or false`);
    if (p.url !== undefined && !(isStr(p.url) && httpUrl(p.url))) errors.push(`${at}: url must be an http(s) address`);
  });
  return errors;
}

function validateCache(cache, registry) {
  const errors = [], warnings = [];
  if (!isObj(cache) || !isObj(cache.products)) return { errors: ['cache.json: needs a products object'], warnings };
  for (const [repo, c] of Object.entries(cache.products)) {
    const at = `cache.json[${repo}]`;
    if (!isObj(c)) { errors.push(`${at}: must be an object`); continue; }
    if (typeof c.stars !== 'number') errors.push(`${at}: stars must be a number`);
    if (c.html_url !== undefined && !httpUrl(c.html_url)) errors.push(`${at}: html_url must be an http(s) address`);
    const r = c.latest_release;
    if (r !== null && r !== undefined) {
      if (!isObj(r)) { errors.push(`${at}: latest_release must be an object or null`); continue; }
      if (!isStr(r.tag) || !r.tag) errors.push(`${at}: latest_release.tag is required`);
      if (!httpUrl(r.download_url)) errors.push(`${at}: latest_release.download_url must be an http(s) address`);
      if (!Array.isArray(r.assets)) errors.push(`${at}: latest_release.assets must be an array`);
      else r.assets.forEach((a, i) => { if (!isObj(a) || !isStr(a.name) || !httpUrl(a.download_url)) errors.push(`${at}: assets[${i}] needs a name and an http(s) download_url`); });
    }
  }
  if (Array.isArray(registry)) registry.filter(p => p && p.repo && !p.hidden && !cache.products[p.repo])
    .forEach(p => warnings.push(`cache.json: no cached data yet for ${p.repo} (the next sync will add it)`));
  return { errors, warnings };
}

function validateBlog(blog) {
  if (!isObj(blog) || !Array.isArray(blog.posts)) return ['blog.json: needs a posts array'];
  const errors = [];
  blog.posts.forEach((p, i) => {
    const at = `blog.json[${i}]`;
    if (!isObj(p)) return errors.push(`${at}: must be an object`);
    if (!DATE_RE.test(String(p.date))) errors.push(`${at}: date must be YYYY-MM-DD`);
    if (!isStr(p.title) || !p.title.trim()) errors.push(`${at}: title is required`);
    if (!isStr(p.body) || !p.body.trim()) errors.push(`${at}: body is required`);
    if (p.link && !(isStr(p.link) && httpUrl(p.link))) errors.push(`${at}: link must be an http(s) address`);
  });
  return errors;
}

function validateReads(reads) {
  const errors = [], warnings = [];
  if (!isObj(reads) || !Array.isArray(reads.articles) || !Array.isArray(reads.books))
    return { errors: ['reads.json: needs articles and books arrays'], warnings };
  const ids = new Set(), urls = new Set();
  reads.articles.forEach((a, i) => {
    const at = `reads.json articles[${i}]`;
    if (!isObj(a)) return errors.push(`${at}: must be an object`);
    if (!isStr(a.title) || !a.title.trim()) errors.push(`${at}: title is required`);
    const clean = isStr(a.url) ? RL.normalizeUrl(a.url) : null;
    if (!clean) errors.push(`${at}: url must be a safe http(s) address`);
    else { const k = RL.domainOf(clean) + new URL(clean).pathname.replace(/\/+$/, ''); if (urls.has(k)) warnings.push(`${at}: same link as an earlier read`); urls.add(k); }
    if (a.kind !== undefined && !RL.KINDS.includes(a.kind)) errors.push(`${at}: kind must be one of ${RL.KINDS.join(', ')}`);
    if (a.tags !== undefined && (!Array.isArray(a.tags) || a.tags.length > RL.LIMITS.tags || a.tags.some(t => !isStr(t)))) errors.push(`${at}: tags must be an array of at most ${RL.LIMITS.tags} strings`);
    if (a.comment !== undefined && (!isStr(a.comment) || a.comment.length > RL.LIMITS.comment)) errors.push(`${at}: comment must be text up to ${RL.LIMITS.comment} characters`);
    if (a.added !== undefined && !DATE_RE.test(String(a.added))) errors.push(`${at}: added must be YYYY-MM-DD`);
    if (a.id !== undefined) { if (ids.has(a.id)) errors.push(`${at}: duplicate id ${a.id}`); ids.add(a.id); }
  });
  reads.books.forEach((b, i) => {
    if (!isObj(b) || !isStr(b.title) || !b.title.trim()) errors.push(`reads.json books[${i}]: title is required`);
  });
  return { errors, warnings };
}

function validateIndex(html, exists) {
  const errors = [];
  if (!/<html[^>]*\blang="[a-z-]+"/i.test(html)) errors.push('index.html: <html> needs a lang attribute');
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push('index.html: needs a <title>');
  if (!/name="viewport"/i.test(html)) errors.push('index.html: needs a viewport meta tag');
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
  if (!csp) errors.push('index.html: Content-Security-Policy meta tag is missing');
  else {
    const script = (csp[1].match(/script-src([^;]*)/) || [, ''])[1];
    if (/unsafe-inline|unsafe-eval/.test(script)) errors.push("index.html: CSP script-src must not allow 'unsafe-inline' or 'unsafe-eval'");
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push('index.html: inline <script> found (the CSP forbids it); move it to js/');
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"#?]+)"/gi)) {
    const ref = m[1];
    if (/^(https?:|data:|\/\/)/i.test(ref) || ref.startsWith('#')) continue;
    if (!exists(ref)) errors.push(`index.html: references ${ref}, which does not exist`);
  }
  return errors;
}

function checkSizes(sizes) {
  const errors = [];
  let total = 0;
  for (const [f, n] of Object.entries(sizes)) {
    total += n;
    if (BUDGETS[f] && n > BUDGETS[f]) errors.push(`${f}: ${n} bytes exceeds the ${BUDGETS[f]}-byte budget`);
  }
  if (total > BUDGETS.total) errors.push(`total: ${total} bytes exceeds the ${BUDGETS.total}-byte budget`);
  return errors;
}

function checkSyntax(sources) {
  const errors = [];
  for (const [f, src] of Object.entries(sources)) {
    try { new vm.Script(src, { filename: f }); } catch (e) { errors.push(`${f}: syntax error: ${e.message}`); }
  }
  return errors;
}

function run() {
  const errors = [], warnings = [];
  const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const json = rel => { try { return JSON.parse(read(rel)); } catch (e) { errors.push(`${rel}: ${e.message}`); return undefined; } };

  const registry = json('content/products.json');
  if (registry !== undefined) errors.push(...validateProducts(registry));
  const cache = json('content/cache.json');
  if (cache !== undefined) { const r = validateCache(cache, registry); errors.push(...r.errors); warnings.push(...r.warnings); }
  const blog = json('content/blog.json');
  if (blog !== undefined) errors.push(...validateBlog(blog));
  const reads = json('content/reads.json');
  if (reads !== undefined) { const r = validateReads(reads); errors.push(...r.errors); warnings.push(...r.warnings); }

  const html = read('index.html');
  errors.push(...validateIndex(html, ref => fs.existsSync(path.join(ROOT, ref))));

  const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
  const sizes = Object.fromEntries(files.map(f => [f, Buffer.byteLength(read(f))]));
  errors.push(...checkSizes(sizes));
  errors.push(...checkSyntax(Object.fromEntries(files.filter(f => f.endsWith('.js')).map(f => [f, read(f)]))));
  return { errors, warnings, sizes };
}

module.exports = { validateProducts, validateCache, validateBlog, validateReads, validateIndex, checkSizes, checkSyntax, BUDGETS };

if (require.main === module) {
  const { errors, warnings, sizes } = run();
  warnings.forEach(w => console.log('warn  ' + w));
  errors.forEach(e => console.log('ERROR ' + e));
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  console.log(`\n${errors.length ? 'FAILED' : 'OK'}: ${errors.length} error(s), ${warnings.length} warning(s); ${Object.keys(sizes).length} files, ${total} bytes`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Site validation: ${errors.length ? 'FAILED' : 'OK'}\n${errors.map(e => `- ❌ ${e}`).join('\n')}${warnings.map(w => `\n- ⚠️ ${w}`).join('')}\n`);
  process.exit(errors.length ? 1 : 0);
}
