#!/usr/bin/env node
// Validates content files and the site shell. Read-only; no dependencies.
// Exit code 1 on any error (warnings never fail). Used by CI and runnable locally.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RL = require('../js/reads-lib.js');
const IL = require('../js/image-lib.js');

const ROOT = path.resolve(__dirname, '..');
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string';
const httpUrl = RL.isPublishableUrl;   // strict rule, one source (TR-01): http(s) only, no whitespace/control characters, no credentials, <= 2048 chars
// SH-06: compare the parsed hostname only after the shared clean-URL check.
const githubUrl = value => httpUrl(value) && new URL(value).hostname === 'github.com';
const RELEASE_URL_HINT = 'a clean http(s) address hosted on github.com (no spaces, control characters or login details)';
// SH-06 leaves the numeric bound open; 64 UTF-16 code units keeps badges short.
const VERSION_TEXT_MAX = 64;
const URL_HINT = 'a clean http(s) address (no spaces, control characters or login details)';
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KNOWN_CATEGORIES = ['Productivity', 'Information', 'Tools', 'Education', 'Finance', 'Health', 'Developer', 'Writing'];
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// size budgets in bytes: generous versus today's sizes, tight enough to catch accidental bloat (reads-lib.js 20 -> 26 KB for the Quick add helpers, SPEC-QA Phase A, 2026-10-23; 26 -> 30 KB on 2026-10-27 after the shared whole-file validators left it at 26,582 of 26,624 bytes; 30 -> 34 KB and total 150 -> 160 KB on 2026-10-27 as an owner decision, then the library was split in four files (reads-lib.js 24 KB, podcast-lib.js 10, status-lib.js 6, quickadd-lib.js 8) the same day, after the library reached 28.7 KB and the total 148.9 KB: raw size matters little (about 35 to 40 KB compressed over the wire) and the guard stays, only wider; a split moves bytes but does not remove them)
const BUDGETS = { 'index.html': 60 * 1024, 'css/site.css': 30 * 1024, 'js/app.js': 80 * 1024, 'js/reads-lib.js': 24 * 1024, 'js/podcast-lib.js': 10 * 1024, 'js/status-lib.js': 6 * 1024, 'js/quickadd-lib.js': 8 * 1024, 'js/safe-lib.js': 10 * 1024, 'js/token-store.js': 10 * 1024, 'js/image-lib.js': 10 * 1024, total: 160 * 1024 };

function validateProducts(list) {
  if (!Array.isArray(list)) return ['products.json: must be an array'];
  const errors = [], seen = new Set(), slugs = new Set();
  list.forEach((p, i) => {
    const at = `products.json[${i}]`;
    if (!isObj(p)) return errors.push(`${at}: must be an object`);
    if (!isStr(p.repo) || !REPO_RE.test(p.repo)) errors.push(`${at}: repo must look like owner/name`);
    else if (seen.has(p.repo.toLowerCase())) errors.push(`${at}: duplicate repo ${p.repo}`);
    else seen.add(p.repo.toLowerCase());
    for (const k of ['slug', 'name', 'tagline', 'category', 'download_asset']) if (p[k] !== undefined && !isStr(p[k])) errors.push(`${at}: ${k} must be a string`);
    for (const k of ['featured', 'hidden']) if (p[k] !== undefined && typeof p[k] !== 'boolean') errors.push(`${at}: ${k} must be true or false`);
    if (p.url !== undefined && !(isStr(p.url) && httpUrl(p.url))) errors.push(`${at}: url must be ${URL_HINT}`);
    if (p.slug !== undefined && isStr(p.slug)) {
      if (!SLUG_RE.test(p.slug)) errors.push(`${at}: slug must be lowercase letters, digits and hyphens only (got "${p.slug}")`);
      else if (slugs.has(p.slug)) errors.push(`${at}: duplicate slug ${p.slug}`);
      else slugs.add(p.slug);
    }
    if (p.category !== undefined && isStr(p.category) && !p.category.trim()) errors.push(`${at}: category must not be empty`);
  });
  return errors;
}

/* Soft checks on the registry: never fail CI. */
function productWarnings(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(p => isObj(p) && isStr(p.category) && p.category.trim() && !KNOWN_CATEGORIES.includes(p.category))
    .map(p => `products.json: unknown category "${p.category}" for ${p.repo} (known: ${KNOWN_CATEGORIES.join(', ')}); add it to KNOWN_CATEGORIES on purpose`);
}

function validateCache(cache, registry, now = Date.now()) {
  const errors = [], warnings = [];
  if (!isObj(cache) || !isObj(cache.products)) return { errors: ['cache.json: needs a products object'], warnings };
  if (!isStr(cache.synced_at) || !ISO_UTC_RE.test(cache.synced_at) || isNaN(Date.parse(cache.synced_at))) errors.push('cache.json: synced_at is required and must be an ISO-8601 UTC time (like 2026-10-21T03:00:00Z)');
  else if (Date.parse(cache.synced_at) > now + FUTURE_TOLERANCE_MS) errors.push(`cache.json: synced_at (${cache.synced_at}) is in the future`);
  const visible = new Set(Array.isArray(registry) ? registry.filter(p => p && p.repo && !p.hidden).map(p => p.repo) : []);
  for (const [repo, c] of Object.entries(cache.products)) {
    const at = `cache.json[${repo}]`;
    if (!isObj(c)) { errors.push(`${at}: must be an object`); continue; }
    if (Array.isArray(registry) && !visible.has(repo)) warnings.push(`${at}: cached repo is hidden or not in the registry (remove it from cache.json when convenient)`);
    if (!Number.isInteger(c.stars) || c.stars < 0) errors.push(`${at}: stars must be a whole number, 0 or more`);
  
    if (c.html_url !== undefined && !httpUrl(c.html_url)) errors.push(`${at}: html_url must be ${URL_HINT}`);
    const r = c.latest_release;
    if (r !== null && r !== undefined) {
      if (!isObj(r)) { errors.push(`${at}: latest_release must be an object or null`); continue; }
      if (!isStr(r.tag) || !r.tag) errors.push(`${at}: latest_release.tag is required`);
      if (isStr(r.tag) && r.tag.length > VERSION_TEXT_MAX) errors.push(`${at}: latest_release.tag must be at most ${VERSION_TEXT_MAX} characters`);
      if (!githubUrl(r.download_url)) errors.push(`${at}: latest_release.download_url must be ${RELEASE_URL_HINT}`);
      if (!Array.isArray(r.assets)) errors.push(`${at}: latest_release.assets must be an array`);
      else r.assets.forEach((a, i) => {
        if (!isObj(a)) { errors.push(`${at}: assets[${i}] must be an object`); return; }
        if (!isStr(a.name)) errors.push(`${at}: assets[${i}].name must be a string`);
        if (!githubUrl(a.download_url)) errors.push(`${at}: assets[${i}].download_url must be ${RELEASE_URL_HINT}`);
        if (!Number.isInteger(a.size) || a.size < 0) errors.push(`${at}: assets[${i}].size must be a non-negative integer`);
      });
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
    if (p.link && !(isStr(p.link) && httpUrl(p.link))) errors.push(`${at}: link must be ${URL_HINT}`);
  });
  return errors;
}

/* The rules live in js/reads-lib.js (validateReadsFile) so the admin screen runs the very same check before every publish. */
const validateReads = reads => RL.validateReadsFile(reads);

/* SPEC-PC PC-04. The rules live in js/podcast-lib.js (validatePodcastsFile) so the admin screen runs the very same check before every publish. */
const validatePodcasts = file => RL.validatePodcastsFile(file);

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
  if (csp) {
    const style = (csp[1].match(/style-src([^;]*)/) || [, ''])[1];
    if (/unsafe-inline|unsafe-eval/.test(style)) errors.push("index.html: CSP style-src must not allow 'unsafe-inline' or 'unsafe-eval'");
    for (const dir of ['style-src', 'font-src']) {
      const val = (csp[1].match(new RegExp(dir + '([^;]*)')) || [, ''])[1];
      const hosts = val.split(/\s+/).filter(tok => tok && tok !== "'self'" && tok !== "'none'");
      if (hosts.length) errors.push(`index.html: CSP ${dir} allows third-party sources (${hosts.join(' ')}); fonts and styles must be self-hosted`);
    }
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push('index.html: inline <script> found (the CSP forbids it); move it to js/');
  if (/<style[\s>]/i.test(html)) errors.push('index.html: inline <style> block found (the CSP forbids it); move it to css/site.css');
  if (/<[a-z][^>]*\sstyle\s*=/i.test(html)) errors.push('index.html: style= attribute found (the CSP forbids it); use a class');
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/gi)) {
    const ref = m[1].split(/[?#]/)[0];
    if (/^(https?:)?\/\//i.test(ref)) { errors.push(`index.html: references an external resource (${ref}); self-host it`); continue; }
    if (/^data:/i.test(ref) || ref.startsWith('#')) continue;
    if (!exists(ref)) errors.push(`index.html: references ${ref}, which does not exist`);
  }
  return errors;
}

/* JS that builds markup must not emit style attributes (blocked by the CSP); use classes, or element.style.setProperty. */
function checkNoInlineStyles(sources) {
  const errors = [];
  for (const [f, src] of Object.entries(sources)) {
    if (/\sstyle\s*=\s*\\?["']/i.test(src) || /setAttribute\(\s*['"]style['"]/.test(src))
      errors.push(`${f}: generates a style attribute (the CSP forbids it); use a class or element.style.setProperty`);
  }
  return errors;
}

const VERSION_RE = /^\d+\.\d+(\.\d+)?$/;
const vparts = v => v.split('.').map(Number);
function vcompare(a, b) {
  const x = vparts(a), y = vparts(b);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}
const plainText = t => isStr(t) && !/[<>]/.test(t);

function validateChangelog(c) {
  if (!isObj(c) || !Array.isArray(c.releases) || !c.releases.length) return ['changelog.json: needs a non-empty releases array'];
  const errors = [];
  c.releases.forEach((r, i) => {
    const at = `changelog.json[${i}]`;
    if (!isObj(r)) return errors.push(`${at}: must be an object`);
    if (!isStr(r.version) || r.version.length > VERSION_TEXT_MAX || !VERSION_RE.test(r.version)) errors.push(`${at}: version must look like 1.3 or 1.3.1 (at most ${VERSION_TEXT_MAX} characters)`);
    else if (i > 0 && isObj(c.releases[i - 1]) && isStr(c.releases[i - 1].version) && VERSION_RE.test(c.releases[i - 1].version)) {
      const d = vcompare(c.releases[i - 1].version, r.version);
      if (d === 0) errors.push(`${at}: duplicate version ${r.version}`);
      else if (d < 0) errors.push(`${at}: versions must be in descending order (newest first)`);
    }
    if (!DATE_RE.test(String(r.date))) errors.push(`${at}: date must be YYYY-MM-DD`);
    if (!isStr(r.title) || !r.title.trim() || r.title.length > 80) errors.push(`${at}: title is required (up to 80 characters)`);
    else if (!plainText(r.title)) errors.push(`${at}: title must be plain text (no markup)`);
    if (!Array.isArray(r.items) || r.items.length < 1 || r.items.length > 6) errors.push(`${at}: items must be a list of 1 to 6 entries`);
    else r.items.forEach((t, j) => {
      if (!isStr(t) || !t.trim() || t.length > 160) errors.push(`${at}: items[${j}] must be text up to 160 characters`);
      else if (!plainText(t)) errors.push(`${at}: items[${j}] must be plain text (no markup)`);
      else if (/https?:\/\/|www\./i.test(t)) errors.push(`${at}: items[${j}] must not contain links`);
    });
    if (isStr(r.title) && /https?:\/\/|www\./i.test(r.title)) errors.push(`${at}: title must not contain links`);
  });
  return errors;
}

/* CSS may not pull anything from other hosts; relative url() targets must exist. exists(path) takes a repo-relative path. */
function checkCss(sources, exists) {
  const errors = [];
  for (const [file, css] of Object.entries(sources)) {
    if (/@import/i.test(css)) errors.push(`${file}: @import is not allowed (external or chained styles)`);
    for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
      const ref = m[2].trim();
      if (/^(https?:)?\/\//i.test(ref)) { errors.push(`${file}: external url(${ref}); self-host it`); continue; }
      if (/^data:/i.test(ref)) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), ref.split(/[?#]/)[0]));
      if (!exists(target)) errors.push(`${file}: url(${ref}) points to ${target}, which does not exist`);
    }
  }
  return errors;
}

const FONT_BUDGET = 150 * 1024;
const squash = n => n.toLowerCase().replace(/[^a-z0-9]/g, '');
/* every font file needs a licence file beside it (SIL OFL requires the notice to travel with the font) */
function checkFonts(sizes, licenceFiles) {
  const errors = [];
  const lic = (licenceFiles || []).map(f => squash(path.posix.basename(f).replace(/^license-?/i, '').replace(/\.txt$/i, '')));
  for (const [file, size] of Object.entries(sizes)) {
    if (!/\.woff2?$/i.test(file)) continue;
    if (size > FONT_BUDGET) errors.push(`${file}: ${size} bytes exceeds the ${FONT_BUDGET}-byte font budget`);
    const base = squash(path.posix.basename(file).replace(/\.woff2?$/i, ''));
    if (!lic.some(l => l && base.startsWith(l))) errors.push(`${file}: no licence file (expected fonts/LICENSE-<Family>.txt)`);
  }
  return errors;
}

/* The page shows amounts in rupees. A self-hosted face that lacks U+20B9 makes the browser fall back to another font for the sign
   (found in v1.4 testing: Latin-only subset). Require every declared Inter face set to cover it. */
function parseRanges(list) {
  return list.split(',').map(t => t.trim().replace(/^U\+/i, '')).filter(Boolean).map(t => {
    const [a, b] = t.split('-'); return [parseInt(a, 16), parseInt(b || a, 16)];
  });
}
function checkFontCoverage(sources, codepoints = [0x20B9]) {
  const errors = [];
  for (const [file, css] of Object.entries(sources)) {
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/gi)].map(m => m[1]).filter(b => /font-family\s*:\s*['"]?Inter['"]?/i.test(b));
    if (!faces.length) continue;
    const ranges = faces.map(b => { const u = b.match(/unicode-range\s*:\s*([^;}]+)/i); return u ? parseRanges(u[1]) : null; });
    if (ranges.some(r => r === null)) continue;                        // a face without unicode-range covers everything
    for (const cp of codepoints) {
      if (!ranges.some(rs => rs.some(([a, b]) => cp >= a && cp <= b)))
        errors.push(`${file}: the Inter font faces do not cover U+${cp.toString(16).toUpperCase()}; add the Latin Extended subset`);
    }
  }
  return errors;
}

/* A cut-and-paste slip once removed the colour tokens from the stylesheet and left the page unstyled (v1.4). Guard against it. */
function checkCssSanity(sources) {
  const errors = [];
  const css = sources['css/site.css'];
  if (css === undefined) return errors;
  if (!/:root\s*\{[^}]*--bg\s*:/.test(css)) errors.push('css/site.css: the :root design tokens (--bg and the rest) are missing; the page would render unstyled');
  if (!/:root\[data-theme=["']light["']\]\s*\{/.test(css)) errors.push('css/site.css: the light theme tokens (:root[data-theme="light"]) are missing');
  return errors;
}

/* SVG files can carry script and external loads. Allow plain shapes only (the xmlns declaration URLs are namespaces, not loads). */
const SVG_BUDGET = 30 * 1024;
function checkSvg(sources) {
  const errors = [];
  for (const [file, svg] of Object.entries(sources)) {
    if (svg.length > SVG_BUDGET) errors.push(`${file}: ${svg.length} bytes exceeds the ${SVG_BUDGET}-byte SVG size budget`);
    if (/<script/i.test(svg)) errors.push(`${file}: contains a <script> element`);
    if (/\son[a-z]+\s*=/i.test(svg)) errors.push(`${file}: contains an event-handler attribute`);
    if (/<foreignObject/i.test(svg)) errors.push(`${file}: contains <foreignObject>`);
    if (/javascript:/i.test(svg)) errors.push(`${file}: contains a javascript: URL`);
    if (/(?:xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\//i.test(svg) || /url\(\s*["']?\s*(?:https?:)?\/\//i.test(svg))
      errors.push(`${file}: references an external resource`);
  }
  return errors;
}

/* content/profile.jpg is written by the admin screen. Whatever lands there must really be a small, square-ish JPEG. */
const PROFILE_MAX_BYTES = 200 * 1024, PROFILE_MAX_SIDE = 1024;
function validateProfileImage(buf) {
  const errors = [];
  const info = IL.jpegInfo(buf);
  if (!info.ok) return ['content/profile.jpg: is not a valid JPEG (the file must begin with the JPEG signature and have a readable frame header)'];
  if (buf.length > PROFILE_MAX_BYTES) errors.push(`content/profile.jpg: ${buf.length} bytes exceeds the ${PROFILE_MAX_BYTES}-byte (200 KB) budget`);
  if (info.width > PROFILE_MAX_SIDE || info.height > PROFILE_MAX_SIDE) errors.push(`content/profile.jpg: ${info.width}x${info.height} is larger than ${PROFILE_MAX_SIDE}x${PROFILE_MAX_SIDE} pixels`);
  if (info.width < IL.LIMITS.minSide || info.height < IL.LIMITS.minSide) errors.push(`content/profile.jpg: ${info.width}x${info.height} is too small (at least ${IL.LIMITS.minSide} pixels on each side)`);
  return errors;
}

/* content/profile.json says whether a photo is shown and carries the version used to bust caches. The path is restricted so
   the manifest can never point the page at another site. */
function validateProfileManifest(m, exists) {
  const errors = [], warnings = [];
  if (!isObj(m) || !('photo' in m) || !('updated' in m)) return { errors: ['content/profile.json: needs "photo" and "updated" (both may be null)'], warnings };
  if (m.photo !== null && !(isStr(m.photo) && /^content\/[A-Za-z0-9._-]+\.jpg$/.test(m.photo) && !m.photo.includes('..'))) errors.push('content/profile.json: photo must be null or a path like content/profile.jpg');
  if (m.photo === null && m.updated !== null) errors.push('content/profile.json: updated must be null when there is no photo');
  if (m.photo !== null && !(isStr(m.updated) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(m.updated))) errors.push('content/profile.json: updated must be an ISO timestamp (UTC) when a photo is set');
  if (isStr(m.photo) && errors.length === 0 && !exists(m.photo)) errors.push(`content/profile.json: photo points to ${m.photo}, which does not exist`);
  if (m.photo === null && exists('content/profile.jpg')) warnings.push('content/profile.jpg exists but profile.json does not show it (publish again to include it)');
  return { errors, warnings };
}

/* Workflow hygiene: actions pinned by commit hash, permissions always declared, write access only where a bot must commit. */
const WRITE_ALLOWED = ['sync.yml', 'keepalive.yml'];
function checkWorkflows(sources) {
  const errors = [];
  for (const [file, text] of Object.entries(sources)) {
    const base = path.posix.basename(file);
    for (const m of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
      const ref = m[1];
      if (ref.startsWith('./')) continue;
      const at = ref.split('@')[1];
      if (!at || !/^[0-9a-f]{40}$/.test(at)) errors.push(`${file}: ${ref} is not pinned by a 40-character commit hash`);
    }
    if (!/^permissions\s*:/m.test(text)) { errors.push(`${file}: no top-level permissions block (declare the minimum)`); continue; }
    // every permissions key at any depth (job-level blocks too): a write-all anywhere, or a write that is not on the allowed list, is refused
    const lines = text.split('\n').map(l => l.replace(/["']/g, ''));   // quoted keys and values are the same permission to GitHub
    // Known limit: YAML aliases and anchors are not followed (changing a workflow needs commit access to main anyway); see docs/CI-RED-FIX.md and the review record.
    lines.forEach((ln, i) => {
      const m = ln.match(/^([ \t]*)permissions\s*:\s*([^#\n]*)/);
      if (!m) return;
      if (/^write-all\b/.test(m[2].trim())) { errors.push(`${file}: permissions: write-all is not allowed`); return; }
      const flow = m[2].match(/^\{([^}]*)\}/);   // permissions: { contents: write }
      if (flow) {
        for (const w of flow[1].matchAll(/([a-z-]+)\s*:\s*write\b/g)) {
          if (w[1] === 'contents' && WRITE_ALLOWED.includes(base)) continue;
          if (w[1] === 'issues' && base === 'health.yml') continue;
          errors.push(`${file}: ${w[1]}: write is not allowed here`);
        }
        return;
      }
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim() || /^\s*#/.test(lines[j])) continue;
        const ind = lines[j].match(/^[ \t]*/)[0].length;
        if (ind <= m[1].length) break;
        const w = lines[j].match(/^[ \t]+([a-z-]+)\s*:\s*write\b/);
        if (!w) continue;
        if (w[1] === 'contents' && WRITE_ALLOWED.includes(base)) continue;
        if (w[1] === 'issues' && base === 'health.yml') continue;   // the CI-red issue (docs/CI-RED-FIX.md); nothing else may write issues
        errors.push(`${file}: ${w[1]}: write is not allowed here${w[1] === 'contents' ? ' (only ' + WRITE_ALLOWED.join(' and ') + ' may commit)' : ''}`);
      }
    });
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
  if (registry !== undefined) { errors.push(...validateProducts(registry)); warnings.push(...productWarnings(registry)); }
  const cache = json('content/cache.json');
  if (cache !== undefined) { const r = validateCache(cache, registry); errors.push(...r.errors); warnings.push(...r.warnings); }
  const blog = json('content/blog.json');
  if (blog !== undefined) errors.push(...validateBlog(blog));
  const reads = json('content/reads.json');
  if (reads !== undefined) { const r = validateReads(reads); errors.push(...r.errors); warnings.push(...r.warnings); }
  const podcasts = json('content/podcasts.json');
  if (podcasts !== undefined) { const r = validatePodcasts(podcasts); errors.push(...r.errors); warnings.push(...r.warnings); }

  const status = json('content/status.json');
  if (status !== undefined) errors.push(...validateStatus(status, Date.now()).errors);
  const changelog = json('content/changelog.json');
  if (changelog !== undefined) errors.push(...validateChangelog(changelog));

  if (fs.existsSync(path.join(ROOT, 'docs/CONTRACT.md')))
    errors.push(...checkContractDoc(read('docs/CONTRACT.md'), fs.readdirSync(path.join(ROOT, 'content')), RULES.map(r => r.id)));
  else errors.push('docs/CONTRACT.md: missing (SPEC-SH SH-03)');

  const html = read('index.html');
  errors.push(...validateIndex(html, ref => fs.existsSync(path.join(ROOT, ref))));

  const dirFiles = (dir, ext) => fs.existsSync(path.join(ROOT, dir)) ? fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith(ext)).map(f => dir + '/' + f) : [];
  const files = ['index.html', ...dirFiles('css', '.css'), ...dirFiles('js', '.js')];
  const sizes = Object.fromEntries(files.map(f => [f, Buffer.byteLength(read(f))]));
  errors.push(...checkSizes(sizes));
  const cssSources = Object.fromEntries(files.filter(f => f.endsWith('.css')).map(f => [f, read(f)]));
  errors.push(...checkCss(cssSources, p => fs.existsSync(path.join(ROOT, p))));
  errors.push(...checkFontCoverage(cssSources));
  errors.push(...checkCssSanity(cssSources));
  const profile = json('content/profile.json');
  if (profile !== undefined) { const r = validateProfileManifest(profile, p => fs.existsSync(path.join(ROOT, p))); errors.push(...r.errors); warnings.push(...r.warnings); }
  if (fs.existsSync(path.join(ROOT, 'content/profile.jpg'))) errors.push(...validateProfileImage(fs.readFileSync(path.join(ROOT, 'content/profile.jpg'))));
  const wfDir = path.join(ROOT, '.github/workflows');
  const wfSources = fs.existsSync(wfDir) ? Object.fromEntries(fs.readdirSync(wfDir).filter(f => /\.ya?ml$/.test(f)).map(f => ['.github/workflows/' + f, read('.github/workflows/' + f)])) : {};
  errors.push(...checkWorkflows(wfSources));
  const svgSources = Object.fromEntries(dirFiles('assets', '.svg').map(f => [f, read(f)]));
  errors.push(...checkSvg(svgSources));
  const fontFiles = dirFiles('fonts', '.woff2');
  const fontSizes = Object.fromEntries(fontFiles.map(f => [f, fs.statSync(path.join(ROOT, f)).size]));
  errors.push(...checkFonts(fontSizes, dirFiles('fonts', '.txt')));
  const jsSources = Object.fromEntries(files.filter(f => f.endsWith('.js')).map(f => [f, read(f)]));
  errors.push(...checkSyntax(jsSources));
  errors.push(...checkNoInlineStyles(jsSources));
  return { errors, warnings, sizes };
}

/* TR-04: the content rules, enumerated. Each one needs a failing fixture in tests/fixtures/<id>.json ({input, registry?}), a runbook
   section (fix) and a phrase the runbook must contain (doc). A test fails if any of these is missing, so no rule is untested. */
const RULES = [
  { id: 'status-schema-version', fn: 'validateStatus', level: 'error', match: /schema_version must be/, fix: 'ci-rejects-content', doc: 'schema_version must be' },
  { id: 'status-items', fn: 'validateStatus', level: 'error', match: /items must be a list of 1 to 4/, fix: 'ci-rejects-content', doc: 'items must be a list of 1 to 4' },
  { id: 'status-label', fn: 'validateStatus', level: 'error', match: /label must be text/, fix: 'ci-rejects-content', doc: 'label must be text' },
  { id: 'status-value', fn: 'validateStatus', level: 'error', match: /value must be text/, fix: 'ci-rejects-content', doc: 'value must be text' },
  { id: 'status-updated', fn: 'validateStatus', level: 'error', match: /updated must be a real date|is in the future/, fix: 'ci-rejects-content', doc: 'updated must be a real date' },
  { id: 'status-plain', fn: 'validateStatus', level: 'error', match: /must be plain text/, fix: 'ci-rejects-content', doc: 'must be plain text (no markup' },
  { id: 'product-repo-format', fn: 'validateProducts', level: 'error', match: /repo must look like/, fix: 'ci-rejects-content', doc: 'repo must look like' },
  { id: 'product-repo-duplicate', fn: 'validateProducts', level: 'error', match: /duplicate repo/, fix: 'ci-rejects-content', doc: 'duplicate repo' },
  { id: 'product-url-clean', fn: 'validateProducts', level: 'error', match: /url must be a clean/, fix: 'ci-rejects-content', doc: 'clean http(s) address' },
  { id: 'product-slug-format', fn: 'validateProducts', level: 'error', match: /slug must be lowercase/, fix: 'ci-rejects-content', doc: 'slug must be lowercase' },
  { id: 'product-slug-unique', fn: 'validateProducts', level: 'error', match: /duplicate slug/, fix: 'ci-rejects-content', doc: 'duplicate slug' },
  { id: 'product-category-empty', fn: 'validateProducts', level: 'error', match: /category must not be empty/, fix: 'ci-rejects-content', doc: 'category must not be empty' },
  { id: 'product-category-unknown', fn: 'validateProducts', level: 'warning', match: /unknown category/, fix: 'ci-rejects-content', doc: 'unknown category' },
  { id: 'cache-synced-at', fn: 'validateCache', level: 'error', match: /synced_at is required/, fix: 'ci-rejects-content', doc: 'synced_at is required' },
  { id: 'cache-synced-future', fn: 'validateCache', level: 'error', match: /in the future/, fix: 'ci-rejects-content', doc: 'in the future' },
  { id: 'cache-stars', fn: 'validateCache', level: 'error', match: /stars must be a whole number/, fix: 'ci-rejects-content', doc: 'stars must be a whole number' },
  { id: 'cache-release-tag', fn: 'validateCache', level: 'error', match: /latest_release\.tag is required/, fix: 'ci-rejects-content', doc: 'latest_release.tag is required' },
  { id: 'cache-release-host', fn: 'validateCache', level: 'error', match: /latest_release\.download_url must be .*hosted on github\.com/, fix: 'ci-rejects-content', doc: 'hosted on github.com' },
  { id: 'cache-asset-host', fn: 'validateCache', level: 'error', match: /assets\[\d+\]\.download_url must be .*hosted on github\.com/, fix: 'ci-rejects-content', doc: 'hosted on github.com' },
  { id: 'cache-asset-size', fn: 'validateCache', level: 'error', match: /assets\[\d+\]\.size must be a non-negative integer/, fix: 'ci-rejects-content', doc: 'size must be a non-negative integer' },
  { id: 'cache-release-tag-length', fn: 'validateCache', level: 'error', match: /latest_release\.tag must be at most/, fix: 'ci-rejects-content', doc: 'latest_release.tag must be at most 64 characters' },
  { id: 'cache-url-clean', fn: 'validateCache', level: 'error', match: /html_url must be a clean/, fix: 'ci-rejects-content', doc: 'html_url' },
  { id: 'cache-orphan', fn: 'validateCache', level: 'warning', match: /hidden or not in the registry/, fix: 'ci-rejects-content', doc: 'hidden or not in the registry' },
  { id: 'blog-date', fn: 'validateBlog', level: 'error', match: /date must be YYYY-MM-DD/, fix: 'ci-rejects-content', doc: 'date must be YYYY-MM-DD' },
  { id: 'blog-title', fn: 'validateBlog', level: 'error', match: /title is required/, fix: 'ci-rejects-content', doc: 'title is required' },
  { id: 'blog-link-clean', fn: 'validateBlog', level: 'error', match: /link must be a clean/, fix: 'ci-rejects-content', doc: 'link must be' },
  { id: 'reads-url-clean', fn: 'validateReads', level: 'error', match: /url must be a clean/, fix: 'ci-rejects-content', doc: 'clean http(s) address' },
  { id: 'reads-kind', fn: 'validateReads', level: 'error', match: /kind must be one of/, fix: 'ci-rejects-content', doc: 'kind must be one of' },
  { id: 'reads-tags', fn: 'validateReads', level: 'error', match: /tags must be an array/, fix: 'ci-rejects-content', doc: 'tags must be an array' },
  { id: 'reads-comment', fn: 'validateReads', level: 'error', match: /comment must be text/, fix: 'ci-rejects-content', doc: 'comment must be text' },
  { id: 'reads-category', fn: 'validateReads', level: 'error', match: /category must be one of/, fix: 'ci-rejects-content', doc: 'category must be one of' },
  { id: 'reads-schema-version', fn: 'validateReads', level: 'error', match: /schema_version must be/, fix: 'ci-rejects-content', doc: 'schema_version must be' },
  { id: 'reads-duplicate-id', fn: 'validateReads', level: 'error', match: /duplicate id/, fix: 'ci-rejects-content', doc: 'duplicate id' },
  { id: 'podcast-url-clean', fn: 'validatePodcasts', level: 'error', match: /podcast url must be a clean/, fix: 'ci-rejects-content', doc: 'podcast url must be a clean' },
  { id: 'podcast-title', fn: 'validatePodcasts', level: 'error', match: /podcast title is required/, fix: 'ci-rejects-content', doc: 'podcast title is required' },
  { id: 'podcast-schema-version', fn: 'validatePodcasts', level: 'error', match: /podcasts\.json: schema_version must be/, fix: 'ci-rejects-content', doc: 'podcasts.json: schema_version must be' },
  { id: 'podcast-duplicate-url', fn: 'validatePodcasts', level: 'warning', match: /same link as an earlier podcast/, fix: 'ci-rejects-content', doc: 'same link as an earlier podcast' },
  { id: 'podcast-tags', fn: 'validatePodcasts', level: 'error', match: /podcast tags must be/, fix: 'ci-rejects-content', doc: 'podcast tags must be' },
  { id: 'podcast-comment', fn: 'validatePodcasts', level: 'error', match: /podcast comment must be/, fix: 'ci-rejects-content', doc: 'podcast comment must be' },
  { id: 'podcast-show', fn: 'validatePodcasts', level: 'error', match: /podcast show must be/, fix: 'ci-rejects-content', doc: 'podcast show must be' },
  { id: 'podcast-duplicate-id', fn: 'validatePodcasts', level: 'error', match: /podcast duplicate id/, fix: 'ci-rejects-content', doc: 'podcast duplicate id' },
  { id: 'changelog-version', fn: 'validateChangelog', level: 'error', match: /version must look like/, fix: 'ci-rejects-content', doc: 'version must look like' },
  { id: 'changelog-plain-text', fn: 'validateChangelog', level: 'error', match: /plain text/, fix: 'ci-rejects-content', doc: 'plain text' },
];
const validateStatus = (file, now) => RL.validateStatusFile(file, now);   // SPEC-ST: the rules live in js/status-lib.js, so the page and CI agree
const RULE_NOW = Date.parse('2026-10-21T12:00:00Z');

/* Runs the validator a rule belongs to on a fixture ({input, registry?}); always returns { errors, warnings }. */
function runRule(rule, fx) {
  const arr = a => ({ errors: a, warnings: [] });
  switch (rule.fn) {
    case 'validateProducts': return { errors: validateProducts(fx.input), warnings: productWarnings(fx.input) };
    case 'validateCache': return validateCache(fx.input, fx.registry, RULE_NOW);
    case 'validateBlog': return arr(validateBlog(fx.input));
    case 'validateChangelog': return arr(validateChangelog(fx.input));
    case 'validateReads': return validateReads(fx.input);
    case 'validatePodcasts': return validatePodcasts(fx.input);
    case 'validateStatus': return validateStatus(fx.input, RULE_NOW);
    default: throw new Error('unknown validator ' + rule.fn);
  }
}
/* SH-03: CONTRACT.md must mention every content file and every rule id, so the contract cannot drift from the files and validators. */
function checkContractDoc(doc, files, ruleIds) {
  const errors = [];
  for (const f of files) if (!doc.includes(f)) errors.push(`docs/CONTRACT.md: does not mention content/${f}; document its fields`);
  for (const id of ruleIds) if (!doc.includes('`' + id + '`')) errors.push(`docs/CONTRACT.md: does not mention the rule \`${id}\`; add it next to its field`);
  return errors;
}
const missingFixtures = (rules, ids) => rules.filter(r => !ids.includes(r.id)).map(r => r.id);

module.exports = { validateStatus, RULES, runRule, missingFixtures, checkContractDoc, productWarnings, checkWorkflows, validateProfileManifest, validateProfileImage, checkSvg, checkCss, checkCssSanity, checkFonts, checkFontCoverage, validateProducts, validateCache, validateBlog, validateReads, validatePodcasts, run, validateIndex, validateChangelog, checkNoInlineStyles, checkSizes, checkSyntax, BUDGETS };

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
