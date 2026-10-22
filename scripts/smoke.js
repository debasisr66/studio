#!/usr/bin/env node
// Browser smoke test (SPEC-SH SH-02). No dependencies: Node's http, fetch and WebSocket drive headless Chrome over its DevTools protocol.
// Serves the repo on localhost (a random port) with optional fixture content laid over it, loads the page, and asserts on the real DOM.
// Usage: node scripts/smoke.js            (exit 0 = all pass, 1 = failures or Chrome not found)
//        CHROME_BIN=/path/to/chrome node scripts/smoke.js
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(ROOT, 'tests', 'fixtures', 'site');
const FALLBACK = 'This section could not load. The rest of the page is unaffected.';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };

/* ---------- local static server with fixture overlay ---------- */
let overlay = { dirs: [], manifest: {} };
function startServer() {
  let ownPort = 0;   // fixed at listen time: server.address() is null once the server is closed (review SH-02, N1)
  const server = http.createServer((req, res) => {
    // review SH-02: read-only methods, this server's own Host only (DNS rebinding), no dot-files, and a bad URL answers 400 instead of throwing
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    const host = String(req.headers.host || ''), port = ownPort;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) { res.writeHead(403); return res.end('wrong host'); }
    let decoded;
    try { decoded = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('bad url'); }
    const rel = path.posix.normalize(decoded.replace(/^\/+/, '') || 'index.html');
    if (rel.startsWith('..') || rel.includes('\0') || rel.split('/').some(seg => seg.startsWith('.'))) { res.writeHead(403); return res.end(); }
    const target = rel.endsWith('/') ? rel + 'index.html' : rel;
    const m = overlay.manifest;
    if ((m.missing || []).includes(target)) { res.writeHead(404); return res.end('missing (fixture)'); }
    if ((m.hang || []).includes(target)) return;                       // never answered: the connection is closed at shutdown
    const send = () => {
      for (const base of [...overlay.dirs, ROOT]) {
        const f = path.join(base, target);
        if (f.startsWith(base + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile() && fs.realpathSync(f).startsWith(fs.realpathSync(base) + path.sep)) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
          return res.end(fs.readFileSync(f));
        }
      }
      res.writeHead(404); res.end('not found');
    };
    const d = (m.delay || {})[target];
    d ? setTimeout(send, d) : send();
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => { ownPort = server.address().port; r(server); }));
}

/* ---------- Chrome and a minimal DevTools-protocol client ---------- */
function findChrome() {
  const cands = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const c of cands) {
    if (path.isAbsolute(c) ? fs.existsSync(c) : spawnSync('which', [c]).status === 0) return c;
  }
  return null;
}

/* Whatever happens (a throw, a signal, the watchdog), the browser and its profile folder go with the run: a leftover headless Chrome keeps
   its DevTools port open to every process on the machine (review SH-02, finding 1). Chrome runs in its own process group so its helpers die too. */
const live = { proc: null, dir: null };
function killBrowser() {
  try { if (live.proc && live.proc.pid && live.proc.exitCode === null && live.proc.signalCode === null) process.kill(-live.proc.pid, 'SIGKILL'); } catch (e) { try { live.proc.kill('SIGKILL'); } catch (e2) { /* already gone */ } }
  try { if (live.dir) fs.rmSync(live.dir, { recursive: true, force: true }); } catch (e) { /* temp folder, the OS cleans it */ }
}
/* installed by main() only, so merely requiring this file (the unit tests do) changes nothing process-wide (review SH-02, N3) */
function installCleanup() {
  process.on('exit', killBrowser);
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(sig, () => process.exit(code));
  process.on('uncaughtException', e => { console.error('smoke crashed: ' + (e && e.stack || e)); process.exit(1); });
  process.on('unhandledRejection', e => { console.error('smoke crashed: ' + (e && e.stack || e)); process.exit(1); });
}

async function launchChrome(bin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-smoke-'));
  live.dir = dir;
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars',
    '--remote-debugging-port=0', `--user-data-dir=${dir}`, ...(process.env.CI ? ['--no-sandbox'] : []), 'about:blank'];
  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  live.proc = proc;
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome did not report a DevTools address in time\n' + buf)), Number(process.env.SMOKE_LAUNCH_TIMEOUT_MS) || 20000);
    proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
    proc.on('exit', c => reject(new Error('Chrome exited early (' + c + ')\n' + buf)));
  });
  const port = new URL(wsUrl).port;
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find(x => x.type === 'page');
    if (!target) await new Promise(r => setTimeout(r, 100));
  }
  if (!target) throw new Error('no page target');
  return { proc, dir, pageWs: target.webSocketDebuggerUrl };
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0; const pending = new Map(); const listeners = [];
  const failAll = why => { for (const p of pending.values()) { clearTimeout(p.t); p.rej(new Error(why)); } pending.clear(); };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.t); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else listeners.forEach(l => l(m));
  };
  ws.onclose = () => failAll('DevTools connection closed');
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools connection failed')); setTimeout(() => rej(new Error('DevTools connection timed out')), 15000).unref(); });
  // a call Chrome never answers rejects instead of hanging the run (review SH-02)
  const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej, t: setTimeout(() => { pending.delete(n); rej(new Error('DevTools call ' + method + ' timed out')); }, 30000) }); ws.send(JSON.stringify({ id: n, method, params })); });
  return { ready, send, on: l => listeners.push(l), close: () => ws.close() };
}

/* ---------- running one case ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
let caseNo = 0;

async function runCase(cdp, base, c, errors) {
  overlay = { dirs: (c.fixtures || []).map(f => path.join(FIX, f)), manifest: {} };
  for (const f of c.fixtures || []) { const mf = path.join(FIX, f, 'fixture.json'); if (fs.existsSync(mf)) Object.assign(overlay.manifest, JSON.parse(fs.readFileSync(mf, 'utf8'))); }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: c.width, height: c.width < 500 ? 812 : 800, deviceScaleFactor: 1, mobile: c.width < 500 });
  await cdp.send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'all' }).catch(() => {});
  const init = c.token ? await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{sessionStorage.setItem('studio-admin-pat','not-a-real-token-smoke-test')}catch(e){}" }) : null;
  errors.length = 0;
  const t0 = Date.now();
  // a different query on every case forces a full load: a hash-only change would not reload the page, so a deep-link case would inherit the previous case's state
  await cdp.send('Page.navigate', { url: base + '/?case=' + (++caseNo) + (c.hash || '') });
  const ev = async expr => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('page eval failed: ' + expr);
    return r.result.value;
  };
  let ready = false;
  while (Date.now() - t0 < (c.timeout || 15000)) {
    ready = await ev("document.readyState==='complete' && !!document.querySelector('#grid') && !document.querySelector('#grid').hasAttribute('aria-busy')").catch(() => false);
    if (ready) break;
    await sleep(100);
  }
  await sleep(250);
  const fails = [];
  if (!ready) fails.push(`the page never finished loading within ${(c.timeout || 15000) / 1000} s`);
  const ctx = { ev, ms: Date.now() - t0, errors: [...errors] };
  try { fails.push(...await c.check(ctx)); } catch (e) { fails.push('check crashed: ' + e.message); }
  if (c.noErrors && errors.length) fails.push('console errors: ' + errors.slice(0, 3).join(' | '));
  if (init) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: init.identifier });
  return fails;
}

/* ---------- cases: ids match docs/specs/stabilize-core-hub/test.md ---------- */
const q = (sel, js) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});return e?${js}:null})()`;
const count = sel => `document.querySelectorAll(${JSON.stringify(sel)}).length`;
const text = sel => q(sel, 'e.textContent');
const isFallback = async (ctx, sel, name, fails) => { const t = await ctx.ev(text(sel)); if (!t || !t.includes(FALLBACK)) fails.push(`${name}: expected the fallback line in ${sel}, got "${(t || '').slice(0, 60)}"`); };

async function sectionsRendered(ctx, except = []) {
  const f = [];
  const need = {
    products: [count('#grid .card:not(.skel)'), 1], updates: [count('#updatesFeed .item'), 1],
    blog: [count('#blogFeed .item'), 1], reads: [count('#articlesFeed .item'), 1],
  };
  for (const [k, [expr, min]] of Object.entries(need)) {
    if (except.includes(k)) continue;
    const n = await ctx.ev(expr); if (n < min) f.push(`${k} did not render (found ${n})`);
  }
  if (!except.includes('version')) { const v = await ctx.ev(text('#versionBtn')); if (!v || !v.startsWith('Studio v')) f.push('version button missing'); }
  return f;
}
const noExceptionText = async (ctx, f) => { const t = await ctx.ev('document.body.innerText'); if (/TypeError|ReferenceError|Cannot read propert/.test(t)) f.push('an exception message is visible on the page'); };


/* ---------- RC Phase B helpers: Reads tabs ---------- */
const TWO = ['reads-two-sections', 'healthy'];
const tabsInfo = ctx => ctx.ev(`(() => { const tl = document.querySelector('#readTabs'); if (!tl) return null;
  return { role: tl.getAttribute('role'), tabs: [...tl.querySelectorAll('[role=tab]')].map(t => ({ id: t.id, text: t.textContent.replace(/\\s+/g, ' ').trim(), sel: t.getAttribute('aria-selected'), tab: t.tabIndex, controls: t.getAttribute('aria-controls'), focused: document.activeElement === t })),
    panel: (() => { const p = document.querySelector('#readsPanel'); return p ? { role: p.getAttribute('role'), by: p.getAttribute('aria-labelledby') } : null; })(),
    articles: [...document.querySelectorAll('#articlesFeed .item .read-title')].map(e => e.textContent.replace(/\\s*\\(opens in a new tab\\)/, '').trim()), books: [...document.querySelectorAll('#booksFeed .item h3')].map(e => e.textContent.trim()) }; })()`);
const selectedLabel = async ctx => { const i = await tabsInfo(ctx); const t = i && i.tabs.find(x => x.sel === 'true'); return t ? t.text.replace(/\s*\d+$/, '') : null; };
const expectSection = async (ctx, want) => { const got = await selectedLabel(ctx); return got === want ? [] : [`expected ${want} selected, got ${got}`]; };
const keyOn = (ctx, sel, key) => ctx.ev(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))`);
const lum = c => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const colours = (ctx, sel) => ctx.ev(`(() => { const rgb = s => (s.match(/[\\d.]+/g) || []).map(Number);
  const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const fg = rgb(getComputedStyle(el).color);
  let n = el, bg = [0, 0, 0, 0]; while (n) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.95)) { bg = c; break; } n = n.parentElement; }
  return { fg: fg.slice(0, 3), bg: bg.slice(0, 3) }; })()`);
const countOf = (i, name) => { const t = i.tabs.find(x => x.text.startsWith(name)); return t ? Number(t.text.replace(/^\D+/, '')) : null; };
const fillComposer = (ctx, o) => ctx.ev(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
  document.getElementById('composerOpen').click(); set('cf-url', ${JSON.stringify(o.url)}); set('cf-title', ${JSON.stringify(o.title)}); ${o.comment ? `set('cf-comment', ${JSON.stringify(o.comment)});` : ''} ${o.tags ? `set('cf-tags', ${JSON.stringify(o.tags)});` : ''}
  ${o.section ? `document.querySelector('#cf-category input[value=${o.section}]').click();` : ''} return true; })()`);
const stubApi = ctx => ctx.ev(`(() => { window.__puts = []; const real = window.fetch.bind(window);
  window.fetch = (u, o) => String(u).startsWith('https://api.github.com') ? Promise.resolve(o && o.method === 'PUT' ? (window.__puts.push({ u: String(u), b: JSON.parse(o.body) }), new Response('{}', { status: 200 })) : new Response('{}', { status: 404 })) : real(u, o); return true; })()`);
const publishedReads = async ctx => { await ctx.ev("document.getElementById('publishBtn').click(); new Promise(r => setTimeout(r, 600))"); const puts = JSON.parse(await ctx.ev('JSON.stringify(window.__puts)')); const p = puts.find(x => /content\/reads\.json/.test(x.u)); return p ? JSON.parse(Buffer.from(p.b.content, 'base64').toString('utf8')) : null; };

const CASES = [
  { id: 'TC-SH-B01 real content, 1280 px', width: 1280, fixtures: [], noErrors: true, check: async ctx => {
    const f = [];
    for (const [sel, name] of [['#products', 'Products'], ['#updates', 'Updates'], ['#reads', 'Reads']]) if (!(await ctx.ev(count(sel)))) f.push(name + ' section missing');
    if (!(await ctx.ev(count('#grid .card:not(.skel)')))) f.push('no product cards from the real content');
    if ((await ctx.ev(count('#articlesFeed .item'))) < 5) f.push('Reads did not render the 5 reads of the real (schema 2, categorised) content');
    return f; } },
  { id: 'TC-SH-B01 healthy fixture, 1280 px, no console errors (TC-SH-I05)', width: 1280, fixtures: ['healthy'], noErrors: true, check: ctx => sectionsRendered(ctx) },
  { id: 'TC-SH-B02 healthy fixture, 375 px: no horizontal overflow, bottom nav shown', width: 375, fixtures: ['healthy'], noErrors: true, check: async ctx => {
    const f = [];
    const w = await ctx.ev('document.documentElement.scrollWidth'); if (w > 375) f.push(`page is ${w} px wide at 375 px (horizontal scroll)`);
    const nav = await ctx.ev(q('#navbottom', "getComputedStyle(e).display")); if (!nav || nav === 'none') f.push('bottom nav not shown on a phone');
    return [...f, ...await sectionsRendered(ctx)]; } },
  { id: 'TC-SH-I01 Products and Updates fail (cache products null): only they degrade', width: 1280, fixtures: ['poison-cache-null', 'healthy'], check: async ctx => {
    const f = []; await isFallback(ctx, '#grid', 'Products', f); await isFallback(ctx, '#updatesFeed', 'Updates', f);
    f.push(...await sectionsRendered(ctx, ['products', 'updates'])); await noExceptionText(ctx, f); return f; } },
  { id: 'TC-SH-I01 Updates alone fails (null asset): Products still render', width: 1280, fixtures: ['poison-updates-assets', 'healthy'], check: async ctx => {
    const f = []; await isFallback(ctx, '#updatesFeed', 'Updates', f);
    f.push(...await sectionsRendered(ctx, ['updates'])); await noExceptionText(ctx, f); return f; } },
  { id: 'TC-SH-I01 Blog fails (null post): everything else renders', width: 1280, fixtures: ['poison-blog-null', 'healthy'], check: async ctx => {
    const f = []; await isFallback(ctx, '#blogFeed', 'Blog', f);
    f.push(...await sectionsRendered(ctx, ['blog'])); await noExceptionText(ctx, f); return f; } },
  { id: 'TC-SH-I01 Reads fails (null book): everything else renders', width: 1280, fixtures: ['poison-reads-book-null', 'healthy'], check: async ctx => {
    const f = []; await isFallback(ctx, '#articlesFeed', 'Reads', f);
    f.push(...await sectionsRendered(ctx, ['reads'])); await noExceptionText(ctx, f); return f; } },
  { id: 'TC-SH-I02 a section fails with a token present: admin mode still switches on', width: 1280, token: true, fixtures: ['poison-blog-null', 'healthy'], check: async ctx => {
    const on = await ctx.ev("document.body.classList.contains('admin')"); return on ? [] : ['admin mode did not switch on after a section failed']; } },
  { id: 'TC-SH-I04 blog.json missing (404): only Blog degrades to its empty state', width: 1280, fixtures: ['missing-blog', 'healthy'], check: async ctx => {
    const f = [...await sectionsRendered(ctx, ['blog'])]; const t = await ctx.ev(text('#blogFeed')); if (!t || !/No posts yet/.test(t)) f.push('Blog did not show its empty state'); return f; } },
  { id: 'TC-SH-I04 reads.json is invalid JSON: only Reads degrades to its empty state', width: 1280, fixtures: ['bad-reads-json', 'healthy'], check: async ctx => {
    const f = [...await sectionsRendered(ctx, ['reads'])]; const t = await ctx.ev(text('#articlesFeed')); if (!t || !/Nothing here yet/.test(t)) f.push('Reads did not show its empty state'); return f; } },
  { id: 'TC-SH-I04 content files that are valid JSON but `null`: boot is not aborted, the page and admin still work', width: 1280, token: true, fixtures: ['null-files', 'healthy'], check: async ctx => {
    const f = [];
    if (!(await ctx.ev(count('#grid .card:not(.skel)')))) f.push('Products did not render from the registry alone');
    if (!(await ctx.ev("document.body.classList.contains('admin')"))) f.push('admin mode did not switch on');
    const t = await ctx.ev(text('#articlesFeed')); if (!t || !/Nothing here yet/.test(t)) f.push('Reads did not show its empty state');
    return f; } },
  { id: 'TC-SH-V03 reads.json without schema_version (an older file) still renders in the browser', width: 1280, fixtures: ['healthy'], noErrors: true, check: ctx => sectionsRendered(ctx) },
  { id: 'TC-SH-V03 reads.json with a newer schema_version: Reads shows the fallback line, everything else renders', width: 1280, fixtures: ['future-reads-version', 'healthy'], check: async ctx => {
    const f = []; await isFallback(ctx, '#articlesFeed', 'Reads', f);
    f.push(...await sectionsRendered(ctx, ['reads'])); await noExceptionText(ctx, f); return f; } },
  { id: 'TC-RC-D01 reads with a missing, unknown or odd category (and a book with a non-text one) render under Others, no errors', width: 1280, fixtures: ['reads-odd-categories', 'healthy'], noErrors: true, check: async ctx => {
    const f = [...await sectionsRendered(ctx)]; const n = await ctx.ev(count('#articlesFeed .item')); if (n !== 1) f.push(`Technical should list its 1 read, found ${n}`);
    await ctx.ev("document.querySelectorAll('#readTabs [role=tab]')[1].click()"); const m = await ctx.ev(count('#articlesFeed .item')); if (m !== 3) f.push(`Others should list the 3 reads with a missing or unknown category, found ${m}`);
    const t = await ctx.ev(text('#articlesFeed')); if (t && t.includes(FALLBACK)) f.push('Reads showed its fallback line'); await noExceptionText(ctx, f); return f; } },
  { id: 'TC-RC-E00 admin composer: a new read is published with a category and schema_version 2 (GitHub API stubbed, nothing leaves the page)', width: 1280, token: true, fixtures: ['healthy'], check: async ctx => {
    const f = [];
    const raw = await ctx.ev(`(async () => {
      window.__puts = []; const real = window.fetch.bind(window);
      window.fetch = (u, o) => String(u).startsWith('https://api.github.com')
        ? Promise.resolve(o && o.method === 'PUT' ? (window.__puts.push({ u: String(u), b: JSON.parse(o.body) }), new Response('{}', { status: 200 })) : new Response('{}', { status: 404 }))
        : real(u, o);
      const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
      document.getElementById('composerOpen').click();
      document.querySelector('#cf-category input[value=technical]').click();
      set('cf-url', 'https://example.com/rc-a-smoke'); set('cf-title', 'RC A smoke read'); set('cf-tags', 'ai');
      document.getElementById('composerForm').requestSubmit();
      await new Promise(r => setTimeout(r, 300));
      document.getElementById('publishBtn').click();
      await new Promise(r => setTimeout(r, 600));
      return JSON.stringify(window.__puts);
    })()`);
    const puts = JSON.parse(raw || '[]'), p = puts.find(x => /content\/reads\.json/.test(x.u));
    if (!p) { f.push('no PUT of content/reads.json was made; got ' + puts.map(x => x.u).join(', ')); return f; }
    const file = JSON.parse(Buffer.from(p.b.content, 'base64').toString('utf8'));
    if (file.schema_version !== 2) f.push('published schema_version is ' + file.schema_version + ', expected 2');
    const mine = (file.articles || []).find(a => a.title === 'RC A smoke read');
    if (!mine) f.push('the new read is not in the published file');
    else if (mine.category !== 'technical') f.push('the new read has category ' + JSON.stringify(mine.category) + ', expected technical');
    const without = [...(file.articles || []), ...(file.books || [])].filter(e => !['technical', 'other'].includes(e.category)).length;
    if (without) f.push(without + ' published entries have no valid category');
    if ((file.articles || []).length !== 6) f.push('expected 5 existing reads plus the new one, got ' + (file.articles || []).length);
    return f; } },
  { id: 'TC-RC-U01 Reads has a tab list with one tab per section, counts of the whole section (reads and books), a tab panel, ARIA wiring', width: 1280, fixtures: TWO, noErrors: true, check: async ctx => {
    const f = [], i = await tabsInfo(ctx); if (!i) return ['no #readTabs tab list'];
    if (i.role !== 'tablist') f.push('tab list role is ' + i.role);
    if (i.tabs.length !== 2) f.push('expected 2 tabs, found ' + i.tabs.length);
    if (countOf(i, 'Technical') !== 5 || countOf(i, 'Others') !== 3) f.push('counts should be Technical 5 and Others 3, got ' + i.tabs.map(t => t.text).join(' | '));
    if (i.tabs.filter(t => t.sel === 'true').length !== 1) f.push('exactly one tab must be selected');
    if (i.tabs.some(t => (t.sel === 'true') !== (t.tab === 0))) f.push('roving tabindex: only the selected tab is in the tab order');
    if (!i.panel || i.panel.role !== 'tabpanel' || i.panel.by !== (i.tabs.find(t => t.sel === 'true') || {}).id) f.push('the tab panel is not labelled by the selected tab');
    if (i.tabs.some(t => t.controls !== 'readsPanel')) f.push('tabs must control #readsPanel');
    return f; } },
  { id: 'TC-RC-U02 click, arrow keys, Home and End switch the section and move focus; only that section is listed', width: 1280, fixtures: TWO, check: async ctx => {
    const f = []; let i = await tabsInfo(ctx);
    if (i.articles.length !== 4 || i.books.join() !== 'Tech book') f.push('Technical should list 4 reads and its book, got ' + JSON.stringify([i.articles, i.books]));
    const step = async (key, want) => { await keyOn(ctx, '#readTabs [aria-selected=true]', key); const j = await tabsInfo(ctx), t = j.tabs.find(x => x.sel === 'true');
      if (!t || !t.text.startsWith(want) || !t.focused) f.push(`after ${key}: expected ${want} selected and focused, got ${t && t.text} focused=${t && t.focused}`); return j; };
    i = await step('ArrowRight', 'Others');
    if (i.articles.join() !== 'Other zebra,Other yak' || i.books.join() !== 'Other book') f.push('Others lists the wrong items: ' + JSON.stringify([i.articles, i.books]));
    await step('ArrowRight', 'Technical'); await step('End', 'Others'); await step('Home', 'Technical'); await step('ArrowLeft', 'Others');
    await ctx.ev("document.querySelector('#readTabs [role=tab]').click()");
    const sel = await selectedLabel(ctx); if (sel !== 'Technical') f.push('clicking the first tab selected ' + sel);
    return f; } },
  { id: 'TC-RC-U03 switching section clears the tag filter and the search', width: 1280, fixtures: TWO, check: async ctx => {
    const f = []; await ctx.ev("document.querySelector('#tagChips [data-filter=ai]').click()");
    await ctx.ev("(() => { const s = document.getElementById('readSearch'); s.value = 'alpha'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    if ((await tabsInfo(ctx)).articles.join() !== 'Tech alpha') f.push('filters did not narrow Technical to one read');
    await ctx.ev("document.querySelectorAll('#readTabs [role=tab]')[1].click()");
    const i = await tabsInfo(ctx), q = await ctx.ev("document.getElementById('readSearch').value"), pressed = await ctx.ev("document.querySelectorAll('#tagChips [aria-pressed=true]').length");
    if (q !== '') f.push('search box kept "' + q + '"'); if (pressed > 1) f.push('a tag chip is still active'); if (i.articles.length !== 2) f.push('Others should list its 2 reads, got ' + i.articles.length);
    return f; } },
  { id: 'TC-RC-U04 default section is Technical; Others when Technical is empty', width: 1280, fixtures: TWO, check: async ctx => {
    const s = await selectedLabel(ctx); return s === 'Technical' ? [] : ['expected Technical, got ' + s]; } },
  { id: 'TC-RC-U04 Technical empty: Others is selected on load', width: 1280, fixtures: ['reads-only-others', 'healthy'], check: async ctx => {
    const s = await selectedLabel(ctx); return s === 'Others' ? [] : ['expected Others, got ' + s]; } },
  { id: 'TC-RC-U05 an empty section shows a friendly empty state, not a blank', width: 1280, fixtures: ['reads-only-others', 'healthy'], check: async ctx => {
    const f = []; await ctx.ev("document.querySelector('#readTabs [role=tab]').click()");
    const t = await ctx.ev(text('#articlesFeed')); if (!t || !/Nothing in Technical yet/.test(t)) f.push('Reads empty state missing: "' + (t || '').slice(0, 60) + '"');
    const b = await ctx.ev(text('#booksFeed')); if (!b || !b.trim()) f.push('Books column is blank');
    if (await ctx.ev("document.getElementById('toolbar').getBoundingClientRect().height") > 0) f.push('the search and tag toolbar is visible in an empty section'); return f; } },
  { id: 'TC-RC-U06 375 px: tabs fit with no overflow and touch targets are at least 44 px', width: 375, fixtures: TWO, noErrors: true, check: async ctx => {
    const f = [], m = await ctx.ev(`(() => { const r = [...document.querySelectorAll('#readTabs [role=tab]')].map(t => t.getBoundingClientRect()); return { over: document.documentElement.scrollWidth - innerWidth, h: Math.min(...r.map(x => x.height)), right: Math.max(...r.map(x => x.right)), n: r.length }; })()`);
    if (!m.n) return ['no tabs']; if (m.over > 1) f.push('horizontal overflow of ' + m.over + ' px'); if (m.h < 44) f.push('tab height ' + m.h + ' px'); if (m.right > 375) f.push('a tab runs past the viewport'); return f; } },
  { id: 'TC-RC-U07 tab text contrast is at least 4.5:1 in both themes, selected and not', width: 1280, fixtures: TWO, check: async ctx => {
    const f = [];
    for (const theme of ['dark', 'light']) {
      await ctx.ev(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)})`);
      for (const sel of ['#readTabs [aria-selected=true]', '#readTabs [aria-selected=false]']) {
        const c = await colours(ctx, sel); if (!c) { f.push('no tab for ' + sel); continue; }
        const r = ratio(c.fg, c.bg); if (r < 4.5) f.push(`${theme} ${sel}: contrast ${r.toFixed(2)} (< 4.5)`);
      }
    }
    return f; } },
  { id: 'TC-RC-U08 no match in this section but a match in the other shows a hint that switches section', width: 1280, fixtures: TWO, check: async ctx => {
    const f = []; await ctx.ev("(() => { const s = document.getElementById('readSearch'); s.value = 'zebra'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    const t = await ctx.ev(text('#articlesFeed')); if (!t || !/No reads match/.test(t)) f.push('no "No reads match" message'); if (!/Try Others/.test(t || '')) f.push('no hint to try Others: "' + (t || '').slice(0, 80) + '"');
    await ctx.ev("document.querySelector('#articlesFeed [data-cat]').click()");
    if (await selectedLabel(ctx) !== 'Others') f.push('the hint did not switch to Others'); return f; } },
  { id: 'TC-RC-L01 #reads opens the default section', width: 1280, hash: '#reads', fixtures: TWO, check: async ctx => await expectSection(ctx, 'Technical') },
  { id: 'TC-RC-L02 #reads/others opens Others and brings Reads into view', width: 1280, hash: '#reads/others', fixtures: TWO, check: async ctx => {
    const f = [], s = await selectedLabel(ctx); if (s !== 'Others') f.push('expected Others, got ' + s);
    await sleep(900); const top = await ctx.ev("document.getElementById('reads').getBoundingClientRect().top"); if (top > 200 || top < -50) f.push('Reads is not scrolled into view (top = ' + Math.round(top) + ')'); return f; } },
  { id: 'TC-RC-L02 #reads/technical opens Technical even when Technical is not the default', width: 1280, hash: '#reads/technical', fixtures: ['reads-only-others', 'healthy'], check: async ctx => expectSection(ctx, 'Technical') },
  { id: 'TC-RC-L03 #reads/xyz and #reads/__proto__ are ignored: default section, no errors', width: 1280, hash: '#reads/__proto__', fixtures: TWO, noErrors: true, check: async ctx => expectSection(ctx, 'Technical') },
  { id: 'TC-RC-L03 #reads/xyz is ignored', width: 1280, hash: '#reads/xyz', fixtures: ['reads-only-others', 'healthy'], noErrors: true, check: async ctx => expectSection(ctx, 'Others') },
  { id: 'TC-RC-L04 switching updates the hash without scrolling the page or adding history; a hash change switches the tab', width: 1280, fixtures: TWO, check: async ctx => {
    const f = []; await ctx.ev("window.scrollTo(0, 400)"); await sleep(300);
    const before = await ctx.ev('[scrollY, history.length]'); await ctx.ev("document.querySelectorAll('#readTabs [role=tab]')[1].click()"); await sleep(300);
    const after = await ctx.ev('[scrollY, history.length, location.hash]');
    if (after[2] !== '#reads/others') f.push('hash is ' + after[2]); if (Math.abs(after[0] - before[0]) > 2) f.push(`page scrolled from ${before[0]} to ${after[0]}`); if (after[1] !== before[1]) f.push('history grew');
    await ctx.ev("location.hash = '#reads/technical'"); await sleep(400);
    if (await selectedLabel(ctx) !== 'Technical') f.push('a hash change to #reads/technical did not switch the tab'); return f; } },
  { id: 'TC-RC-E01 composer: Section choice with one radio per category, one checked; an empty choice is an inline, announced error', width: 1280, token: true, fixtures: TWO, check: async ctx => {
    const f = []; await ctx.ev("document.getElementById('composerOpen').click()");
    const r = await ctx.ev("[...document.querySelectorAll('#cf-category input[type=radio]')].map(x => [x.value, x.checked])");
    if (r.length !== 2) return ['expected 2 section radios, got ' + r.length]; if (r.filter(x => x[1]).length !== 1) f.push('exactly one section must be preselected');
    await fillComposer(ctx, { url: 'https://example.com/e01', title: 'E01' }); await ctx.ev("document.querySelectorAll('#cf-category input').forEach(x => x.checked = false); document.getElementById('composerForm').requestSubmit();");
    const e = await ctx.ev("[document.getElementById('cf-category-err').textContent, document.getElementById('cf-category-err').getAttribute('role'), document.querySelectorAll('#articlesFeed .item').length]");
    if (!/section/i.test(e[0])) f.push('no inline error about the section'); if (e[1] !== 'alert') f.push('error is not announced (role=alert)'); if (e[2] !== 4) f.push('a read was added despite the error'); return f; } },
  { id: 'TC-RC-E02 the last chosen section is the next default; a new read is published under the section chosen', width: 1280, token: true, fixtures: TWO, check: async ctx => {
    const f = []; await stubApi(ctx);
    await fillComposer(ctx, { url: 'https://example.com/e02', title: 'E02 read', section: 'other' }); await ctx.ev("document.getElementById('composerForm').requestSubmit()"); await sleep(300);
    await ctx.ev("document.getElementById('composerOpen').click()");
    const chk = await ctx.ev("(document.querySelector('#cf-category input:checked') || {}).value"); if (chk !== 'other') f.push('the next composer did not remember Others (got ' + chk + ')');
    const i = await tabsInfo(ctx); if (countOf(i, 'Others') !== 4 || countOf(i, 'Technical') !== 5) f.push('counts after adding to Others: ' + i.tabs.map(t => t.text).join(' | '));
    const file = await publishedReads(ctx); const mine = file && file.articles.find(a => a.title === 'E02 read');
    if (!mine) f.push('the read was not published'); else if (mine.category !== 'other') f.push('published under ' + mine.category + ', expected other'); if (file && file.schema_version !== 2) f.push('schema_version ' + file.schema_version); return f; } },
  { id: 'TC-RC-E03 editing an entry can move it to the other section', width: 1280, token: true, fixtures: TWO, check: async ctx => {
    const f = []; await ctx.ev("[...document.querySelectorAll('#articlesFeed [data-edit]')].find(b => /Tech alpha/.test(b.getAttribute('aria-label'))).click()");
    const pre = await ctx.ev("(document.querySelector('#cf-category input:checked') || {}).value"); if (pre !== 'technical') f.push('edit form did not show the entry section (got ' + pre + ')');
    await ctx.ev("document.querySelector('#cf-category input[value=other]').click(); document.getElementById('composerForm').requestSubmit()"); await sleep(300);
    const i = await tabsInfo(ctx); if (countOf(i, 'Technical') !== 4 || countOf(i, 'Others') !== 4) f.push('counts after the move: ' + i.tabs.map(t => t.text).join(' | ')); if (i.articles.includes('Tech alpha')) f.push('the entry is still listed under Technical'); return f; } },
  { id: 'TC-RC-E04 XSS payloads in title, comment and tags stay inert in the preview and the list; the section value is never markup', width: 1280, token: true, fixtures: TWO, check: async ctx => {
    const f = [], P = '<img src=x onerror="window.__x=1"><script>window.__x=1<\/script>';
    await fillComposer(ctx, { url: 'https://example.com/e04', title: P, comment: P, tags: '"><svg onload=window.__x=1>', section: 'technical' }); await sleep(200);
    let bad = await ctx.ev("[window.__x, document.querySelectorAll('#cf-preview img[src=x], #cf-preview svg, #cf-preview script').length]"); if (bad[0] || bad[1]) f.push('payload active in the preview: ' + JSON.stringify(bad));
    await ctx.ev("document.getElementById('composerForm').requestSubmit()"); await sleep(300);
    bad = await ctx.ev("[window.__x, document.querySelectorAll('#reads img[src=x], #reads svg[onload], #reads script').length, document.querySelector('#readTabs').innerHTML.includes('<img')]"); if (bad[0] || bad[1] || bad[2]) f.push('payload active in the list: ' + JSON.stringify(bad));
    const t = await ctx.ev(text('#articlesFeed')); if (!t || !t.includes('<img')) f.push('the payload should show as plain text'); return f; } },
  { id: 'TC-RC-E05 the book editor has a Section choice and a saved book moves to that section', width: 1280, token: true, fixtures: TWO, check: async ctx => {
    const f = []; await ctx.ev("document.getElementById('addBook').click()");
    const ok = await ctx.ev("(() => { const s = document.querySelector('#modal [data-k=category]'); if (!s) return false; document.querySelector('#modal [data-k=title]').value = 'New other book'; document.querySelector('#modal [data-k=author]').value = 'Z'; s.value = 'other'; document.getElementById('ms').click(); return true; })()");
    if (!ok) return ['the book editor has no Section select']; await sleep(300);
    const i = await tabsInfo(ctx); if (countOf(i, 'Others') !== 4 || countOf(i, 'Technical') !== 5) f.push('counts after adding a book to Others: ' + i.tabs.map(t => t.text).join(' | ')); return f; } },
  { id: 'TC-RC-X01 a category added to CATEGORIES at run time gets a third tab with no other change', width: 1280, fixtures: TWO, check: async ctx => {
    await ctx.ev("ReadsLib.CATEGORIES.push('news'); document.querySelector('#readTabs [role=tab]').click();");
    const i = await tabsInfo(ctx); return i.tabs.length === 3 && /^News/.test(i.tabs[2].text) ? [] : ['expected a third tab "News", got ' + i.tabs.map(t => t.text).join(' | ')]; } },
  { id: 'TC-SH-T01 reads.json never answers: the page still loads (8 s timeout) and the rest renders', width: 1280, fixtures: ['hang-reads', 'healthy'], timeout: 20000, check: async ctx => {
    const f = [...await sectionsRendered(ctx, ['reads'])]; if (ctx.ms > 14000) f.push(`took ${ctx.ms} ms; the timeout should end the wait at about 8 s`); return f; } },
  { id: 'TC-SH-T02 reads.json answers after 2 s: it still renders', width: 1280, fixtures: ['slow-reads', 'healthy'], check: ctx => sectionsRendered(ctx) },
];

async function main() {
  installCleanup();
  // a filter must never turn the run into a silent no-op (review SH-02): refused in CI, and an empty selection is an error
  const only = process.env.SMOKE_ONLY;
  if (only && process.env.CI) { console.error('smoke: SMOKE_ONLY must not be set in CI (it would skip cases)'); process.exit(1); }
  if (!CASES.some(c => !only || c.id.includes(only))) { console.error(`smoke: no case matches SMOKE_ONLY=${only}`); process.exit(1); }
  // the whole run is bounded, below the CI step's 2-minute limit, so cleanup and a clear message happen before the runner cuts it off
  const wd = Number(process.env.SMOKE_WATCHDOG_MS) || 100000;
  setTimeout(() => { console.error(`smoke: watchdog: the run did not finish within ${Math.round(wd / 1000)} s and was stopped`); process.exit(1); }, wd).unref();
  const bin = findChrome();
  if (!bin) { console.error('smoke: Chrome not found. Install Google Chrome or set CHROME_BIN.'); process.exit(1); }
  const started = Date.now();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchChrome(bin);
  const cdp = connect(chrome.pageWs);
  const errors = [];
  let failed = 0, ran = 0;
  try {
    await cdp.ready;
    cdp.on(m => {
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push((m.params.args || []).map(a => a.value ?? a.description ?? '').join(' '));
      if (m.method === 'Runtime.exceptionThrown') errors.push('uncaught: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
    });
    for (const d of ['Page', 'Runtime', 'Log']) await cdp.send(d + '.enable');
    for (const c of CASES) {
      if (only && !c.id.includes(only)) continue;
      const fails = await runCase(cdp, base, c, errors);
      ran++;
      console.log(`${fails.length ? 'FAIL' : 'ok  '} ${c.id}`);
      fails.forEach(x => console.log('       - ' + x));
      if (fails.length) failed++;
    }
  } finally {
    cdp.close(); server.closeAllConnections(); server.close();
    // let Chrome exit before its profile folder is removed (it keeps writing to it for a moment); cleanup is best-effort and never fails the run
    await new Promise(r => { chrome.proc.once('exit', r); chrome.proc.kill(); setTimeout(r, 5000); });
    killBrowser();   // no-op when Chrome already exited; otherwise it is stopped for certain
    try { fs.rmSync(chrome.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* temp folder, the OS cleans it */ }
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${failed ? 'FAILED' : 'OK'}: ${ran - failed} of ${ran} cases passed in ${secs} s`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Browser smoke test: ${failed ? 'FAILED' : 'OK'} (${ran - failed}/${ran}, ${secs} s)\n`);
  process.exit(failed ? 1 : 0);
}

module.exports = { startServer, setOverlay: o => { overlay = o; } };   // for tests/smoke-harness.test.js
if (require.main === module) main().catch(e => { console.error('smoke crashed: ' + e.message); process.exit(1); });
