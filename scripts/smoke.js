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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: c.width, height: c.height || (c.width < 500 ? 812 : 800), deviceScaleFactor: 1, mobile: c.width < 500 });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: !!c.touch, maxTouchPoints: c.touch ? 5 : 0 }).catch(() => {});
  await cdp.send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'all' }).catch(() => {});
  const initSrc = [c.token ? "try{sessionStorage.setItem('studio-admin-pat','not-a-real-token-smoke-test')}catch(e){}" : '', c.init || ''].filter(Boolean).join(';\n');
  const init = initSrc ? await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: initSrc }) : null;
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
  await sleep(c.fast ? 60 : 120);   // fast: the case reads its own state after the page is ready (the Quick add cases poll for what they wait on)
  const fails = [];
  if (!ready) fails.push(`the page never finished loading within ${(c.timeout || 15000) / 1000} s`);
  const tab = async () => { for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); };
  const ctx = { ev, tab, ms: Date.now() - t0, errors: [...errors] };
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
    podcasts: [count('#podcastFeed .item'), 1], reads: [count('#articlesFeed .item'), 1],
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
const stubApi = (ctx, echo) => ctx.ev(`(() => { window.__puts = []; const real = window.fetch.bind(window); const echo = ${!!echo};
  window.fetch = (u, o) => String(u).startsWith('https://api.github.com') ? Promise.resolve(o && o.method === 'PUT' ? (window.__puts.push({ u: String(u), b: JSON.parse(o.body) }), new Response('{}', { status: 200 })) : (echo && window.__puts.length ? new Response(JSON.stringify({ sha: 'abc', content: window.__puts[window.__puts.length - 1].b.content }), { status: 200 }) : new Response('{}', { status: 404 }))) : real(u, o); return true; })()`);
/* GitHub answers every read of a content file with this text (a copy that is newer or different from the page's), and records every write */
const stubRemote = (ctx, text) => ctx.ev(`(() => { window.__puts = []; const real = window.fetch.bind(window); const body = ${JSON.stringify(text)};
  window.fetch = (u, o) => String(u).startsWith('https://api.github.com') ? Promise.resolve(o && o.method === 'PUT' ? (window.__puts.push({ u: String(u), b: JSON.parse(o.body) }), new Response('{}', { status: 200 })) : new Response(JSON.stringify({ sha: 'r1', content: btoa(unescape(encodeURIComponent(body))) }), { status: 200 })) : real(u, o); return true; })()`);
const publishResult = async ctx => { await ctx.ev("document.getElementById('publishBtn').click(); new Promise(r => setTimeout(r, 700))"); return ctx.ev("(document.querySelector('#modal .pre-result') || {}).textContent || ''"); };
const publishedReads = async ctx => { await ctx.ev("document.getElementById('publishBtn').click(); new Promise(r => setTimeout(r, 600))"); const puts = JSON.parse(await ctx.ev('JSON.stringify(window.__puts)')); const p = puts.find(x => /content\/reads\.json/.test(x.u)); return p ? JSON.parse(Buffer.from(p.b.content, 'base64').toString('utf8')) : null; };

/* ---------- PC Phase B helpers: Podcasts ---------- */
const PODS = ['podcasts-many', 'healthy'];
const podCards = ctx => ctx.ev(`[...document.querySelectorAll('#podcastFeed .item')].map(a => { const t = a.querySelector('.podcast-title'), l = a.querySelector('a.listen');
  return { title: t ? t.textContent.replace(/\\s*\\(opens in a new tab\\)/, '').trim() : null, href: t && t.getAttribute('href'), meta: (a.querySelector('.podcast-meta') || {}).textContent, comment: (a.querySelector('.read-comment') || {}).textContent, tags: [...a.querySelectorAll('.read-tags .chip')].map(c => c.textContent),
    listen: l && { href: l.getAttribute('href'), target: l.target, rel: l.rel }, linkedin: !!a.querySelector('.share-row a[href^="https://www.linkedin.com/sharing/share-offsite/?url="]'), copy: !!a.querySelector('.share-row [data-pcopy]'), text: a.textContent }; })`);
const fillPodcast = (ctx, o) => ctx.ev(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
  document.getElementById('podcastComposerOpen').click(); set('pf-url', ${JSON.stringify(o.url || '')}); set('pf-title', ${JSON.stringify(o.title || '')}); set('pf-show', ${JSON.stringify(o.show || '')}); set('pf-comment', ${JSON.stringify(o.comment || '')}); set('pf-tags', ${JSON.stringify(o.tags || '')}); return true; })()`);
const submitPodcast = async ctx => { await ctx.ev("document.getElementById('podcastForm').requestSubmit()"); await sleep(250); };

/* ---------- QA Phase A helpers: the Add to Studio sheet. The GitHub API and the clipboard are stubbed in the page, so nothing leaves the machine and no real token exists ---------- */
const QA_TOKEN = 'qa-test-token-not-real-0123456789';
const QA_INIT = `
window.__clip = { text: '', reads: 0 };
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => { window.__clip.reads++; return Promise.resolve(window.__clip.text); }, writeText: () => Promise.resolve() } });
window.__console = [];
for (const k of ['log', 'info', 'warn', 'error', 'debug']) { const o = console[k].bind(console); console[k] = (...a) => { try { window.__console.push(a.map(String).join(' ')); } catch (e) {} o(...a); }; }
window.__q = {
  set(id, v) { const e = document.getElementById('qa-' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); },
  fill(o) {
    for (const k of ['url', 'title', 'show', 'comment', 'tags']) if (o[k] !== undefined) this.set(k, o[k]);
    if (o.kind) document.querySelector('#qa-kind input[value=' + o.kind + ']').click();
    if (o.type) document.getElementById('qa-type').value = o.type;
    if (o.section) document.querySelector('#qa-section-opts input[value=' + o.section + ']').click();
  },
  state() {
    const v = id => (document.getElementById(id) || {}).value, t = id => (document.getElementById(id) || {}).textContent;
    const open = id => document.getElementById(id).classList.contains('open');
    return { sheet: open('addBg'), tok: open('tokBg'), admin: document.body.classList.contains('admin'), active: document.activeElement && document.activeElement.id,
      session: Object.keys(sessionStorage).sort(), local: Object.keys(localStorage).sort(),
      fields: { url: v('qa-url'), title: v('qa-title'), comment: v('qa-comment'), tags: v('qa-tags'), show: v('qa-show') },
      kind: (document.querySelector('#qa-kind input:checked') || {}).value, section: (document.querySelector('#qa-section-opts input:checked') || {}).value,
      errs: { url: t('qa-url-err'), title: t('qa-title-err'), show: t('qa-show-err'), comment: t('qa-comment-err'), category: t('qa-category-err') }, msg: t('qa-msg'), tokErr: t('tok-err'), dest: t('qa-dest'), status: t('status') };
  },
};`;
const qaWith = (extra = {}) => ({ init: QA_INIT, fast: true, ...extra });
const qs = ctx => ctx.ev('window.__q.state()');
const qaOpenGear = ctx => ctx.ev("document.getElementById('gear').click()");
const qaFill = (ctx, o) => ctx.ev(`window.__q.fill(${JSON.stringify(o)})`);
const qaClip = (ctx, text) => ctx.ev(`window.__clip.text = ${JSON.stringify(text)}`);
/* waits until nothing is in flight (stubbed API calls, a publish, a token check) instead of sleeping a fixed time: faster, and not flaky */
const settle = async (ctx, max = 4000) => { const t0 = Date.now(); let calm = 0; while (Date.now() - t0 < max) { const busy = await ctx.ev("(window.__inflight || 0) > 0 || document.getElementById('addSheet').getAttribute('aria-busy') === 'true' || document.getElementById('tok-go').disabled"); calm = busy ? 0 : calm + 1; if (calm >= 2) return; await sleep(30); } };
const qaClick = async (ctx, id, wait = 0) => { await ctx.ev(`document.getElementById(${JSON.stringify(id)}).click()`); if (wait) { await sleep(20); await settle(ctx); } };
const qaToken = async (ctx, tok = QA_TOKEN, wait = 500) => { await ctx.ev(`(() => { document.getElementById('pat').value = ${JSON.stringify(tok)}; document.getElementById('tokForm').requestSubmit(); })()`); await sleep(20); await settle(ctx); };
const putsOf = async ctx => JSON.parse(await ctx.ev('JSON.stringify(window.__puts)'));
const putFile = (puts, name) => { const p = puts.find(x => x.u.endsWith('/contents/content/' + name + '.json')); return p ? JSON.parse(Buffer.from(p.b.content, 'base64').toString('utf8')) : null; };
const apiCalls = ctx => ctx.ev('window.__calls.length');
/* the GitHub API as the page sees it: /user answers o.user (200 or 401); a content file answers with what this page loaded unless o.remote overrides it; a PUT answers 200 or o.put */
const stubGh = (ctx, o = {}) => ctx.ev(`(() => { window.__calls = []; window.__puts = []; const real = window.fetch.bind(window), o = ${JSON.stringify(o)};
  window.fetch = async (u, init) => { u = String(u); if (!u.startsWith('https://api.github.com')) return real(u, init);
    window.__inflight = (window.__inflight || 0) + 1; try { return await (async () => {
    const method = (init && init.method) || 'GET'; window.__calls.push({ method, u, auth: init && init.headers && init.headers.Authorization });
    if (u.endsWith('/user')) { if (o.userDelay) await new Promise(r => setTimeout(r, o.userDelay)); }
    if (u.endsWith('/user')) return o.user === 401 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ login: o.login || 'debasisr66' }), { status: 200 });
    const m = u.match(/contents\\/(content\\/[a-z]+\\.json)/); if (!m) return new Response('{}', { status: 404 });
    if (method === 'PUT') { if (o.put) return new Response('boom', { status: o.put }); window.__puts.push({ u, b: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); }
    const b64 = t => btoa(unescape(encodeURIComponent(t)));
    if (o.remote && o.remote[m[1]] !== undefined) return new Response(JSON.stringify({ sha: 'r1', content: b64(o.remote[m[1]]) }), { status: 200 });
    const t = await real(m[1] + '?x=' + Date.now()).then(r => r.ok ? r.text() : null);
    return t === null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify({ sha: 'r1', content: b64(t) }), { status: 200 }); })(); } finally { window.__inflight--; } };
  return true; })()`);
const reloadPage = async ctx => {
  await ctx.ev('setTimeout(() => location.reload(), 0); true').catch(() => {});
  for (let i = 0; i < 60; i++) { await sleep(150); const ok = await ctx.ev("document.readyState==='complete' && !!window.__q && !!document.querySelector('#grid') && !document.querySelector('#grid').hasAttribute('aria-busy')").catch(() => false); if (ok) break; }
  await sleep(250);
};
const focusables = ctx => ctx.ev(`[...document.querySelectorAll('#addSheet button:not([disabled]), #addSheet input, #addSheet textarea, #addSheet select, #addSheet a[href]')].filter(e => e.offsetParent !== null).map(e => e.id || e.name || e.tagName)`);
const qaClose = ctx => ctx.ev("document.getElementById('qa-cancel').click()");
const QA_MSG = 'Enter a valid web address starting with http:// or https://';
const QA_P = '<img src=x onerror="window.__x=1"><script>window.__x=1<\/script>';

/* ---------- UX Phase A helpers (SPEC-UX) ---------- */
const UX_ORDER = 'hero,products,updates,reads,podcasts', UX_NAV = 'Products>#products|Updates>#updates|Reads>#reads|Podcasts>#podcasts';
const UX_BLOCK = `for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });`;
const uxWith = (init = '') => ({ init, fast: true });
const uxOrder = ctx => ctx.ev("[...document.querySelectorAll('main > section')].map(s => s.classList.contains('hero') ? 'hero' : s.id).join()");
const uxNavs = ctx => ctx.ev(`(() => { const lab = a => [...a.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(), of = id => [...document.querySelectorAll('#' + id + ' a')].map(a => lab(a) + '>' + a.getAttribute('href')).join('|'); return { head: of('navlinks'), bottom: of('navbottom') }; })()`);
const uxTop = (ctx, id) => ctx.ev(`Math.round(document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().top)`);
/* waits until the scroll position has stopped moving (smooth scrolling, late layout), up to 2.5 s */
const uxStill = async ctx => { let last = -1, calm = 0; for (let i = 0; i < 25 && calm < 3; i++) { await sleep(100); const y = await ctx.ev('Math.round(scrollY)'); calm = y === last ? calm + 1 : 0; last = y; } };
const uxLands = async (ctx, id) => { await uxStill(ctx); const t = await uxTop(ctx, id); const end = await ctx.ev('scrollY + innerHeight >= document.documentElement.scrollHeight - 2');   // the last section cannot reach the top of a short page
  return (t > 140 && !(end && t < 700)) || t < -20 ? [`${id} is not at the top of the page (top ${t} px)`] : []; };
const uxFollow = async (ctx, id) => { await ctx.ev("window.scrollTo({ top: 0, behavior: 'instant' }); history.replaceState(null, '', location.pathname + location.search)"); await sleep(80); await ctx.ev(`location.hash = ${JSON.stringify('#' + id)}`); return uxLands(ctx, id).then(r => r.map(x => 'followed: ' + x)); };

/* ---------- UX Phase B helpers (UX-05, UX-06): measured in the page, in both themes ---------- */
const UXB_TEXT = ['.brand', 'nav.links a', '.eyebrow', '.hero h1', '.hero p', '.hero p.tagline', '.cta', '.cta.ghost', '.sec-desc', '.sec-head h2', '.card h3', '.card p', '.meta', '.tag', '.tag.ver', '.item h3', '.item .when', '.item .body', '.tab', '.tab[aria-selected=true]', '.empty', '.read-title', '.chip', 'footer span', 'footer .linkbtn', '#readCount', '.toolbar input[type=search]', '.whatsnew'];
/* every match of a selector; each background layer from the element up is blended by its alpha over the layers below it; a gradient layer is tried stop by stop (the worst stop counts); a listed selector that matches nothing fails */
const uxWorst = (ctx, sel) => ctx.ev(`(() => { const rgb = x => { const n = (x.match(/[\\d.]+(?:e-?\\d+)?/g) || []).map(Number); return x.startsWith('color(') ? [n[0] * 255, n[1] * 255, n[2] * 255, ...n.slice(3)] : n; }, over = (top, base) => { const a = top.length > 3 ? top[3] : 1; return [0, 1, 2].map(i => top[i] * a + base[i] * (1 - a)); };
  const lum = c => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }, ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').slice(0, 40); if (!els.length) return { none: true };
  let worst = 99, at = '';
  for (const e of els) { const layers = []; for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); const c = rgb(cs.backgroundColor); if (c.length >= 3 && (c.length === 3 || c[3] > 0)) layers.push([c]); if (cs.backgroundImage.includes('gradient')) { const st = [...cs.backgroundImage.matchAll(/(rgba?\\([^)]*\\))\\s*(\\d+(?:\\.\\d+)?%)?/g)].map(m => ({ c: rgb(m[1]).concat(rgb(m[1]).length === 3 ? [1] : []), p: m[2] ? parseFloat(m[2]) / 100 : null })); if (st.length) { st[0].p = st[0].p === null ? 0 : st[0].p; st[st.length - 1].p = st[st.length - 1].p === null ? 1 : st[st.length - 1].p; for (let i = 1; i < st.length - 1; i++) if (st[i].p === null) st[i].p = i / (st.length - 1);
      const box = n.getBoundingClientRect(), eb = e.getBoundingClientRect(), at = t => { t = Math.max(0, Math.min(1, t)); let i = 0; while (i < st.length - 2 && t > st[i + 1].p) i++; const A = st[i], B = st[i + 1], k = B.p === A.p ? 1 : Math.max(0, Math.min(1, (t - A.p) / (B.p - A.p))); const pm = c => [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]], P = pm(A.c).map((x, j) => x + (pm(B.c)[j] - x) * k), al = P[3] || 1e-9; return [P[0] / al, P[1] / al, P[2] / al, P[3]]; };   // premultiplied, as the browser blends
      const t1 = (eb.top - box.top) / box.height, t2 = (eb.bottom - box.top) / box.height; layers.push([at(t1), at(t2)]); } } }
    layers.reverse(); let variants = [[0, 0, 0]]; for (const L of layers) variants = variants.flatMap(v => L.map(c => over(c, v)));
    const fg = rgb(getComputedStyle(e).color); for (const v of variants) { const r = ratio(over(fg, v), v); if (r < worst) { worst = r; at = (e.className || e.tagName) + ' fg=' + fg.join() + ' bg=' + v.map(Math.round).join() + ' layers=' + layers.length; } } }
  return { worst: Math.round(worst * 100) / 100, at, n: els.length }; })()`);
const UXB_NEED = ['.brand', '.eyebrow', '.hero h1', '.hero p', '.hero p.tagline', '.cta', '.cta.ghost', '.sec-desc', '.sec-head h2', '.card h3', '.card p', '.card.featured .tag.ver', '.item .tag.ver', '.meta', '.item h3', '.item .when', '.item .body', '.tab', '.tab[aria-selected=true]', '.read-title', '.chip', 'footer span', 'footer .linkbtn', '.whatsnew'];
const uxContrast = async (ctx, theme, list = UXB_NEED) => {
  await ctx.ev(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`); await sleep(40);
  const bad = [];
  for (const sel of list) { const r = await uxWorst(ctx, sel); if (r.none) bad.push(`${theme} ${sel}: matches nothing (the case would be vacuous)`); else if (r.worst < 4.5) bad.push(`${theme} ${sel} ${r.worst}:1 [${r.at}]`); }
  return bad;
};
/* extreme zoom: nothing in the page may stick out past the viewport or make the page scroll sideways (the tabs, chips and cards included; long words must wrap) */
const uxExtreme = async ctx => {
  const r = await ctx.ev(`(() => { const vw = document.documentElement.clientWidth, out = [...document.querySelectorAll('body *')].filter(e => (e.offsetParent !== null || getComputedStyle(e).position === 'fixed') && !e.closest('#navbottom, .modal-bg')).map(e => ({ e, b: e.getBoundingClientRect() })).filter(x => x.b.width > 0 && (x.b.right > vw + 1 || x.b.left < -1)).slice(0, 6).map(x => (x.e.id || (typeof x.e.className === 'string' && x.e.className) || x.e.tagName) + ' ' + Math.round(x.b.left) + '..' + Math.round(x.b.right));
    const clipped = [...document.querySelectorAll('main *, footer *')].filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1 && ['hidden', 'clip'].includes(getComputedStyle(e).overflowX) && !['A', 'BUTTON', 'INPUT'].includes(e.tagName) && !e.classList.contains('hero') && !e.classList.contains('sr')).slice(0, 4).map(e => e.className || e.tagName);
    return { vw, over: document.documentElement.scrollWidth - vw, out, clipped }; })()`);
  const f = []; if (r.over > 1) f.push('sideways scroll of ' + r.over + ' px at ' + r.vw); if (r.out.length) f.push('sticks out: ' + r.out.join('; ')); if (r.clipped.length) f.push('clipped: ' + r.clipped.join(', ')); return f;
};

const CASES = [
  { id: 'TC-SH-B01 real content, 1280 px', width: 1280, fixtures: [], noErrors: true, check: async ctx => {
    const f = [];
    for (const [sel, name] of [['#products', 'Products'], ['#updates', 'Updates'], ['#reads', 'Reads']]) if (!(await ctx.ev(count(sel)))) f.push(name + ' section missing');
    if (!(await ctx.ev(count('#grid .card:not(.skel)')))) f.push('no product cards from the real content');
    if ((await ctx.ev(count('#articlesFeed .item'))) < 1) f.push('Reads did not render any read from the real (schema 2, categorised) content');
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
  { id: 'TC-SH-I01 Podcasts fails (newer schema_version): the fallback line there, everything else renders', width: 1280, fixtures: ['future-podcasts-version', 'healthy'], check: async ctx => {
    const f = []; await isFallback(ctx, '#podcastFeed', 'Podcasts', f);
    f.push(...await sectionsRendered(ctx, ['podcasts'])); await noExceptionText(ctx, f); return f; } },
  { id: 'TC-SH-I01 Reads fails (null book): everything else renders', width: 1280, fixtures: ['poison-reads-book-null', 'healthy'], check: async ctx => {
    const f = []; await isFallback(ctx, '#articlesFeed', 'Reads', f);
    f.push(...await sectionsRendered(ctx, ['reads'])); await noExceptionText(ctx, f); return f; } },
  { id: 'TC-SH-I02 a section fails with a token present: admin mode still switches on', width: 1280, token: true, fixtures: ['future-podcasts-version', 'healthy'], check: async ctx => {
    const on = await ctx.ev("document.body.classList.contains('admin')"); return on ? [] : ['admin mode did not switch on after a section failed']; } },
  { id: 'TC-SH-I04 podcasts.json missing (404): only Podcasts degrades to its empty state', width: 1280, fixtures: ['missing-podcasts', 'healthy'], check: async ctx => {
    const f = [...await sectionsRendered(ctx, ['podcasts'])]; const t = await ctx.ev(text('#podcastFeed')); if (!t || !/No podcasts yet\. Check back soon\./.test(t)) f.push('Podcasts did not show its empty state'); return f; } },
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
  { id: 'TC-PC-U01 Blog is gone and Podcasts is in the header and the bottom nav', width: 1280, fixtures: PODS, noErrors: true, check: async ctx => {
    const f = [], r = await ctx.ev(`({ blog: !!document.getElementById('blog') || !!document.getElementById('blogFeed') || !!document.getElementById('addPost'), sec: !!document.getElementById('podcasts'), head: [...document.querySelectorAll('#navlinks a')].map(a => a.getAttribute('href') + ':' + a.textContent), bottom: [...document.querySelectorAll('#navbottom a')].map(a => a.getAttribute('href') + ':' + a.textContent.trim()) })`);
    if (r.blog) f.push('a Blog element is still on the page'); if (!r.sec) f.push('no #podcasts section');
    if (!r.head.some(x => /^#podcasts:Podcasts$/.test(x))) f.push('header nav has no Podcasts: ' + r.head.join(' ')); if (r.head.some(x => /blog/i.test(x))) f.push('header nav still has Blog');
    if (!r.bottom.some(x => /^#podcasts:.*Podcasts$/.test(x))) f.push('bottom nav has no Podcasts: ' + r.bottom.join(' ')); if (r.bottom.some(x => /blog/i.test(x))) f.push('bottom nav still has Blog');
    return f; } },
  { id: 'TC-PC-U02 a card shows the title link, show, platform label, date, comment and tags; platform labels come from the host', width: 1280, fixtures: PODS, check: async ctx => {
    const f = [], c = await podCards(ctx); if (c.length !== 5) return ['expected 5 cards, got ' + c.length];
    const a = c[0]; if (a.title !== 'Show on Spotify' || a.href !== 'https://open.spotify.com/show/abc123') f.push('title link wrong: ' + JSON.stringify([a.title, a.href]));
    if (!/Lex Fridman Podcast/.test(a.meta) || !/Spotify/.test(a.meta) || !/22 Oct 2026/.test(a.meta)) f.push('meta line wrong: ' + a.meta); if (!/long conversation/.test(a.comment)) f.push('comment missing'); if (a.tags.join() !== '#ai') f.push('tags: ' + a.tags);
    const labels = ['Spotify', 'Apple Podcasts', 'YouTube', 'example.org', 'example.com']; c.forEach((x, i) => { if (!(x.meta || '').includes(labels[i])) f.push(`card ${i + 1}: expected platform ${labels[i]} in "${x.meta}"`); });
    return f; } },
  { id: 'TC-PC-U03 Listen opens a new tab with noopener noreferrer', width: 1280, fixtures: PODS, check: async ctx => {
    const f = [], c = await podCards(ctx); if (c.length !== 5) return ['expected 5 cards, got ' + c.length]; c.forEach((x, i) => { if (!x.listen || x.listen.target !== '_blank' || !/noopener/.test(x.listen.rel) || !/noreferrer/.test(x.listen.rel) || !/^https?:\/\//.test(x.listen.href)) f.push(`card ${i + 1} Listen link: ${JSON.stringify(x.listen)}`); }); return f; } },
  { id: 'TC-PC-U04 Share on LinkedIn, Copy link and Share… are on every card; Copy link answers', width: 1280, fixtures: PODS, check: async ctx => {
    const f = [], c = await podCards(ctx); if (c.length !== 5) return ['expected 5 cards, got ' + c.length]; c.forEach((x, i) => { if (!x.linkedin || !x.copy) f.push(`card ${i + 1} is missing a share control`); });
    await ctx.ev("document.querySelector('#podcastFeed [data-pcopy]').click()"); await sleep(300); const t = await ctx.ev(text('#status')); if (!/Link copied|Could not copy/.test(t || '')) f.push('Copy link gave no answer: "' + t + '"'); return f; } },
  { id: 'TC-PC-U05 newest first; search and tag chips only from 4 entries', width: 1280, fixtures: PODS, check: async ctx => {
    const f = [], c = await podCards(ctx); if (c.map(x => x.title).join('|') !== 'Show on Spotify|Apple episode|A YouTube video|Elsewhere|Oldest') f.push('order: ' + c.map(x => x.title).join('|'));
    if (!(await ctx.ev("document.getElementById('podcastToolbar').getBoundingClientRect().height")) > 0) f.push('toolbar hidden with 5 entries');
    await ctx.ev("document.querySelector('#podcastChips [data-pfilter=history]').click()"); const h = await podCards(ctx); if (h.map(x => x.title).join('|') !== 'A YouTube video|Oldest') f.push('tag filter: ' + h.map(x => x.title));
    await ctx.ev("document.querySelector('#podcastChips [data-pfilter=\"\"]').click(); const s = document.getElementById('podcastSearch'); s.value = 'primeagen'; s.dispatchEvent(new Event('input', { bubbles: true }))"); const q = await podCards(ctx); if (q.map(x => x.title).join('|') !== 'Apple episode') f.push('search: ' + q.map(x => x.title));
    return f; } },
  { id: 'TC-PC-U05 with fewer than 4 entries there is no search or chip toolbar', width: 1280, fixtures: ['healthy'], check: async ctx => (await ctx.ev("document.getElementById('podcastToolbar').getBoundingClientRect().height")) === 0 ? [] : ['the toolbar shows with 1 entry'] },
  { id: 'TC-PC-U06 empty state text', width: 1280, fixtures: ['missing-podcasts', 'healthy'], check: async ctx => { const t = await ctx.ev(text('#podcastFeed')); return /No podcasts yet\. Check back soon\./.test(t || '') ? [] : ['empty state: "' + t + '"']; } },
  { id: 'TC-PC-U07 no iframe, audio, video, embed or image in Podcasts, and no request leaves the origin', width: 1280, fixtures: PODS, noErrors: true, check: async ctx => {
    const f = [], r = await ctx.ev(`({ el: document.querySelectorAll('#podcasts iframe, #podcasts audio, #podcasts video, #podcasts embed, #podcasts object, #podcasts img, #podcasts source').length, foreign: performance.getEntriesByType('resource').filter(e => !e.name.startsWith(location.origin)).map(e => e.name) })`);
    if (!(await podCards(ctx)).length) return ['no podcast cards rendered, so nothing was checked'];
    if (r.el) f.push(r.el + ' media elements in the section'); if (r.foreign.length) f.push('requests to another origin: ' + r.foreign.join(', ')); return f; } },
  { id: 'TC-PC-U08 375 px: Podcasts fits with no horizontal overflow', width: 375, fixtures: PODS, noErrors: true, check: async ctx => { if ((await podCards(ctx)).length !== 5) return ['the 5 cards are not there']; const o = await ctx.ev('document.documentElement.scrollWidth - innerWidth'); return o > 1 ? ['horizontal overflow of ' + o + ' px'] : []; } },
  { id: 'TC-PC-U08 1280 px: Podcasts fits with no horizontal overflow', width: 1280, fixtures: PODS, noErrors: true, check: async ctx => { if ((await podCards(ctx)).length !== 5) return ['the 5 cards are not there']; const o = await ctx.ev('document.documentElement.scrollWidth - innerWidth'); return o > 1 ? ['horizontal overflow of ' + o + ' px'] : []; } },
  { id: 'TC-PC-A01 the composer is hidden from visitors and shown to the unlocked owner', width: 1280, fixtures: PODS, check: async ctx => { if (!(await ctx.ev("!!document.getElementById('podcastComposer')"))) return ['no #podcastComposer element']; return (await ctx.ev("document.getElementById('podcastComposer').getBoundingClientRect().height")) === 0 ? [] : ['the composer is visible without admin']; } },
  { id: 'TC-PC-A01 unlocked: the composer is there', width: 1280, token: true, fixtures: PODS, check: async ctx => (await ctx.ev("document.getElementById('podcastComposer').getBoundingClientRect().height")) > 0 ? [] : ['the composer is not visible when unlocked'] },
  { id: 'TC-PC-A02 link and title are required; errors are inline and announced; nothing is added', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = []; await fillPodcast(ctx, {}); await submitPodcast(ctx);
    const e = await ctx.ev("[document.getElementById('pf-url-err').textContent, document.getElementById('pf-title-err').textContent, document.getElementById('pf-url-err').getAttribute('role'), document.getElementById('pf-url').getAttribute('aria-invalid'), document.querySelectorAll('#podcastFeed .item').length]");
    if (!e[0] || !e[1]) f.push('errors missing: ' + JSON.stringify(e)); if (e[2] !== 'alert') f.push('error not announced'); if (e[3] !== 'true') f.push('field not marked invalid'); if (e[4] !== 5) f.push('an entry was added despite the errors'); return f; } },
  { id: 'TC-PC-A03 the live preview matches the card that will be published', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = []; await fillPodcast(ctx, { url: 'https://open.spotify.com/show/zzz', title: 'Preview me', show: 'The Show', comment: 'My take', tags: 'ai, mind' }); await sleep(150);
    const p = await ctx.ev("document.getElementById('pf-preview').textContent"); for (const w of ['Preview me', 'The Show', 'Spotify', 'My take', '#ai', '#mind']) if (!p.includes(w)) f.push('preview lacks ' + w);
    await submitPodcast(ctx); const c = await podCards(ctx), mine = c.find(x => x.title === 'Preview me'); if (!mine) return [...f, 'the card was not added'];
    for (const w of ['The Show', 'Spotify', 'My take', '#ai']) if (!(mine.text + mine.meta).includes(w)) f.push('card lacks ' + w); return f; } },
  { id: 'TC-PC-A04 edit and delete work and stay a draft until Publish (no write to GitHub before)', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = []; await stubApi(ctx); await fillPodcast(ctx, { url: 'https://example.com/a04', title: 'A04 added' }); await submitPodcast(ctx);
    let d = await ctx.ev(text('#dirtyinfo')); if (!/podcasts\.json/.test(d || '')) f.push('dirty info does not name podcasts.json: ' + d);
    await ctx.ev("[...document.querySelectorAll('#podcastFeed [data-edit]')].find(b => /A04 added/.test(b.getAttribute('aria-label'))).click()"); await sleep(100);
    await ctx.ev("(() => { const e = document.getElementById('pf-title'); e.value = 'A04 edited'; e.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('podcastForm').requestSubmit(); })()"); await sleep(250);
    let c = await podCards(ctx); if (!c.some(x => x.title === 'A04 edited') || c.some(x => x.title === 'A04 added')) f.push('edit did not replace the entry: ' + c.map(x => x.title));
    await ctx.ev("window.confirm = () => true; [...document.querySelectorAll('#podcastFeed [data-del]')].find(b => /A04 edited/.test(b.getAttribute('aria-label'))).click()"); await sleep(250);
    c = await podCards(ctx); if (c.length !== 5) f.push('delete did not remove it: ' + c.length);
    const puts = await ctx.ev('window.__puts.length'); if (puts !== 0) f.push(puts + ' write(s) to GitHub before Publish'); return f; } },
  { id: 'TC-PC-A05 Publish writes only content/podcasts.json, once, valid; an identical file is skipped', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = []; await stubApi(ctx, true); await fillPodcast(ctx, { url: 'https://example.com/a05?utm_source=x', title: 'A05 published', show: 'S', tags: 'ai' }); await submitPodcast(ctx);
    await ctx.ev("document.getElementById('publishBtn').click(); new Promise(r => setTimeout(r, 600))");
    const puts = JSON.parse(await ctx.ev('JSON.stringify(window.__puts)')); if (puts.length !== 1 || !/contents\/content\/podcasts\.json$/.test(puts[0].u)) return ['expected exactly one PUT of content/podcasts.json, got ' + puts.map(p => p.u).join(', ')];
    const file = JSON.parse(Buffer.from(puts[0].b.content, 'base64').toString('utf8')); if (file.schema_version !== 1) f.push('schema_version ' + file.schema_version);
    if (Object.keys(file).join() !== 'schema_version,podcasts') f.push('keys: ' + Object.keys(file)); const mine = file.podcasts.find(p => p.title === 'A05 published');
    if (!mine) f.push('the entry is not in the file'); else if (mine.url !== 'https://example.com/a05') f.push('link not normalised: ' + mine.url); if (file.podcasts.length !== 6) f.push('expected 5 + 1 entries, got ' + file.podcasts.length);
    // same content again: make it dirty, restore it, publish: the GET now returns what was just written, so nothing is PUT
    await ctx.ev("sessionStorage.setItem('studio-admin-pat', 'not-a-real-token-smoke-test'); enableAdmin()");   // the first publish locked the admin (SPEC-QA QA-06): unlock again so the rest of this case still exercises the edit and the second publish
    await ctx.ev("[...document.querySelectorAll('#podcastFeed [data-edit]')].find(b => /A05 published/.test(b.getAttribute('aria-label'))).click()"); await sleep(100);
    await ctx.ev("(() => { const e = document.getElementById('pf-comment'); e.value = 'temp'; e.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('podcastForm').requestSubmit(); })()"); await sleep(200);
    await ctx.ev("[...document.querySelectorAll('#podcastFeed [data-edit]')].find(b => /A05 published/.test(b.getAttribute('aria-label'))).click()"); await sleep(100);
    await ctx.ev("(() => { const e = document.getElementById('pf-comment'); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('podcastForm').requestSubmit(); })()"); await sleep(200);
    await ctx.ev("document.getElementById('publishBtn').click(); new Promise(r => setTimeout(r, 600))");
    const again = await ctx.ev('window.__puts.length'); if (again !== 1) f.push('an identical file was written again (' + again + ' PUTs)'); return f; } },
  { id: 'TC-PC-A07 XSS payloads in title, show, comment and tags stay inert in the preview and the card', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = [], P = '<img src=x onerror="window.__x=1"><script>window.__x=1<\/script>';
    await fillPodcast(ctx, { url: 'https://example.com/a07', title: P, show: P, comment: P, tags: '"><svg onload=window.__x=1>' }); await sleep(200);
    let bad = await ctx.ev("[window.__x, document.querySelectorAll('#pf-preview img[src=x], #pf-preview svg, #pf-preview script').length]"); if (bad[0] || bad[1]) f.push('active in preview: ' + JSON.stringify(bad));
    await submitPodcast(ctx); bad = await ctx.ev("[window.__x, document.querySelectorAll('#podcasts img[src=x], #podcasts svg[onload], #podcasts script').length]"); if (bad[0] || bad[1]) f.push('active in the list: ' + JSON.stringify(bad));
    const t = await ctx.ev(text('#podcastFeed')); if (!t || !t.includes('<img')) f.push('the payload should show as plain text'); return f; } },
  { id: 'TC-PC-A08 a podcasts.json that fails to load is not shown as empty: fallback line, and the owner cannot add to it or publish over it', width: 1280, token: true, fixtures: ['bad-podcasts-json', 'healthy'], check: async ctx => {
    const f = []; await isFallback(ctx, '#podcastFeed', 'Podcasts', f); await stubApi(ctx);
    await fillPodcast(ctx, { url: 'https://example.com/a08', title: 'A08' }); await submitPodcast(ctx);
    const r = await ctx.ev("[document.getElementById('pf-url-err').textContent, document.getElementById('podcastFeed').textContent.includes('A08'), document.getElementById('dirtyinfo').textContent]");
    if (!/could not be loaded|reload/i.test(r[0])) f.push('no refusal in the composer: "' + r[0] + '"'); if (r[1]) f.push('the entry was added'); if (/podcasts\.json/.test(r[2])) f.push('podcasts.json was marked as changed');
    if ((await ctx.ev('window.__puts.length')) !== 0) f.push('something was written to GitHub'); return f; } },
  { id: 'TC-PC-A09 publish refuses when the file on GitHub is different from the copy this page loaded (another device published) and when it has a newer schema_version', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = [], loaded = fs.readFileSync(path.join(FIX, 'podcasts-many', 'content', 'podcasts.json'), 'utf8'), d = JSON.parse(loaded);
    const addOne = async t => { await fillPodcast(ctx, { url: 'https://example.com/' + t, title: t }); await submitPodcast(ctx); };
    await addOne('a09-first');
    await stubRemote(ctx, JSON.stringify({ ...d, podcasts: [...d.podcasts, { id: 777, title: 'Added elsewhere', url: 'https://example.com/elsewhere' }] }));
    let r = await publishResult(ctx); if (!/changed on GitHub/i.test(r)) f.push('different remote content was not refused: "' + r.slice(0, 120) + '"'); if ((await ctx.ev('window.__puts.length')) !== 0) f.push('it wrote anyway (changed remote)');
    await ctx.ev("document.querySelector('#mc').click()");
    await stubRemote(ctx, JSON.stringify({ ...d, schema_version: 2 }));
    r = await publishResult(ctx); if (!/changed on GitHub|newer/i.test(r)) f.push('a newer schema_version was not refused: "' + r.slice(0, 120) + '"'); if ((await ctx.ev('window.__puts.length')) !== 0) f.push('it wrote anyway (newer version)');
    await ctx.ev("document.querySelector('#mc').click()");
    await stubRemote(ctx, loaded);
    r = await publishResult(ctx); if ((await ctx.ev('window.__puts.length')) !== 1) f.push('with the remote equal to what was loaded, publish should write once; result: "' + r.slice(0, 120) + '"'); return f; } },
  { id: 'TC-PC-A10 edit, then delete an earlier entry: Save changes the entry being edited, not its neighbour', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = []; await ctx.ev("window.confirm = () => true; [...document.querySelectorAll('#podcastFeed [data-edit]')].find(b => /Apple episode/.test(b.getAttribute('aria-label'))).click()"); await sleep(100);
    await ctx.ev("[...document.querySelectorAll('#podcastFeed [data-del]')].find(b => /Show on Spotify/.test(b.getAttribute('aria-label'))).click()"); await sleep(200);
    await ctx.ev("(() => { const e = document.getElementById('pf-title'); e.value = 'Apple edited'; e.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('podcastForm').requestSubmit(); })()"); await sleep(250);
    const t = (await podCards(ctx)).map(x => x.title).join('|'); if (t !== 'Apple edited|A YouTube video|Elsewhere|Oldest') f.push('titles after: ' + t); return f; } },
  { id: 'TC-PC-A10 delete the entry being edited, then Save: refused, nothing is overwritten or added', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = []; await ctx.ev("window.confirm = () => true; [...document.querySelectorAll('#podcastFeed [data-edit]')].find(b => /Oldest/.test(b.getAttribute('aria-label'))).click()"); await sleep(100);
    await ctx.ev("[...document.querySelectorAll('#podcastFeed [data-del]')].find(b => /Oldest/.test(b.getAttribute('aria-label'))).click()"); await sleep(200);
    await ctx.ev("document.getElementById('podcastForm').requestSubmit()"); await sleep(250);
    const c = (await podCards(ctx)).map(x => x.title).join('|'), e = await ctx.ev("document.getElementById('pf-url-err').textContent");
    if (c !== 'Show on Spotify|Apple episode|A YouTube video|Elsewhere') f.push('entries after: ' + c); if (!/deleted/i.test(e)) f.push('no message that the entry was deleted: "' + e + '"'); return f; } },
  { id: 'TC-PC-A10 the same holds for the reads composer', width: 1280, token: true, fixtures: TWO, check: async ctx => {
    const f = []; await ctx.ev("window.confirm = () => true; [...document.querySelectorAll('#articlesFeed [data-edit]')].find(b => /Tech charlie/.test(b.getAttribute('aria-label'))).click()"); await sleep(100);
    await ctx.ev("[...document.querySelectorAll('#articlesFeed [data-del]')].find(b => /Tech alpha/.test(b.getAttribute('aria-label'))).click()"); await sleep(200);
    await ctx.ev("(() => { const e = document.getElementById('cf-title'); e.value = 'Charlie edited'; e.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('composerForm').requestSubmit(); })()"); await sleep(250);
    const i = await tabsInfo(ctx); if (i.articles.join('|') !== 'Tech bravo|Charlie edited|Tech delta') f.push('reads after: ' + i.articles.join('|')); return f; } },
  { id: 'TC-PC-A11 publish validates the whole file with the CI rules: a bad entry already in it blocks the publish', width: 1280, token: true, fixtures: ['podcasts-bad-entry', 'healthy'], check: async ctx => {
    const f = []; await stubApi(ctx); await fillPodcast(ctx, { url: 'https://example.com/a11', title: 'A11 valid' }); await submitPodcast(ctx);
    const r = await publishResult(ctx); if (!/podcast tags must be/.test(r)) f.push('result did not name the rule that failed: "' + r.slice(0, 160) + '"'); if ((await ctx.ev('window.__puts.length')) !== 0) f.push('an invalid file was written'); return f; } },
  { id: 'TC-PC-A06 the Blog editor is gone: no + New post, no post editor', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const r = await ctx.ev("({ add: !!document.getElementById('addPost'), text: /New post/.test(document.body.textContent), edit: [...document.querySelectorAll('[data-edit^=post]')].length })"); return r.add || r.text || r.edit ? ['blog editor remnants: ' + JSON.stringify(r)] : []; } },
  { id: 'TC-PC-R01 #blog lands on Podcasts', width: 1280, hash: '#blog', fixtures: PODS, noErrors: true, check: async ctx => {
    await sleep(900); const r = await ctx.ev("[location.hash, Math.round(document.getElementById('podcasts').getBoundingClientRect().top)]"); const f = [];
    if (r[0] !== '#podcasts') f.push('hash is ' + r[0]); if (r[1] > 200 || r[1] < -50) f.push('Podcasts not in view (top ' + r[1] + ')'); return f; } },
  { id: 'TC-PC-R01 #blog/some-old-post lands on Podcasts too', width: 1280, hash: '#blog/some-old-post', fixtures: PODS, check: async ctx => { await sleep(600); const h = await ctx.ev('location.hash'); return h === '#podcasts' ? [] : ['hash is ' + h]; } },
  { id: 'TC-PC-R01 a #blog link followed while the page is open also lands on Podcasts', width: 1280, fixtures: PODS, check: async ctx => { await ctx.ev("location.hash = '#blog'"); await sleep(500); const h = await ctx.ev('location.hash'); return h === '#podcasts' ? [] : ['hash is ' + h]; } },
  { id: 'TC-PC-R02 the page does not fetch blog.json but does fetch podcasts.json', width: 1280, fixtures: ['healthy'], check: async ctx => {
    const r = await ctx.ev("performance.getEntriesByType('resource').map(e => e.name)"), f = [];
    if (r.some(n => /blog\.json/.test(n))) f.push('blog.json was fetched'); if (!r.some(n => /podcasts\.json/.test(n))) f.push('podcasts.json was not fetched');
    const t = await ctx.ev('document.body.textContent'); if (/Fixture post/.test(t)) f.push('an archived blog post is on the page'); return f; } },
  { id: 'TC-SH-T01 reads.json never answers: the page still loads (8 s timeout) and the rest renders', width: 1280, fixtures: ['hang-reads', 'healthy'], timeout: 20000, check: async ctx => {
    const f = [...await sectionsRendered(ctx, ['reads'])]; if (ctx.ms > 14000) f.push(`took ${ctx.ms} ms; the timeout should end the wait at about 8 s`); return f; } },
  { id: 'TC-SH-T02 reads.json answers after 2 s: it still renders', width: 1280, fixtures: ['slow-reads', 'healthy'], check: ctx => sectionsRendered(ctx) },
  /* ---------- SPEC-QA Phase A: Quick add (docs/specs/quick-add/test.md) ---------- */
  { id: 'TC-QA-E01 locked: the gear opens the Add to Studio sheet (not only a token prompt)', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); const s = await qs(ctx);
    if (!s.sheet) f.push('the sheet did not open'); if (s.tok) f.push('the token prompt opened first'); if (s.admin) f.push('opening the sheet unlocked the admin'); return f; } },
  { id: 'TC-QA-E02 cold load of #add, locked: the sheet is open and the link field has the focus', width: 1280, hash: '#add', fixtures: TWO, ...qaWith(), check: async ctx => {
    const s = await qs(ctx); return [...(s.sheet ? [] : ['the sheet is not open']), ...(s.active === 'qa-url' ? [] : ['focus is on ' + s.active])]; } },
  { id: 'TC-QA-E03 a visitor sees no sheet or prompt and no link to #add (the gear itself is visible to everyone, by design)', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = [], r = await ctx.ev(`({ bg: getComputedStyle(document.getElementById('addBg')).display, tok: getComputedStyle(document.getElementById('tokBg')).display, links: document.querySelectorAll('a[href="#add"], nav a[href*="add"]').length, bar: getComputedStyle(document.getElementById('adminbar')).display })`);
    if (r.bg !== 'none' || r.tok !== 'none') f.push('a dialog is displayed: ' + JSON.stringify(r)); if (r.links) f.push('a link to #add exists'); if (r.bar !== 'none') f.push('the owner bar shows to a visitor'); return f; } },
  { id: 'TC-QA-E04 Escape and Cancel close the sheet and return the focus to where it was', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = [];
    for (const how of ['escape', 'cancel']) {
      await ctx.ev("document.getElementById('gear').focus()"); await qaOpenGear(ctx);
      if (!(await qs(ctx)).sheet) { f.push('sheet did not open for ' + how); continue; }
      if (how === 'escape') await ctx.ev("document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))"); else await qaClick(ctx, 'qa-cancel');
      const s = await qs(ctx); if (s.sheet) f.push(how + ' did not close the sheet'); if (s.active !== 'gear') f.push(how + ': focus went to ' + s.active);
    }
    return f; } },
  { id: 'TC-QA-E05 dialog semantics and a focus trap: Tab and Shift+Tab cycle inside the sheet', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx);
    const a = await ctx.ev("(() => { const d = document.getElementById('addSheet'), l = document.getElementById(d.getAttribute('aria-labelledby')); return [d.getAttribute('role'), d.getAttribute('aria-modal'), l && l.textContent.trim()]; })()");
    if (a[0] !== 'dialog' || a[1] !== 'true' || a[2] !== 'Add to Studio') f.push('dialog attributes: ' + JSON.stringify(a));
    const list = await focusables(ctx); if (list.length < 6) return [...f, 'too few focusable controls: ' + list.join()];
    await ctx.ev(`(() => { const l = [...document.querySelectorAll('#addSheet button:not([disabled]), #addSheet input, #addSheet textarea, #addSheet select, #addSheet a[href]')].filter(e => e.offsetParent !== null); l[l.length - 1].focus(); window.__prevented = !document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); })()`);
    let s = await qs(ctx); if (s.active !== list[0]) f.push('Tab from the last control went to ' + s.active + ', expected ' + list[0]);
    await ctx.ev(`(() => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); })()`);
    s = await qs(ctx); if (s.active !== list[list.length - 1]) f.push('Shift+Tab from the first control went to ' + s.active + ', expected ' + list[list.length - 1]);
    return f; } },
  { id: 'TC-QA-E06 owner feedback: an easy-to-find "Edit or delete items" button in the sheet unlocks without posting and keeps the draft', width: 375, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/e06', title: 'E06 keep' });
    const b = await ctx.ev(`(() => { const e = document.getElementById('qa-unlock'); const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), cls: e.className, h: Math.round(r.height), w: Math.round(r.width), vis: e.offsetParent !== null }; })()`);
    if (!/Edit or delete/i.test(b.text)) f.push('label: "' + b.text + '"'); if (!/\bcta\b/.test(b.cls) || /linkbtn/.test(b.cls)) f.push('not a proper button: ' + b.cls); if (b.h < 44 || b.w < 200) f.push('small: ' + b.w + 'x' + b.h); if (!b.vis) f.push('not visible');
    await qaClick(ctx, 'qa-unlock', 30); await qaToken(ctx); const s = await qs(ctx);
    if (!s.admin || s.sheet || s.tok) f.push('after the token: admin ' + s.admin + ', sheet ' + s.sheet + ', prompt ' + s.tok); if (!s.session.includes('studio-quick-draft')) f.push('the draft was dropped'); if ((await putsOf(ctx)).length) f.push('something was written');
    if (!(await ctx.ev("[...document.querySelectorAll('#articlesFeed [data-edit]')].length"))) f.push('no Edit buttons on the reads after unlocking');
    await ctx.ev("document.getElementById('addOpen').click()"); const t = await ctx.ev("document.getElementById('qa-unlock').parentElement.hidden"); if (!t) f.push('the button still shows while unlocked'); return f; } },
  { id: 'TC-QA-P01 Paste from clipboard fills the normalised link and previews the destination in one line', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); await qaClip(ctx, 'https://example.com/a?utm_source=x&id=5#frag'); await qaClick(ctx, 'qa-paste', 250);
    const s = await qs(ctx); if (s.fields.url !== 'https://example.com/a?id=5') f.push('link field: ' + s.fields.url); if (!/example\.com/.test(s.dest) || /\n/.test(s.dest)) f.push('destination preview: "' + s.dest + '"');
    if ((await ctx.ev('window.__clip.reads')) !== 1) f.push('clipboard reads: ' + await ctx.ev('window.__clip.reads')); return f; } },
  { id: 'TC-QA-P02 a clipboard with no link gives an announced inline message and changes nothing', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://keep.example.com/x', title: 'Keep me' }); await qaClip(ctx, 'just some words, no link'); await qaClick(ctx, 'qa-paste', 250);
    const s = await qs(ctx), role = await ctx.ev("document.getElementById('qa-url-err').getAttribute('role')");
    if (!s.errs.url) f.push('no inline message'); if (role !== 'alert') f.push('message is not announced (role ' + role + ')'); if (s.fields.url !== 'https://keep.example.com/x' || s.fields.title !== 'Keep me') f.push('fields changed: ' + JSON.stringify(s.fields)); return f; } },
  { id: 'TC-QA-P03 share text "Title, newline, link" gives the link and prefills the title (an existing title is kept)', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); await qaClip(ctx, 'My Great Read\nhttps://example.com/great'); await qaClick(ctx, 'qa-paste', 250);
    let s = await qs(ctx); if (s.fields.url !== 'https://example.com/great' || s.fields.title !== 'My Great Read') f.push('got ' + JSON.stringify(s.fields));
    await qaClip(ctx, 'Another Title\nhttps://example.com/other'); await qaClick(ctx, 'qa-paste', 250); s = await qs(ctx);
    if (s.fields.url !== 'https://example.com/other') f.push('second link not taken: ' + s.fields.url); if (s.fields.title !== 'My Great Read') f.push('the title already there was overwritten: ' + s.fields.title); return f; } },
  { id: 'TC-QA-P04 javascript:, data:, credentials and //host in the clipboard are refused with the composers\' message; tracking parameters and fragment are dropped', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://keep.example.com/x' });
    for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'https://user:pw@evil.example.com/x', '//evil.example.com/x', 'file:///etc/passwd']) {
      await qaClip(ctx, bad); await qaClick(ctx, 'qa-paste', 150); const s = await qs(ctx);
      if (s.errs.url !== QA_MSG) f.push(JSON.stringify(bad) + ': message "' + s.errs.url + '"'); if (s.fields.url !== 'https://keep.example.com/x') f.push(JSON.stringify(bad) + ' changed the field to ' + s.fields.url);
    }
    await qaClip(ctx, 'https://example.com/p?fbclid=1&gclid=2&a=b#section'); await qaClick(ctx, 'qa-paste', 150); const s = await qs(ctx); if (s.fields.url !== 'https://example.com/p?a=b') f.push('tracking: ' + s.fields.url); if (s.errs.url) f.push('an error is still shown after a good paste'); return f; } },
  { id: 'TC-QA-P06 typing the link, or pasting share text into the field by hand, works the same as the button', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/typed' }); let s = await qs(ctx); if (!/example\.com/.test(s.dest)) f.push('typing gave no preview: "' + s.dest + '"');
    await ctx.ev("(() => { const e = document.getElementById('qa-url'); e.focus(); const dt = new DataTransfer(); dt.setData('text/plain', 'Pasted By Hand\\nhttps://example.org/p?utm_source=z'); e.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()"); await sleep(150);
    s = await qs(ctx); if (s.fields.url !== 'https://example.org/p') f.push('pasted share text: link ' + s.fields.url); if (s.fields.title !== 'Pasted By Hand') f.push('pasted share text: title "' + s.fields.title + '"');
    if ((await ctx.ev('window.__clip.reads')) !== 0) f.push('the clipboard API was read for a hand paste'); return f; } },
  { id: 'TC-QA-P07 the clipboard is not read on load, on #add or when the sheet opens; only on the tap', width: 1280, hash: '#add', fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = [], n0 = await ctx.ev('window.__clip.reads'); if (n0 !== 0) f.push('read ' + n0 + ' time(s) before any tap'); await qaClose(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/x' });
    if ((await ctx.ev('window.__clip.reads')) !== 0) f.push('read when the sheet opened or the owner typed'); await qaClip(ctx, 'https://example.com/y'); await qaClick(ctx, 'qa-paste', 150);
    if ((await ctx.ev('window.__clip.reads')) !== 1) f.push('expected exactly one read after the tap'); return f; } },
  { id: 'TC-QA-K02 Spotify and Apple Podcasts links preselect Podcast, others Read; the owner can change it and the choice then holds', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); let s = await qs(ctx); if (s.kind !== 'read') f.push('default kind ' + s.kind);
    await qaClip(ctx, 'https://open.spotify.com/episode/abc'); await qaClick(ctx, 'qa-paste', 150); s = await qs(ctx); if (s.kind !== 'podcast') f.push('Spotify gave ' + s.kind);
    await qaClip(ctx, 'https://podcasts.apple.com/us/podcast/x/id1'); await qaClick(ctx, 'qa-paste', 150); s = await qs(ctx); if (s.kind !== 'podcast') f.push('Apple Podcasts gave ' + s.kind);
    await qaClip(ctx, 'https://example.com/blog'); await qaClick(ctx, 'qa-paste', 150); s = await qs(ctx); if (s.kind !== 'read') f.push('a blog gave ' + s.kind);
    await ctx.ev("document.querySelector('#qa-kind input[value=podcast]').click()"); await qaFill(ctx, { url: 'https://example.com/typed-after-choice' }); s = await qs(ctx); if (s.kind !== 'podcast') f.push('typing a link overrode the owner\'s choice: ' + s.kind); return f; } },
  { id: 'TC-QA-K03 Read shows Section (the tab being viewed, then the last used), Type, Tags and Take, and no Show', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await ctx.ev("document.querySelectorAll('#readTabs [role=tab]')[1].click()"); await qaOpenGear(ctx);
    const r = await ctx.ev(`({ section: (document.querySelector('#qa-section-opts input:checked') || {}).value, n: document.querySelectorAll('#qa-section-opts input').length, type: !!document.getElementById('qa-type').offsetParent, tags: !!document.getElementById('qa-tags').offsetParent, take: !!document.getElementById('qa-comment').offsetParent, show: !!document.getElementById('qa-show').offsetParent })`);
    if (r.section !== 'other') f.push('Section should default to the tab being viewed (Others), got ' + r.section); if (r.n !== 2) f.push(r.n + ' section options'); if (!r.type || !r.tags || !r.take) f.push('Type, Tags or Take is not shown: ' + JSON.stringify(r)); if (r.show) f.push('Show is shown for a Read');
    return f; } },
  { id: 'TC-QA-K03 the last used section is the next default', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await ctx.ev("document.getElementById('addOpen').click()"); await qaFill(ctx, { url: 'https://example.com/k03b', title: 'K03b', section: 'other' }); await qaClick(ctx, 'qa-draft', 300);
    await ctx.ev("document.getElementById('addOpen').click()"); const s = await qs(ctx); if (s.section !== 'other') f.push('the next default is ' + s.section + ', expected other (the last used)'); return f; } },
  { id: 'TC-QA-K04 Podcast shows Show, Tags and Take, and no Section or Type', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); await qaFill(ctx, { kind: 'podcast' });
    const r = await ctx.ev(`({ section: !!document.getElementById('qa-section-opts').offsetParent, type: !!document.getElementById('qa-type').offsetParent, show: !!document.getElementById('qa-show').offsetParent, tags: !!document.getElementById('qa-tags').offsetParent, take: !!document.getElementById('qa-comment').offsetParent })`);
    if (r.section || r.type) f.push('Section or Type is shown for a Podcast'); if (!r.show || !r.tags || !r.take) f.push('Show, Tags or Take missing: ' + JSON.stringify(r)); return f; } },
  { id: 'TC-QA-K05 parity: the same inputs give the same errors and the same stored entry as the two existing composers', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = [], reads = [{ url: '', title: '' }, { url: 'javascript:x', title: 't' }, { url: 'https://example.com/p1', title: 'x'.repeat(141) }, { url: 'https://example.com/p2', title: 'ok', comment: 'c'.repeat(281) },
      { url: 'https://example.com/p3?utm_source=a#f', title: '  Fine  ', comment: ' take ', tags: 'a, B, c d, a, e, f, g', type: 'video', section: 'other' }, { url: 'https://user:pw@example.com/x', title: 'creds' }],
      pods = [{ url: '', title: '' }, { url: 'https://example.com/q1', title: 'x'.repeat(141) }, { url: 'https://example.com/q2', title: 'ok', show: 's'.repeat(81) }, { url: 'https://example.com/q3', title: 'ok', comment: 'c'.repeat(281) },
      { url: 'https://example.com/q4?fbclid=1', title: ' Ep ', show: ' The Show ', comment: ' take ', tags: 'ai, History, ai' }];
    const strip = e => { if (!e) return null; const o = { ...e }; delete o.id; delete o.added; return o; };
    for (const r of reads) {
      const c = await ctx.ev(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; const o = ${JSON.stringify(r)};
        document.getElementById('composerOpen').click(); set('cf-url', o.url); set('cf-title', o.title); set('cf-comment', o.comment || ''); set('cf-tags', o.tags || ''); if (o.type) document.getElementById('cf-kind').value = o.type;
        document.querySelector('#cf-category input[value=' + (o.section || 'technical') + ']').click(); const n = state.reads.articles.length; document.getElementById('composerForm').requestSubmit();
        const errs = ['url', 'title', 'comment', 'category'].map(k => document.getElementById('cf-' + k + '-err').textContent).join('|'), added = state.reads.articles.length > n ? JSON.parse(JSON.stringify(state.reads.articles.shift())) : null;
        document.getElementById('cf-cancel').click(); return { errs, added }; })()`);
      await ctx.ev("document.getElementById('addOpen').click()"); await qaFill(ctx, { ...r, kind: 'read', section: r.section || 'technical', comment: r.comment || '', tags: r.tags || '' }); await qaClick(ctx, 'qa-draft', 150);
      const s = await qs(ctx), added = await ctx.ev("state.reads.articles.length ? JSON.parse(JSON.stringify(state.reads.articles[0])) : null"), isNew = c.added && added && added.url === c.added.url && added.title === c.added.title;
      const errs = ['url', 'title', 'comment', 'category'].map(k => s.errs[k]).join('|');
      if (c.added) { if (!isNew) f.push('read ' + JSON.stringify(r.url) + ': the composer stored an entry but the sheet did not'); else { if (JSON.stringify(strip(added)) !== JSON.stringify(strip(c.added))) f.push('read ' + r.url + ': stored entries differ ' + JSON.stringify([strip(added), strip(c.added)])); await ctx.ev('state.reads.articles.shift()'); } }
      else { if (errs !== c.errs) f.push('read ' + JSON.stringify(r.url) + ': errors differ: sheet "' + errs + '" composer "' + c.errs + '"'); if (s.sheet === false) f.push('read ' + JSON.stringify(r.url) + ': the sheet closed on an invalid entry'); await qaClick(ctx, 'qa-cancel'); }
    }
    for (const r of pods) {
      const c = await ctx.ev(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; const o = ${JSON.stringify(r)};
        document.getElementById('podcastComposerOpen').click(); set('pf-url', o.url); set('pf-title', o.title); set('pf-show', o.show || ''); set('pf-comment', o.comment || ''); set('pf-tags', o.tags || ''); const n = state.podcasts.podcasts.length; document.getElementById('podcastForm').requestSubmit();
        const errs = ['url', 'title', 'show', 'comment'].map(k => document.getElementById('pf-' + k + '-err').textContent).join('|'), added = state.podcasts.podcasts.length > n ? JSON.parse(JSON.stringify(state.podcasts.podcasts.shift())) : null;
        document.getElementById('pf-cancel').click(); return { errs, added }; })()`);
      await ctx.ev("document.getElementById('addOpen').click()"); await qaFill(ctx, { ...r, kind: 'podcast', show: r.show || '', comment: r.comment || '', tags: r.tags || '' }); await qaClick(ctx, 'qa-draft', 150);
      const s = await qs(ctx), added = await ctx.ev("state.podcasts.podcasts.length ? JSON.parse(JSON.stringify(state.podcasts.podcasts[0])) : null"), isNew = c.added && added && added.url === c.added.url && added.title === c.added.title;
      const errs = ['url', 'title', 'show', 'comment'].map(k => s.errs[k]).join('|');
      if (c.added) { if (!isNew) f.push('podcast ' + JSON.stringify(r.url) + ': the composer stored an entry but the sheet did not'); else { if (JSON.stringify(strip(added)) !== JSON.stringify(strip(c.added))) f.push('podcast ' + r.url + ': stored entries differ ' + JSON.stringify([strip(added), strip(c.added)])); await ctx.ev('state.podcasts.podcasts.shift()'); } }
      else { if (errs !== c.errs) f.push('podcast ' + JSON.stringify(r.url) + ': errors differ: sheet "' + errs + '" composer "' + c.errs + '"'); await qaClick(ctx, 'qa-cancel'); }
    }
    return f; } },
  { id: 'TC-QA-U01 locked: Post and publish opens the token prompt over the sheet; the draft is intact; nothing was sent', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/u01', title: 'U01 title', comment: 'my take', tags: 'ai' }); await qaClick(ctx, 'qa-publish', 200);
    const s = await qs(ctx); if (!s.tok) f.push('no token prompt'); if (!s.sheet) f.push('the sheet went away'); if (s.fields.title !== 'U01 title' || s.fields.comment !== 'my take' || s.fields.url !== 'https://example.com/u01') f.push('draft changed: ' + JSON.stringify(s.fields));
    if (s.active !== 'pat') f.push('focus is on ' + s.active + ', expected the token field'); if (await apiCalls(ctx)) f.push('an API call was made before a token was given'); return f; } },
  { id: 'TC-QA-U02 a correct token continues the same action: one PUT of content/reads.json with the item, using the token', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/u02', title: 'U02 title', section: 'other' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 700);
    const puts = await putsOf(ctx); if (puts.length !== 1) return ['expected one PUT, got ' + puts.map(p => p.u).join(', ')];
    const file = putFile(puts, 'reads'); if (!file) return ['the PUT was not of content/reads.json: ' + puts[0].u]; const mine = file.articles.find(a => a.title === 'U02 title');
    if (!mine || mine.category !== 'other' || mine.url !== 'https://example.com/u02') f.push('the item is wrong or missing: ' + JSON.stringify(mine)); if (file.schema_version !== 2) f.push('schema_version ' + file.schema_version);
    const auth = await ctx.ev("[...new Set(window.__calls.map(c => c.auth))]"); if (auth.length !== 1 || auth[0] !== 'Bearer ' + QA_TOKEN) f.push('requests were not made with the token typed: ' + JSON.stringify(auth)); return f; } },
  { id: 'TC-QA-U03 a wrong token (401): a clear message, still on the prompt, draft intact, nothing written, still locked', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx, { user: 401 }); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/u03', title: 'U03 title' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, 'wrong-token');
    const s = await qs(ctx); if (!s.tok) f.push('the prompt went away'); if (!/rejected|401|token/i.test(s.tokErr)) f.push('no clear message: "' + s.tokErr + '"'); if (s.tokErr.includes('wrong-token')) f.push('the message contains the token');
    if (s.fields.title !== 'U03 title') f.push('draft changed'); if (s.admin) f.push('became unlocked'); if (s.session.includes('studio-admin-pat')) f.push('a token was stored'); if ((await putsOf(ctx)).length) f.push('something was written'); return f; } },
  { id: 'TC-QA-U03 a token that belongs to someone else is refused', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    await stubGh(ctx, { login: 'someone-else' }); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/u03b', title: 'U03b' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx);
    const s = await qs(ctx); return [...(s.tok && /someone-else/.test(s.tokErr) ? [] : ['not refused with a message naming the login: "' + s.tokErr + '"']), ...(s.admin || s.session.includes('studio-admin-pat') ? ['it unlocked'] : [])]; } },
  { id: 'TC-QA-U04 Cancel on the prompt (button or Escape) returns to the sheet with the draft intact and nothing written', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx);
    for (const how of ['button', 'escape']) {
      await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/u04', title: 'U04 ' + how }); await qaClick(ctx, 'qa-publish', 150);
      if (how === 'button') await qaClick(ctx, 'tok-cancel', 100); else await ctx.ev("document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))");
      const s = await qs(ctx); if (s.tok) f.push(how + ': the prompt is still open'); if (!s.sheet) f.push(how + ': the sheet closed'); if (s.fields.title !== 'U04 ' + how) f.push(how + ': draft changed'); if (s.active !== 'qa-publish') f.push(how + ': focus went to ' + s.active);
      await qaClick(ctx, 'qa-cancel');
    }
    if ((await apiCalls(ctx)) || (await putsOf(ctx)).length) f.push('something was sent'); return f; } },
  { id: 'TC-QA-U05 the token prompt in the browser: a form with a labelled username (studio-admin), current-password, no autocomplete="off"', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = [], r = await ctx.ev(`(() => { const form = document.getElementById('tokForm'), u = document.getElementById('tok-user'), p = document.getElementById('pat');
      return { inForm: form.contains(u) && form.contains(p), uAuto: u.autocomplete, pAuto: p.autocomplete, pType: p.type, uVal: u.value, uLabel: !!document.querySelector('label[for=tok-user]'), pLabel: !!document.querySelector('label[for=pat]'), off: document.querySelectorAll('#tokBg [autocomplete=off]').length, submit: !!form.querySelector('button[type=submit]'), readonly: u.readOnly }; })()`);
    if (!r.inForm) f.push('fields are not inside the form'); if (r.uAuto !== 'username' || r.pAuto !== 'current-password' || r.pType !== 'password') f.push('attributes: ' + JSON.stringify(r)); if (r.uVal !== 'studio-admin') f.push('username value ' + r.uVal);
    if (!r.uLabel || !r.pLabel) f.push('a field has no label'); if (r.off) f.push('autocomplete="off" present'); if (!r.submit) f.push('no submit button'); return f; } },
  { id: 'TC-QA-U06 the token appears nowhere except the one tab sessionStorage key: not in the page, console, draft or localStorage (checked while unlocked after a failed publish)', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx, { put: 500 }); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/u06', title: 'U06' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 800);
    const r = await ctx.ev(`(() => { const T = ${JSON.stringify(QA_TOKEN)}, s = {}; for (const k of Object.keys(sessionStorage)) s[k] = sessionStorage.getItem(k).includes(T); const l = Object.keys(localStorage).filter(k => localStorage.getItem(k).includes(T));
      return { admin: document.body.classList.contains('admin'), html: document.documentElement.outerHTML.includes(T), text: document.body.innerText.includes(T), session: s, local: l, consoleHit: window.__console.some(x => x.includes(T)), inputs: [...document.querySelectorAll('input, textarea')].filter(e => e.id !== 'pat' && e.value.includes(T)).length }; })()`);
    if (!r.admin) f.push('not unlocked, so the check proves nothing'); if (r.html || r.text) f.push('the token is in the page'); if (r.consoleHit) f.push('the token is in the console'); if (r.local.length) f.push('in localStorage: ' + r.local);
    const keys = Object.keys(r.session).filter(k => r.session[k]); if (keys.join() !== 'studio-admin-pat') f.push('sessionStorage keys holding the token: ' + keys.join()); if (r.inputs) f.push('the token is in another field'); return f; } },
  { id: 'TC-QA-U07 opening the sheet, pasting, typing and choosing a kind make no API call', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    await stubGh(ctx); await qaOpenGear(ctx); await qaClip(ctx, 'Title\nhttps://open.spotify.com/episode/x'); await qaClick(ctx, 'qa-paste', 150); await qaFill(ctx, { title: 'T', comment: 'c', tags: 'a', kind: 'read' }); await qaClick(ctx, 'qa-cancel');
    const n = await apiCalls(ctx); return n ? ['made ' + n + ' API call(s)'] : []; } },
  { id: 'TC-QA-L01 Post and publish a Read: one PUT of content/reads.json, valid, under the chosen Section', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/l01?utm_source=x', title: 'L01 read', comment: 'because', tags: 'ai, Tools', type: 'tool', section: 'technical' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 800);
    const puts = await putsOf(ctx); if (puts.length !== 1 || !putFile(puts, 'reads')) return ['expected one PUT of reads.json, got ' + puts.map(p => p.u).join(', ')];
    const file = putFile(puts, 'reads'), mine = file.articles[0]; if (!mine || mine.title !== 'L01 read') return ['the item is not first in the file']; if (mine.url !== 'https://example.com/l01' || mine.category !== 'technical' || mine.kind !== 'tool' || mine.comment !== 'because' || mine.tags.join() !== 'ai,tools') f.push('entry: ' + JSON.stringify(mine));
    if (file.articles.length !== 7) f.push('expected 6 existing reads plus the new one, got ' + file.articles.length); if (Object.keys(file).join() !== 'schema_version,books,articles') f.push('keys ' + Object.keys(file));
    const card = await ctx.ev("[...document.querySelectorAll('#articlesFeed .read-title')].map(e => e.textContent).join('|')"); if (!/L01 read/.test(card)) f.push('the new read is not on the page'); return f; } },
  { id: 'TC-QA-L01 Post and publish a Podcast: one PUT of content/podcasts.json with the entry first', width: 1280, fixtures: PODS, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await qaOpenGear(ctx); await qaClip(ctx, 'Ep Title\nhttps://open.spotify.com/episode/l01'); await qaClick(ctx, 'qa-paste', 150); await qaFill(ctx, { show: 'The Show', tags: 'ai' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 800);
    const puts = await putsOf(ctx); if (puts.length !== 1 || !putFile(puts, 'podcasts')) return ['expected one PUT of podcasts.json, got ' + puts.map(p => p.u).join(', ')];
    const file = putFile(puts, 'podcasts'), mine = file.podcasts[0]; if (!mine || mine.title !== 'Ep Title' || mine.show !== 'The Show' || mine.url !== 'https://open.spotify.com/episode/l01') f.push('entry: ' + JSON.stringify(mine)); if (file.podcasts.length !== 6) f.push('expected 5 + 1, got ' + file.podcasts.length); if (file.schema_version !== 1) f.push('schema_version ' + file.schema_version); return f; } },
  { id: 'TC-QA-L02 Post as draft: marked unpublished, no API write; Publish changes later writes it and locks', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/l02', title: 'L02 draft' }); await qaClick(ctx, 'qa-draft', 200); await qaToken(ctx, QA_TOKEN, 500);
    let s = await qs(ctx); const dirty = await ctx.ev("document.getElementById('dirtyinfo').textContent");
    if (!/reads\.json/.test(dirty)) f.push('dirty info does not name reads.json: ' + dirty); if ((await putsOf(ctx)).length) f.push('written before Publish changes'); if (s.sheet) f.push('the sheet stayed open after the draft was posted'); if (!s.admin) f.push('admin should stay on after a draft');
    if (!(await ctx.ev("[...document.querySelectorAll('#articlesFeed .read-title')].some(e => /L02 draft/.test(e.textContent))"))) f.push('the draft is not listed');
    await ctx.ev("document.getElementById('publishBtn').click()"); await sleep(800); const puts = await putsOf(ctx); if (puts.length !== 1 || !(putFile(puts, 'reads') || { articles: [] }).articles.some(a => a.title === 'L02 draft')) f.push('Publish changes did not write the draft: ' + puts.map(p => p.u).join());
    s = await qs(ctx); if (s.admin) f.push('Publish changes did not lock'); return f; } },
  { id: 'TC-QA-L03 a successful publish locks at once: admin ends, the token is gone from storage, "Published and locked", the draft key is gone, the sheet is closed', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/l03', title: 'L03' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 900);
    const s = await qs(ctx); if (s.admin) f.push('still in admin mode'); if (s.session.length) f.push('sessionStorage still holds: ' + s.session); if (!/Published and locked/.test(s.status)) f.push('status says "' + s.status + '"'); if (s.sheet || s.tok) f.push('a dialog is still open');
    const bar = await ctx.ev("getComputedStyle(document.getElementById('adminbar')).display"); if (bar !== 'none') f.push('the owner bar is still shown'); return f; } },
  { id: 'TC-QA-L04 the existing Publish changes button also locks after success, and not after a failure', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx, { put: 500 }); await ctx.ev("document.getElementById('addBook').click(); document.querySelector('#modal [data-k=title]').value = 'L04 book'; document.querySelector('#modal [data-k=author]').value = 'A'; document.getElementById('ms').click()");
    await ctx.ev("document.getElementById('publishBtn').click()"); await sleep(800); let s = await qs(ctx); if (!s.admin) f.push('a FAILED publish locked the admin');
    await ctx.ev("document.querySelector('#modal #mc').click()"); await stubGh(ctx); await ctx.ev("document.getElementById('publishBtn').click()"); await sleep(900); s = await qs(ctx);
    if (s.admin) f.push('a successful Publish changes did not lock'); if (s.session.includes('studio-admin-pat')) f.push('the token is still stored'); if (!/Published and locked/.test(s.status) && !/Published and locked/.test(await ctx.ev('document.body.innerText'))) f.push('no "Published and locked"');
    const res = await ctx.ev("(document.querySelector('#modal .pre-result') || {}).textContent || ''"); if (!/committed/.test(res)) f.push('result: "' + res.slice(0, 100) + '"'); return f; } },
  { id: 'TC-QA-L05 a failed publish (500) stays unlocked with the error, keeps the sheet and draft; a retry works and then locks (TC-QA-L07: draft key gone)', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx, { put: 500 }); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/l05', title: 'L05', comment: 'keep' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 900);
    let s = await qs(ctx); if (!s.admin) f.push('locked after a failure'); if (!s.sheet) f.push('the sheet closed'); if (!/500|failed/i.test(s.msg)) f.push('no error shown: "' + s.msg + '"'); if (s.fields.title !== 'L05' || s.fields.comment !== 'keep') f.push('draft lost'); if (!s.session.includes('studio-quick-draft')) f.push('draft key removed');
    if (await ctx.ev("document.getElementById('qa-publish').disabled")) f.push('Post and publish stayed disabled, so no retry is possible');
    await stubGh(ctx); await qaClick(ctx, 'qa-publish', 900); s = await qs(ctx); const puts = await putsOf(ctx); if (puts.length !== 1) f.push('retry wrote ' + puts.length + ' time(s)'); if (s.admin) f.push('did not lock after the retry'); if (s.session.includes('studio-quick-draft')) f.push('draft key survived a success'); if (s.msg) f.push('an old error is still shown'); return f; } },
  { id: 'TC-QA-L05 GitHub rejects an expired token during the publish (401): stays unlocked, says so', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    await ctx.ev("(() => { const real = window.fetch.bind(window); window.fetch = (u, o) => String(u).startsWith('https://api.github.com') ? Promise.resolve(new Response('{}', { status: 401 })) : real(u, o); })()");
    await ctx.ev("document.getElementById('addOpen').click()"); await qaFill(ctx, { url: 'https://example.com/l05b', title: 'L05b' }); await qaClick(ctx, 'qa-publish', 700); const s = await qs(ctx);
    return [...(s.admin && s.sheet ? [] : ['not left open and unlocked']), ...(/401/.test(s.msg) ? [] : ['message: "' + s.msg + '"'])]; } },
  { id: 'TC-QA-L06 the PC-B guards hold through Quick add: GitHub\'s copy differs from the loaded one; nothing is written, stays unlocked, draft kept', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = [], loaded = JSON.parse(fs.readFileSync(path.join(FIX, 'reads-two-sections', 'content', 'reads.json'), 'utf8'));
    await stubGh(ctx, { remote: { 'content/reads.json': JSON.stringify({ ...loaded, articles: [...loaded.articles, { id: 9, url: 'https://example.com/elsewhere', title: 'Added elsewhere' }] }) } });
    await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/l06', title: 'L06' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 900);
    const s = await qs(ctx); if (!/changed on GitHub/i.test(s.msg)) f.push('not refused: "' + s.msg.slice(0, 100) + '"'); if ((await putsOf(ctx)).length) f.push('it wrote anyway'); if (!s.admin || !s.sheet || s.fields.title !== 'L06') f.push('state after the refusal: ' + JSON.stringify({ admin: s.admin, sheet: s.sheet, title: s.fields.title })); return f; } },
  { id: 'TC-QA-L06 a reads.json newer than the page understands: refused, nothing written', width: 1280, fixtures: ['future-reads-version', 'healthy'], ...qaWith(), check: async ctx => {
    await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/l06b', title: 'L06b' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 900);
    const s = await qs(ctx); return [...(/newer|not published/i.test(s.msg) ? [] : ['not refused: "' + s.msg + '"']), ...((await putsOf(ctx)).length ? ['it wrote anyway'] : [])]; } },
  { id: 'TC-QA-L06 a reads.json that failed to load (unknown content): refused, nothing written', width: 1280, fixtures: ['bad-reads-json', 'healthy'], ...qaWith(), check: async ctx => {
    await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/l06c', title: 'L06c' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 900);
    const s = await qs(ctx); return [...(/not published|could not be loaded/i.test(s.msg) ? [] : ['not refused: "' + s.msg + '"']), ...((await putsOf(ctx)).length ? ['it wrote anyway'] : [])]; } },
  { id: 'TC-QA-L06 an invalid entry already in podcasts.json blocks a Quick add podcast publish (whole-file validation)', width: 1280, fixtures: ['podcasts-bad-entry', 'healthy'], ...qaWith(), check: async ctx => {
    await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { kind: 'podcast', url: 'https://example.com/l06d', title: 'L06d' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 900);
    const s = await qs(ctx); return [...(/podcast tags must be/.test(s.msg) ? [] : ['the rule that failed is not named: "' + s.msg + '"']), ...((await putsOf(ctx)).length ? ['an invalid file was written'] : [])]; } },
  { id: 'TC-QA-L09 review F1: Post before the page knows what is on GitHub (boot not finished) is refused; nothing is written, so the published list cannot be replaced', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await ctx.ev("delete snap['content/reads.json']; state.reads.articles = []; true"); await qaOpenGear(ctx);
    await qaFill(ctx, { url: 'https://example.com/early', title: 'Early' }); await qaClick(ctx, 'qa-publish', 30); const s = await qs(ctx);
    if ((await putsOf(ctx)).length) f.push('it wrote a file with only the new entry'); if (!/not finished loading|reload/i.test(s.msg)) f.push('no refusal message: "' + s.msg + '"'); if (!s.sheet || s.tok) f.push('should refuse on the sheet, before any token prompt'); if (await apiCalls(ctx)) f.push('API calls were made'); return f; } },
  { id: 'TC-QA-U08 review F2: Cancel while the token is being checked stores nothing, unlocks nothing and shows no internal error', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx, { userDelay: 400 }); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/u08', title: 'U08' }); await qaClick(ctx, 'qa-publish', 30);
    await ctx.ev(`(() => { document.getElementById('pat').value = ${JSON.stringify(QA_TOKEN)}; document.getElementById('tokForm').requestSubmit(); })()`); await sleep(100); await qaClick(ctx, 'tok-cancel'); await sleep(700);
    const s = await qs(ctx); if (s.session.includes('studio-admin-pat')) f.push('the token was stored after Cancel'); if (s.admin) f.push('admin switched on after Cancel'); if (/not a function|undefined/.test(s.tokErr + s.msg)) f.push('internal error text shown: ' + s.tokErr + s.msg); if ((await putsOf(ctx)).length) f.push('something was written'); if (!s.sheet || s.tok) f.push('should be back on the sheet'); return f; } },
  { id: 'TC-QA-L10 review F3: pending inline changes to the same file are announced before a Quick add publishes them', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await ctx.ev("window.confirm = () => true; [...document.querySelectorAll('#articlesFeed [data-del]')][0].click()"); await ctx.ev("document.getElementById('addOpen').click()");
    await qaFill(ctx, { url: 'https://example.com/l10', title: 'L10' }); await qaClick(ctx, 'qa-publish', 30); const s = await qs(ctx);
    if ((await putsOf(ctx)).length) f.push('published without telling the owner about the other pending change'); if (!/unpublished changes/i.test(s.msg)) f.push('no warning: "' + s.msg + '"');
    await qaClick(ctx, 'qa-publish', 30); await settle(ctx); const puts = await putsOf(ctx); if (puts.length !== 1) f.push('the second press did not publish (' + puts.length + ' PUTs)'); return f; } },
  { id: 'TC-QA-L11 review F5 and F7: text in an inline composer survives the lock after a publish; focus is kept sensible on failure and success', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await ctx.ev("document.getElementById('composerOpen').click(); const e = document.getElementById('cf-title'); e.value = 'typed inline'; e.dispatchEvent(new Event('input', { bubbles: true }))");
    await stubGh(ctx, { put: 500 }); await ctx.ev("document.getElementById('addOpen').click()"); await qaFill(ctx, { url: 'https://example.com/l11', title: 'L11' }); await qaClick(ctx, 'qa-publish', 30); await settle(ctx);
    let s = await qs(ctx); if (s.active !== 'qa-publish') f.push('after a failure focus is on "' + s.active + '"');
    await stubGh(ctx); await qaClick(ctx, 'qa-publish', 30); await settle(ctx); s = await qs(ctx); if (s.active !== 'gear') f.push('after the lock focus is on "' + s.active + '"');
    const v = await ctx.ev("document.getElementById('cf-title').value"); if (v !== 'typed inline') f.push('inline composer text was cleared: "' + v + '"'); return f; } },
  { id: 'TC-QA-L12 review N1: Post as draft before the page knows what is on GitHub is refused, so the entry is not silently lost when boot replaces the lists', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await ctx.ev("delete snap['content/reads.json']; state.reads.articles = []; true"); await ctx.ev("document.getElementById('addOpen').click()");
    await qaFill(ctx, { url: 'https://example.com/n1', title: 'N1' }); await qaClick(ctx, 'qa-draft', 30); const s = await qs(ctx);
    if (!/not finished loading|reload/i.test(s.msg)) f.push('no refusal message: "' + s.msg + '"'); if (!s.sheet) f.push('the sheet closed, losing the input'); if (await ctx.ev("state.dirty.reads")) f.push('marked as a pending change'); return f; } },
  { id: 'TC-QA-D01 fill the sheet, reload the page in the same tab, open the sheet: the values are restored', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://open.spotify.com/episode/d01', title: 'D01 title', comment: 'D01 take', tags: 'ai, x', kind: 'podcast' }); await reloadPage(ctx);
    let s = await qs(ctx); if (s.sheet) f.push('the sheet reopened by itself without #add'); await qaOpenGear(ctx); s = await qs(ctx);
    if (s.fields.url !== 'https://open.spotify.com/episode/d01' || s.fields.title !== 'D01 title' || s.fields.comment !== 'D01 take' || s.fields.tags !== 'ai, x') f.push('values: ' + JSON.stringify(s.fields)); if (s.kind !== 'podcast') f.push('kind ' + s.kind); return f; } },
  { id: 'TC-QA-D01 a draft is restored on a cold load of #add too', width: 1280, hash: '#add', fixtures: TWO, ...qaWith(), check: async ctx => {
    await qaFill(ctx, { url: 'https://example.com/d01b', title: 'D01b' }); await reloadPage(ctx); const s = await qs(ctx);
    return [...(s.sheet ? [] : ['the sheet did not reopen on #add']), ...(s.fields.title === 'D01b' ? [] : ['title: ' + s.fields.title])]; } },
  { id: 'TC-QA-D02 the draft holds link, title, take, tags and kind only, and never the token (checked after a token was typed)', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx, { put: 500 }); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/d02', title: 'D02', comment: 'c', tags: 't' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 800);
    const raw = await ctx.ev("sessionStorage.getItem('studio-quick-draft')"); if (!raw) return ['no draft key']; if (raw.includes(QA_TOKEN) || /token|pat/i.test(Object.keys(JSON.parse(raw)).join())) f.push('the draft mentions the token');
    const keys = Object.keys(JSON.parse(raw)).sort().join(); if (keys !== 'comment,kind,tags,title,url') f.push('draft keys: ' + keys); return f; } },
  { id: 'TC-QA-D03 storage keys: a visitor who never opens the sheet has none; using the sheet adds only the draft key; unlocked adds only the token key', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; let s = await qs(ctx); if (s.session.length) f.push('a fresh visitor has session keys: ' + s.session); if (s.local.some(k => k !== 'studio-theme')) f.push('unexpected local keys: ' + s.local);
    await qaOpenGear(ctx); s = await qs(ctx); if (s.session.length) f.push('merely opening the sheet wrote: ' + s.session); await qaFill(ctx, { url: 'https://example.com/d03' }); s = await qs(ctx); if (s.session.join() !== 'studio-quick-draft') f.push('after typing: ' + s.session);
    await stubGh(ctx, { put: 500 }); await qaFill(ctx, { title: 'D03' }); await qaClick(ctx, 'qa-publish', 200); await qaToken(ctx, QA_TOKEN, 700); s = await qs(ctx); if (s.session.join() !== 'studio-admin-pat,studio-quick-draft') f.push('unlocked: ' + s.session);
    if (s.local.some(k => k !== 'studio-theme')) f.push('local keys after: ' + s.local); return f; } },
  { id: 'TC-QA-D04 the draft is cleared by Cancel and by Escape; an idle lock keeps it', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await ctx.ev("document.getElementById('addOpen').click()"); await qaFill(ctx, { url: 'https://example.com/d04', title: 'D04' }); await ctx.ev("lock()"); let s = await qs(ctx);
    if (s.admin) f.push('lock() did not lock'); if (!s.session.includes('studio-quick-draft')) f.push('an idle or manual lock cleared the draft'); if (!s.sheet) f.push('the lock closed the sheet'); await qaClick(ctx, 'qa-cancel'); s = await qs(ctx); if (s.session.includes('studio-quick-draft')) f.push('Cancel kept the draft');
    await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/d04b' }); await ctx.ev("document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))"); s = await qs(ctx); if (s.session.includes('studio-quick-draft')) f.push('Escape kept the draft');
    await qaOpenGear(ctx); s = await qs(ctx); if (s.fields.url) f.push('a cleared draft came back: ' + s.fields.url); return f; } },
  { id: 'TC-QA-H01 cold load of #add at 375 px: sheet open, link field focused, Paste visible, no horizontal overflow, targets of at least 44 px', width: 375, hash: '#add', fixtures: TWO, ...qaWith(), noErrors: true, check: async ctx => {
    const f = [], s = await qs(ctx); if (!s.sheet || s.active !== 'qa-url') f.push('sheet ' + s.sheet + ', focus ' + s.active);
    const r = await ctx.ev(`(() => { const b = document.getElementById('qa-paste').getBoundingClientRect(), small = [...document.querySelectorAll('#addSheet button, #addSheet input[type=text], #addSheet select, #addSheet textarea, #addSheet .radio')].filter(e => e.offsetParent !== null).map(e => [e.id || e.className, Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44);
      return { over: document.documentElement.scrollWidth - innerWidth, sheetOver: document.getElementById('addSheet').scrollWidth - document.getElementById('addSheet').clientWidth, pasteIn: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, pasteH: b.height, small }; })()`);
    if (r.over > 1 || r.sheetOver > 1) f.push('horizontal overflow ' + r.over + '/' + r.sheetOver + ' px'); if (!r.pasteIn) f.push('the Paste button is not fully in view at load'); if (r.small.length) f.push('targets under 44 px: ' + JSON.stringify(r.small)); return f; } },
  { id: 'TC-QA-H02 #adds and #add/anything do not open the sheet; #add while the page is open does', width: 1280, hash: '#adds', fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; if ((await qs(ctx)).sheet) f.push('#adds opened the sheet'); await ctx.ev("location.hash = '#add/anything'"); await sleep(250); if ((await qs(ctx)).sheet) f.push('#add/anything opened the sheet');
    await ctx.ev("location.hash = '#add'"); await sleep(300); const s = await qs(ctx); if (!s.sheet || s.active !== 'qa-url') f.push('#add did not open the sheet with the focus on the link'); return f; } },
  { id: 'TC-QA-H02 #add while already unlocked opens the sheet with no prompt; the owner bar button opens it too; closing it clears #add from the address', width: 1280, hash: '#add', token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; let s = await qs(ctx); if (!s.sheet || s.tok || !s.admin) f.push('state: ' + JSON.stringify({ sheet: s.sheet, tok: s.tok, admin: s.admin }));
    await qaClick(ctx, 'qa-cancel'); if ((await ctx.ev('location.hash')) !== '') f.push('#add is still in the address after closing'); await ctx.ev("document.getElementById('addOpen').click()"); s = await qs(ctx); if (!s.sheet || s.tok) f.push('the owner bar button did not open the sheet'); return f; } },
  { id: 'TC-QA-S01 XSS payloads in the pasted share text, take and tags stay inert in the sheet, the preview and the published card', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await ctx.ev("document.getElementById('addOpen').click()"); await qaClip(ctx, QA_P + '\nhttps://example.com/s01?x=%3Cimg%20src%3Dx%3E'); await qaClick(ctx, 'qa-paste', 150); await qaFill(ctx, { comment: QA_P, tags: '"><svg onload=window.__x=1>' }); await sleep(150);
    let bad = await ctx.ev("[window.__x, document.querySelectorAll('#addSheet img, #addSheet svg, #addSheet script').length, document.getElementById('qa-dest').innerHTML]"); if (bad[0] || bad[1]) f.push('active in the sheet: ' + JSON.stringify(bad)); if (/</.test(bad[2])) f.push('markup in the destination preview: ' + bad[2]);
    await qaClick(ctx, 'qa-draft', 300); bad = await ctx.ev("[window.__x, document.querySelectorAll('#reads img[src=x], #reads svg[onload], #reads script').length]"); if (bad[0] || bad[1]) f.push('active in the list: ' + JSON.stringify(bad));
    const t = await ctx.ev("document.getElementById('articlesFeed').textContent"); if (!t.includes('<img')) f.push('the payload should show as plain text'); return f; } },
  { id: 'TC-QA-S02 a visitor who presses Post gets the token prompt and no API call is made until a token is given', width: 1280, fixtures: TWO, ...qaWith(), check: async ctx => {
    const f = []; await stubGh(ctx); await qaOpenGear(ctx); await qaFill(ctx, { url: 'https://example.com/s02', title: 'S02' });
    for (const id of ['qa-draft', 'qa-publish']) { await qaClick(ctx, id, 150); const s = await qs(ctx); if (!s.tok) f.push(id + ': no token prompt'); await qaClick(ctx, 'tok-cancel', 100); }
    const n = await apiCalls(ctx); if (n) f.push(n + ' API call(s) before a token'); return f; } },
  /* ---------- SPEC-UX Phase A (TC-UX-*): the simple layout ---------- */
  { id: 'TC-UX-S01 DOM order at 1280 px: hero, Products, Updates, Reads, Podcasts', width: 1280, fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => {
    const f = [], a = await uxOrder(ctx); if (a !== UX_ORDER) f.push('order: ' + a);
    return f; } },
  { id: 'TC-UX-S02 the order is the same with storage blocked, and with the admin token present', width: 1280, fixtures: TWO, ...uxWith(UX_BLOCK), noErrors: true, check: async ctx => { const a = await uxOrder(ctx); return a === UX_ORDER ? [] : ['order (storage blocked): ' + a]; } },
  { id: 'TC-UX-S02 unlocked: the same order, and the nav is unchanged', width: 1280, token: true, fixtures: TWO, ...uxWith(), check: async ctx => { const a = await uxOrder(ctx), n = await uxNavs(ctx); return [...(a === UX_ORDER ? [] : ['order (unlocked): ' + a]), ...(n.head === UX_NAV && n.bottom === UX_NAV ? [] : ['nav (unlocked): ' + JSON.stringify(n)])]; } },
  { id: 'TC-UX-P01 every section has a heading and a one-line description in the same pattern', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    const r = await ctx.ev(`['products','updates','reads','podcasts'].map(id => { const s = document.getElementById(id), h = s && s.querySelector('.sec-head h2'), d = s && s.querySelector('.sec-head .sec-desc'); return { id, h: h && h.textContent.trim(), d: d && d.textContent.trim().length, by: s && s.getAttribute('aria-labelledby') === (h && h.id), lines: d && Math.round(d.getBoundingClientRect().height / parseFloat(getComputedStyle(d).lineHeight)) }; })`);
    const f = []; for (const x of r) { if (!x.h || !x.d || !x.by) f.push(x.id + ': ' + JSON.stringify(x)); else if (x.lines > 2) f.push(x.id + ' description is ' + x.lines + ' lines'); } return f; } },
  { id: 'TC-UX-P01 every section shows a friendly empty state, never blank', width: 1280, fixtures: ['ux-all-empty'], noErrors: true, check: async ctx => {
    const r = await ctx.ev(`({ g: document.getElementById('grid').textContent.trim(), u: document.getElementById('updatesFeed').textContent.trim(), r: document.getElementById('articlesFeed').textContent.trim(), p: document.getElementById('podcastFeed').textContent.trim() })`);
    const f = []; for (const [k, v] of Object.entries(r)) if (!v || v.length < 12) f.push(k + ' is blank'); return f; } },
  { id: 'TC-UX-P02 locked: no add action is visible; unlocked: one per section that has one (Reads, Podcasts), none in Products and Updates', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    const vis = `[...document.querySelectorAll('.composer-open, .addbtn')].filter(e => e.offsetParent !== null && !e.closest('.who-text')).map(e => e.closest('section.block').id)`;
    const f = [], locked = await ctx.ev(vis); if (locked.length) f.push('visible while locked: ' + locked);
    await ctx.ev("document.body.classList.add('admin')"); const open = await ctx.ev(vis);
    if (open.includes('products') || open.includes('updates')) f.push('add action in Products or Updates: ' + open); if (open.filter(x => x === 'podcasts').length !== 1) f.push('Podcasts add actions: ' + open.filter(x => x === 'podcasts').length); if (!open.includes('reads')) f.push('Reads has no add action');
    return f; } },
  { id: 'TC-UX-N01 header nav (1280 px) and bottom nav (375 px) list the same four links, in page order', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => { const n = await uxNavs(ctx); return n.head === UX_NAV && n.bottom === UX_NAV ? [] : ['navs: ' + JSON.stringify(n)]; } },
  { id: 'TC-UX-N01 at 375 px the four bottom-nav items fit, with labels, at least 44 px high; no overflow (TC-UX-P03, A05)', width: 375, fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => {
    const r = await ctx.ev(`(() => { const nav = document.getElementById('navbottom'), as = [...nav.querySelectorAll('a')].map(a => { const b = a.getBoundingClientRect(); return { t: a.textContent.trim(), w: Math.round(b.width), h: Math.round(b.height), l: Math.round(b.left), r: Math.round(b.right) }; }); return { shown: getComputedStyle(nav).display, as, over: document.documentElement.scrollWidth - innerWidth, text: [...nav.querySelectorAll('a')].map(a => [...a.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()).join('|') }; })()`);
    const f = []; if (r.shown === 'none') f.push('bottom nav hidden'); if (r.as.length !== 4) f.push(r.as.length + ' items');
    for (const a of r.as) { if (a.h < 44) f.push(a.t + ' is ' + a.h + ' px high'); if (a.w < 44 || a.l < 0 || a.r > 375) f.push(a.t + ' does not fit: ' + JSON.stringify(a)); }
    if (r.over > 1) f.push('horizontal overflow ' + r.over + ' px'); if (r.text !== 'Products|Updates|Reads|Podcasts') f.push('labels: ' + r.text); return f; } },
  { id: 'TC-UX-N03 aria-current follows the section in view, in both navs', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    const f = [];
    for (const id of ['updates', 'podcasts', 'products', 'reads']) {
      await ctx.ev(`document.getElementById(${JSON.stringify(id)}).scrollIntoView({ behavior: 'instant', block: 'start' })`); await sleep(250);
      const cur = await ctx.ev(`['navlinks', 'navbottom'].map(n => [...document.querySelectorAll('#' + n + ' a[aria-current]')].map(a => a.getAttribute('href')).join())`);
      if (cur[0] !== '#' + id || cur[1] !== '#' + id) f.push(id + ': aria-current is ' + JSON.stringify(cur));
    } return f; } },
  { id: 'TC-UX-N04 skip link is the first stop and goes to main; the header links are in page order in the tab order', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    const r = await ctx.ev(`(() => { const ts = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(e => e.offsetParent !== null && e.tabIndex >= 0); const nav = [...document.querySelectorAll('#navlinks a')].map(a => ts.indexOf(a));
      return { first: ts[0] && ts[0].getAttribute('href'), nav, main: !!document.getElementById('main') }; })()`);
    const f = []; if (r.first !== '#main' || !r.main) f.push('first stop: ' + r.first); if (r.nav.some((x, i) => x < 0 || (i && x <= r.nav[i - 1]))) f.push('nav tab order: ' + r.nav); return f; } },
  { id: 'TC-UX-N05 What\'s new, theme toggle and logo are still there and work', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    const f = [], r = await ctx.ev(`(() => { const t = document.documentElement.dataset.theme; document.getElementById('theme').click(); const t2 = document.documentElement.dataset.theme; return { t, t2, wn: !document.getElementById('whatsNewBtn').hidden, logo: !!document.querySelector('.brand .logo') }; })()`);
    if (r.t === r.t2) f.push('the theme did not change'); if (!r.wn) f.push("What's new is hidden"); if (!r.logo) f.push('logo missing'); return f; } },
  { id: 'TC-UX-L01 #products, #updates, #reads and #podcasts each reach their section (and the section is the one in the nav)', width: 1280, hash: '#updates', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => uxLands(ctx, 'updates') },
  { id: 'TC-UX-L01 #podcasts on a cold load', width: 1280, hash: '#podcasts', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => uxLands(ctx, 'podcasts') },
  { id: 'TC-UX-L01 #products on a cold load', width: 1280, hash: '#products', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => uxLands(ctx, 'products') },
  { id: 'TC-UX-L01 #reads on a cold load', width: 1280, hash: '#reads', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => uxLands(ctx, 'reads') },
  { id: 'TC-UX-L01 the same four links followed while the page is open, and on a phone', width: 375, fixtures: TWO, ...uxWith(), check: async ctx => {
    const f = []; for (const id of ['podcasts', 'updates', 'reads', 'products']) { f.push(...await uxFollow(ctx, id)); } return f; } },
  { id: 'TC-UX-L02 #reads/technical and #reads/others open that sub-item and show Reads', width: 1280, hash: '#reads/others', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => {
    const f = [...await uxLands(ctx, 'reads'), ...await expectSection(ctx, 'Others')]; await ctx.ev("location.hash = '#reads/technical'"); await sleep(300); f.push(...await expectSection(ctx, 'Technical')); return f; } },
  { id: 'TC-UX-L03 #blog and #blog/x land on Podcasts, in view', width: 1280, hash: '#blog', fixtures: PODS, ...uxWith(), noErrors: true, check: async ctx => {
    await sleep(500); const f = await uxLands(ctx, 'podcasts'); const h = await ctx.ev('location.hash'); if (h !== '#podcasts') f.push('hash is ' + h); return f; } },
  { id: 'TC-UX-L04 an unknown or hostile fragment does nothing harmful: no error, nothing inserted, nothing runs, the default Reads section', width: 1280, hash: '#reads/%3Cscript%3Ewindow.__x=1%3C/script%3E', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => {
    const f = [], before = await ctx.ev(count('script'));
    for (const h of ['#xyz', '#__proto__', '#constructor', '#reads/<img src=x onerror=window.__x=1>', '#products/../x', '#%E0%A4%A', '#' + 'a'.repeat(5000), '#blog<script>window.__x=1</script>']) {
      await ctx.ev(`location.hash = ${JSON.stringify(h)}`); await sleep(120);
    }
    const r = await ctx.ev(`({ x: window.__x, scripts: document.querySelectorAll('script').length, imgs: document.querySelectorAll('img[src=x]').length, inj: document.body.innerHTML.includes('onerror=window') })`);
    if (r.x) f.push('a fragment ran code'); if (r.scripts !== before) f.push('a script element appeared'); if (r.imgs || r.inj) f.push('a fragment was inserted into the page');
    return [...f, ...await expectSection(ctx, 'Technical')]; } },
  { id: 'TC-UX-L04 an unknown fragment on a cold load leaves the page at the top, the page fully rendered', width: 1280, hash: '#xyz', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => { const y = await ctx.ev('Math.round(scrollY)'); return [...(y > 5 ? ['page scrolled to ' + y] : []), ...await sectionsRendered(ctx)]; } },
  { id: 'TC-UX-L04 cold load of #__proto__: no error, no scroll, everything rendered', width: 1280, hash: '#__proto__', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => { const y = await ctx.ev('Math.round(scrollY)'); return [...(y > 5 ? ['scrolled to ' + y] : []), ...await sectionsRendered(ctx)]; } },
  { id: 'TC-UX-L04 cold load of #Products (wrong case) is left alone', width: 1280, hash: '#Products', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => { const y = await ctx.ev('Math.round(scrollY)'); return [...(y > 5 ? ['scrolled to ' + y] : []), ...await sectionsRendered(ctx)]; } },
  { id: 'TC-UX-L04 cold load of #constructor', width: 1280, hash: '#constructor', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => { const y = await ctx.ev('Math.round(scrollY)'); return [...(y > 5 ? ['scrolled to ' + y] : []), ...await sectionsRendered(ctx)]; } },
  { id: 'TC-UX-L04 cold load of a broken percent sequence', width: 1280, hash: '#%E0%A4%A', fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => { const y = await ctx.ev('Math.round(scrollY)'); return [...(y > 5 ? ['scrolled to ' + y] : []), ...await sectionsRendered(ctx)]; } },
  { id: 'TC-UX-P04 when Reads fails to render, the Books block is hidden (no empty Books heading under the fallback line)', width: 1280, fixtures: ['poison-reads-book-null', 'healthy'], ...uxWith(), check: async ctx => { const v = await ctx.ev("(() => { const b = document.getElementById('booksBlock'); return getComputedStyle(b).display; })()"); return v === 'none' ? [] : ['the Books block is shown (' + v + ')']; } },
  { id: 'TC-UX-L05 with storage blocked: #updates and #reads/others land, #blog reaches Podcasts', width: 1280, hash: '#reads/others', fixtures: TWO, ...uxWith(UX_BLOCK), noErrors: true, check: async ctx => {
    const f = [...await uxLands(ctx, 'reads'), ...await expectSection(ctx, 'Others')]; for (const id of ['updates', 'podcasts']) f.push(...await uxFollow(ctx, id));
    await ctx.ev("location.hash = '#blog'"); await sleep(400); const h = await ctx.ev('location.hash'); if (h !== '#podcasts') f.push('#blog went to ' + h); return f; } },
  { id: 'TC-UX-P04 Reads is one column: Books sit under the reads, same left edge, no side-by-side layout', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    const r = await ctx.ev(`(() => { const a = document.getElementById('articlesFeed').getBoundingClientRect(), b = document.getElementById('booksFeed').getBoundingClientRect(); return { al: Math.round(a.left), bl: Math.round(b.left), at: Math.round(a.top), bt: Math.round(b.top), aw: Math.round(a.width) }; })()`);
    const f = []; if (r.al !== r.bl) f.push('Books start at x ' + r.bl + ' but the reads at ' + r.al); if (r.bt <= r.at) f.push('Books are not below the reads'); if (r.aw < 600) f.push('the reads column is only ' + r.aw + ' px wide at 1280 px'); return f; } },
  { id: 'TC-UX-A05 no horizontal scroll at 375 px and 1280 px, in both themes', width: 375, fixtures: TWO, ...uxWith(), check: async ctx => {
    const f = []; for (const t of ['dark', 'light']) { await ctx.ev(`document.documentElement.dataset.theme = ${JSON.stringify(t)}`); const o = await ctx.ev('document.documentElement.scrollWidth - innerWidth'); if (o > 1) f.push(t + ' overflow ' + o + ' px at 375'); } return f; } },
  { id: 'TC-UX-A05 no horizontal scroll at 1280 px', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => { const o = await ctx.ev('document.documentElement.scrollWidth - innerWidth'); return o > 1 ? ['overflow ' + o + ' px'] : []; } },
  { id: 'TC-UX-privacy the layout work adds no storage key, cookie or request: a visitor has only the theme key, no cookie, and no host other than this one', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    await ctx.ev("document.getElementById('theme').click()");
    const r = await ctx.ev(`({ local: Object.keys(localStorage).sort().join(), session: Object.keys(sessionStorage).join(), cookie: document.cookie, hosts: [...new Set(performance.getEntriesByType('resource').map(e => new URL(e.name).host))].join() })`);
    const f = []; if (r.local !== 'studio-theme') f.push('local keys: ' + r.local); if (r.session) f.push('session keys: ' + r.session); if (r.cookie) f.push('cookie: ' + r.cookie); if (!/^127\.0\.0\.1:\d+$/.test(r.hosts)) f.push('hosts: ' + r.hosts); return f; } },
  { id: 'TC-UX-F02 the footer shows the release date next to the version and labels the product-data date for what it is', width: 1280, fixtures: ['healthy'], ...uxWith(), noErrors: true, check: async ctx => {
    const t = await ctx.ev("document.querySelector('footer').innerText.replace(/\\s+/g, ' ')"), f = [];
    if (!/Studio v1\.5 · 21 Oct 2026/.test(t)) f.push('version and release date: ' + t); if (!/Product data updated · 19 Oct 2026/.test(t)) f.push('product data date: ' + t); if (/Synced from GitHub/.test(t)) f.push('old label still shown'); return f; } },
  { id: 'TC-UX-A02 text contrast is at least 4.5:1 in the dark theme', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => uxContrast(ctx, 'dark') },
  { id: 'TC-UX-A02 text contrast is at least 4.5:1 in the light theme', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => uxContrast(ctx, 'light') },
  { id: 'TC-UX-A02 phone: the bottom nav (including the item in view) and tags meet 4.5:1 in both themes', width: 375, fixtures: TWO, ...uxWith(), check: async ctx => { await ctx.ev("document.querySelector('#navbottom a').setAttribute('aria-current', 'location')"); return [...await uxContrast(ctx, 'dark', ['nav.bottom a', 'nav.bottom a[aria-current]', '.tag', '.item .tag.ver', '.card.featured .tag.ver']), ...await uxContrast(ctx, 'light', ['nav.bottom a', 'nav.bottom a[aria-current]', '.tag', '.item .tag.ver', '.card.featured .tag.ver'])]; } },
  { id: 'TC-UX-A01 real Tab presses: every stop shows a visible focus ring, the order follows the page top to bottom, and focus never gets lost', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    const probe = `(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e), b = e.getBoundingClientRect(), fixed = (() => { for (let n = e; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true; return false; })();
      return { n: e.id || (typeof e.className === 'string' && e.className) || e.tagName, ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== 'none'), rc: cs.outlineStyle !== 'none' ? cs.outlineColor : null, bg: (() => { for (let n = e.parentElement; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor.match(/[\\d.]+/g) || []; if (c.length === 3 || (c.length > 3 && c[3] > 0.9)) return c.slice(0, 3).map(Number); } return [13, 13, 15]; })(), vis: b.width > 0 && b.height > 0, top: Math.round(b.top + scrollY), left: Math.round(b.left), fixed, pos: e.tabIndex > 0 }; })()`;
    const seen = [], f = []; await ctx.ev('window.scrollTo(0, 0); document.body.focus()');
    for (let i = 0; i < 120; i++) { await ctx.tab(); const p = await ctx.ev(probe); if (!p) break; if (seen.length && seen[0].n === p.n && seen[0].top === p.top && i > 3) break; seen.push(p); }
    const faint = seen.filter(x => x.rc && ratio((x.rc.match(/[\d.]+/g) || []).slice(0, 3).map(Number), x.bg) < 3).map(x => x.n), noRing = seen.filter(x => !x.ring).map(x => x.n), hidden = seen.filter(x => !x.vis).map(x => x.n), jumps = [];
    seen.filter(x => !x.fixed).forEach((x, i, a) => { const p = a[i - 1]; if (p && x.top < p.top - 6 && x.left <= p.left) jumps.push(p.n + ' then ' + x.n); });
    if (seen.length < 20) f.push('only ' + seen.length + ' tab stops'); if (seen[0] && seen[0].n !== 'skip') f.push('first stop is ' + seen[0].n); if (faint.length) f.push('focus ring under 3:1 against its background: ' + [...new Set(faint)].slice(0, 4).join(', ')); if (noRing.length) f.push('no ring: ' + [...new Set(noRing)].slice(0, 6).join(', ')); if (hidden.length) f.push('focus on an invisible element: ' + hidden.slice(0, 3)); if (jumps.length) f.push('order jumps: ' + jumps.slice(0, 3).join('; ')); if (seen.some(x => x.pos)) f.push('tabindex above 0'); return f; } },
  { id: 'TC-UX-A01 phone: while tabbing, the focused control is never hidden behind the fixed bottom nav', width: 375, touch: true, fixtures: TWO, ...uxWith(), check: async ctx => {
    await ctx.ev("document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); document.body.focus()"); const f = [];
    for (let i = 0; i < 40; i++) { await ctx.tab(); const r = await ctx.ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; for (let n = e; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return { fixed: true }; const b = e.getBoundingClientRect(), nav = document.getElementById('navbottom').getBoundingClientRect(); return { n: e.id || (typeof e.className === 'string' && e.className) || e.tagName, hidden: b.bottom - nav.top, vh: innerHeight, off: b.top < 0 || b.bottom > innerHeight }; })()`); if (!r) break; if (r.fixed) continue; if (r.hidden > 1 || r.off) { f.push(r.n + ' is covered by ' + Math.round(r.hidden) + ' px'); if (f.length > 2) break; } }
    return f; } },
  { id: 'TC-UX-P03 phone with a touch screen (pointer: coarse, as on an iPhone): every control outside running text is at least 44 px high at 375 px', width: 375, touch: true, fixtures: TWO, ...uxWith(), check: async ctx => {
    const r = await ctx.ev(`[...document.querySelectorAll('a[href], button, summary, input:not([type=hidden]), select, textarea')].filter(e => e.offsetParent !== null && !e.closest('.body, .read-comment, #addBg, #tokBg, .modal-bg, [hidden], .tools') && getComputedStyle(e).position !== 'fixed').map(e => ({ n: (e.id || (e.className && e.className.baseVal === undefined ? e.className : '') || e.tagName).toString().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) })).filter(x => x.h < 44 && x.h > 0)`);
    const names = [...new Set(r.map(x => x.n + ':' + x.h))]; return names.length ? ['under 44 px: ' + names.slice(0, 12).join(', ') + (names.length > 12 ? ' (+' + (names.length - 12) + ')' : '')] : []; } },
  { id: 'TC-UX-A03 reflow at 320 px (a 1280 px page at 400% zoom) and 640 px (200% zoom): no horizontal scroll, nothing cut off, four nav items', width: 320, fixtures: TWO, ...uxWith(), check: async ctx => {
    const r = await ctx.ev(`({ over: document.documentElement.scrollWidth - innerWidth, nav: [...document.querySelectorAll('#navbottom a')].map(a => { const b = a.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.height >= 44; }), cut: [...document.querySelectorAll('main *')].filter(e => e.offsetParent !== null && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.tabs, pre, .chips')).slice(0, 4).map(e => e.className || e.tagName) })`);
    const f = []; if (r.over > 1) f.push('overflow ' + r.over + ' px at 320'); if (r.nav.length !== 4 || r.nav.includes(false)) f.push('bottom nav does not fit at 320: ' + r.nav); if (r.cut.length) f.push('cut off: ' + r.cut.join(', ')); return f; } },
  { id: 'TC-UX-A03 640 px wide (200% zoom of 1280 px): no overflow and nothing clipped by the hero or a section', width: 640, fixtures: TWO, ...uxWith(), check: async ctx => {
    const r = await ctx.ev(`({ over: document.documentElement.scrollWidth - innerWidth, cut: [...document.querySelectorAll('main *')].filter(e => e.offsetParent !== null && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.tabs, pre, .chips')).slice(0, 4).map(e => e.className || e.tagName) })`);
    return [...(r.over > 1 ? ['overflow ' + r.over + ' px at 640'] : []), ...(r.cut.length ? ['cut off at 640: ' + r.cut.join(', ')] : [])]; } },
  { id: 'TC-UX-P03 phone: at the end of the page the footer text is clear of the gear and the bottom nav', width: 375, touch: true, fixtures: TWO, ...uxWith(), check: async ctx => {
    await ctx.ev("document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.documentElement.scrollHeight)"); await sleep(60);
    const r = await ctx.ev(`(() => { let box = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; }, g = box(document.getElementById('gear')), n = box(document.getElementById('navbottom')), hit = [], low = 0; for (const e of document.querySelectorAll('footer span, footer button')) { const b = box(e); if (b.r > g.l && b.l < g.r && b.b > g.t && b.t < g.b) hit.push('gear over ' + (e.id || e.className || e.tagName)); if (b.b > n.t) hit.push('nav over ' + (e.id || e.className || e.tagName)); low = Math.max(low, b.b); } if (n.t - low > 28) hit.push('blank space of ' + Math.round(n.t - low) + ' px between the last footer text and the bottom nav at the end of the page'); return hit; })()`);
    return r; } },
  { id: 'TC-UX-F01 first screen at 375 x 812: what Studio is, and the first product, without scrolling', width: 375, fixtures: TWO, ...uxWith(), check: async ctx => {
    const r = await ctx.ev(`(() => { const t = s => { const e = document.querySelector(s), b = e && e.getBoundingClientRect(); return b && { top: Math.round(b.top), bottom: Math.round(b.bottom) }; }; return { vh: innerHeight, h1: t('.hero h1'), p: t('#products h2'), card: t('#grid .card'), photo: Math.round(document.querySelector('.photo').getBoundingClientRect().height), navTop: Math.round(document.getElementById('navbottom').getBoundingClientRect().top) }; })()`);
    const f = []; if (!r.h1 || r.h1.bottom > r.vh) f.push('the headline is not in the first screen'); if (!r.p || r.p.bottom > r.vh - 160) f.push('Products heading ends at ' + (r.p && r.p.bottom) + ' px of ' + r.vh + ' (the first product needs room to show)'); if (!r.card || r.card.top > r.vh - 120) f.push('first product starts at ' + (r.card && r.card.top)); if (r.photo > 60) f.push('photo is ' + r.photo + ' px on a phone (it should be compact)'); if (r.navTop && r.card && r.card.top > r.navTop - 80) f.push('the first product shows only ' + (r.navTop - r.card.top) + ' px above the bottom nav'); return f; } },
  { id: 'TC-UX-F01 first screen on a small phone, 375 x 667: the Products heading is above the bottom nav', width: 375, height: 667, fixtures: TWO, ...uxWith(), check: async ctx => { const r = await ctx.ev("[Math.round(document.querySelector('#products h2').getBoundingClientRect().bottom), Math.round(document.getElementById('navbottom').getBoundingClientRect().top)]"); return r[0] > r[1] - 8 ? ['Products heading ends at ' + r[0] + ' px but the bottom nav starts at ' + r[1]] : []; } },
  { id: 'TC-UX-F01 first screen at 1280 x 800: the first product card starts in view', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => { const t = await ctx.ev("Math.round(document.querySelector('#grid .card').getBoundingClientRect().top)"); return t > 800 - 100 ? ['first product starts at ' + t + ' px of 800'] : []; } },
  { id: 'TC-UX-A03 extreme zoom, 256 px wide (Chrome at 500%): no sideways scroll, and no text, tab, chip or card is cut off or sticks out', width: 256, fixtures: TWO, ...uxWith(), check: async ctx => uxExtreme(ctx) },
  { id: 'TC-UX-A03 extreme zoom, 200 px wide', width: 200, fixtures: TWO, ...uxWith(), check: async ctx => uxExtreme(ctx) },
  /* ---------- SPEC-SH SH-05: fallbacks proven (TC-SH-B05 to B09) ---------- */
  { id: 'TC-SH-B05 to B07 fallbacks on one page: a product with no cache entry (own text, Source link, no stars or language, no download), a release with no matching asset (Release notes link, not Download), no tagline (repository description)', width: 1280, fixtures: ['sh-fallbacks', 'healthy'], ...uxWith(), noErrors: true, check: async ctx => {
    const r = await ctx.ev(`(() => { const card = re => [...document.querySelectorAll('#grid .card')].find(x => re.test(x.querySelector('h3').textContent)), n = card(/New Thing/), p = card(/Penny/), d = card(/Debasis Web/);
      return { n: n && { text: n.querySelector('p').textContent, meta: n.querySelector('.meta').textContent.trim(), source: !!n.querySelector('a[href="https://github.com/debasisr66/new-thing"]'), dl: [...n.querySelectorAll('.actions a')].map(a => a.textContent.trim()) }, p: p && [...p.querySelectorAll('.actions a')].map(a => ({ l: a.getAttribute('aria-label') || '', h: a.getAttribute('href') })), d: d && d.querySelector('p').textContent }; })()`);
    const f = []; if (!r.n) f.push('B05: no card for the product without a cache entry'); else { if (r.n.text !== 'Just added, not synced yet') f.push('B05 text: ' + r.n.text); if (r.n.meta) f.push('B05 stars or language shown without data: ' + r.n.meta); if (!r.n.source) f.push('B05 no Source link'); if (r.n.dl.some(x => /Download|Release notes/.test(x))) f.push('B05 a download offered without a release'); }
    if (!r.p) f.push('B06: no Penny card'); else { const rel = r.p.find(x => /Release notes/.test(x.l)); if (!rel || !/\/releases\/tag\/v3\.2$/.test(rel.h)) f.push('B06 no link to the release page: ' + JSON.stringify(r.p)); if (r.p.some(x => /^Download Penny/.test(x.l))) f.push('B06 a Download was offered with no matching asset'); }
    if (r.d !== 'Description from the repository') f.push('B07 tagline text: ' + r.d); return f; } },
  { id: 'TC-SH-B08 empty Products, Updates, Reads and Podcasts each show their own friendly line', width: 1280, fixtures: ['ux-all-empty'], noErrors: true, check: async ctx => {
    const r = await ctx.ev(`({ g: document.getElementById('grid').textContent.trim(), u: document.getElementById('updatesFeed').textContent.trim(), r: document.getElementById('articlesFeed').textContent.trim(), p: document.getElementById('podcastFeed').textContent.trim() })`);
    const f = []; if (!/No products to show yet/.test(r.g)) f.push('Products: ' + r.g); if (!/No releases published yet/.test(r.u)) f.push('Updates: ' + r.u); if (!/Nothing here yet/.test(r.r)) f.push('Reads: ' + r.r); if (!/No podcasts yet/.test(r.p)) f.push('Podcasts: ' + r.p); return f; } },
  { id: 'TC-SH-B09 a very long title, comment and tag wrap: no sideways scroll at 375 px', width: 375, fixtures: ['sh-long-text', 'healthy'], ...uxWith(), noErrors: true, check: async ctx => {
    const o = await ctx.ev('document.documentElement.scrollWidth - innerWidth'); const there = await ctx.ev("document.getElementById('articlesFeed').textContent.includes('Very long title')"); return [...(o > 1 ? ['overflow ' + o + ' px'] : []), ...(there ? [] : ['the long read was not rendered'])]; } },
  /* ---------- SPEC-PC Phase C: PC-06 and PC-07 ---------- */
  { id: 'TC-PC-K01 the Reads composer and the Quick add type list no longer offer Podcast; a hint points to the Podcasts section', width: 1280, token: true, fixtures: TWO, ...qaWith(), check: async ctx => {
    const r = await ctx.ev(`({ cf: [...document.querySelectorAll('#cf-kind option')].map(o => o.value), qa: [...document.querySelectorAll('#qa-type option')].map(o => o.value), hint: !!document.querySelector('#composerForm a[href="#podcasts"]') })`);
    const f = []; if (r.cf.includes('podcast')) f.push('Reads composer still offers Podcast'); if (r.qa.includes('podcast')) f.push('Quick add type list still offers Podcast'); if (!r.hint) f.push('no hint to Podcasts in the Reads composer'); if (r.cf.length < 4) f.push('the other types went missing: ' + r.cf); return f; } },
  { id: 'TC-PC-K02 an existing read with kind podcast still renders, and its edit form keeps that type', width: 1280, token: true, fixtures: ['reads-kind-podcast', 'healthy'], ...uxWith(), noErrors: true, check: async ctx => {
    const f = [], t = await ctx.ev("document.getElementById('articlesFeed').textContent"); if (!t.includes('An older read filed as a podcast')) f.push('the read did not render');
    const k = await ctx.ev(`(() => { const b = [...document.querySelectorAll('#articlesFeed [data-edit]')].find(x => /older read/.test(x.closest('.item').textContent)); if (!b) return 'no edit button'; b.click(); return document.getElementById('cf-kind').value; })()`); if (k !== 'podcast') f.push('edit form type: ' + k);
    await ctx.ev("document.getElementById('cf-cancel').click(); document.getElementById('composerOpen').click()"); const o = await ctx.ev("[...document.querySelectorAll('#cf-kind option')].map(x => x.value)"); if (o.includes('podcast')) f.push('the extra Podcast option stayed for a new read'); return f; } },
  { id: 'TC-PC-N02 the podcast composer refuses a link that is already in Podcasts (also with tracking parameters)', width: 1280, token: true, fixtures: PODS, check: async ctx => {
    const f = [], before = await ctx.ev("document.querySelectorAll('#podcastFeed .item').length"); await fillPodcast(ctx, { url: 'https://open.spotify.com/show/abc123?utm_source=x', title: 'Duplicate' }); await submitPodcast(ctx);
    const e = await ctx.ev("document.getElementById('pf-url-err').textContent"), n = await ctx.ev("document.querySelectorAll('#podcastFeed .item').length");
    if (!/already in your podcasts/.test(e)) f.push('no duplicate message: "' + e + '"'); if (n !== before) f.push('the duplicate was added (' + before + ' to ' + n + ' items)'); return f; } },
  { id: 'TC-PC-N02 Quick add refuses a podcast link that is already in Podcasts, without any API call', width: 1280, token: true, fixtures: PODS, ...qaWith(), check: async ctx => {
    await stubGh(ctx); await ctx.ev("document.getElementById('addOpen').click()"); await qaFill(ctx, { kind: 'podcast', url: 'https://open.spotify.com/show/abc123', title: 'Duplicate' }); await qaClick(ctx, 'qa-draft', 100);
    const s = await qs(ctx), f = []; if (!/already in your podcasts/.test(s.errs.url)) f.push('no duplicate message: "' + s.errs.url + '"'); const n = await ctx.ev('window.__puts.length'); if (n) f.push(n + ' write(s) made'); return f; } },
  /* ---------- SPEC-RC Phase C: RC-07, RC-08 ---------- */
  { id: 'TC-RC-B01 Books appear under the reads of their own sub-item, in the same column, and only there; no two-column layout at 375 px', width: 375, fixtures: TWO, ...uxWith(), noErrors: true, check: async ctx => {
    const f = [], v = () => ctx.ev(`(() => { const a = document.getElementById('articlesFeed').getBoundingClientRect(), b = document.getElementById('booksFeed').getBoundingClientRect(); return { books: [...document.querySelectorAll('#booksFeed .item h3')].map(e => e.textContent.trim()), below: b.top > a.top, same: Math.round(a.left) === Math.round(b.left), over: document.documentElement.scrollWidth - innerWidth }; })()`);
    let r = await v(); if (r.books.join() !== 'Tech book') f.push('Technical books: ' + r.books); if (!r.below || !r.same) f.push('Books are not under the reads in one column'); if (r.over > 1) f.push('overflow ' + r.over);
    await ctx.ev("document.querySelectorAll('#readTabs [role=tab]')[1].click()"); r = await v(); if (r.books.join() !== 'Other book') f.push('Others books: ' + r.books); return f; } },
  { id: 'TC-RC-S02 filtering by a tag or a search does not change the counts on the sub-item buttons', width: 1280, fixtures: TWO, ...uxWith(), check: async ctx => {
    const counts = () => ctx.ev("[...document.querySelectorAll('#readTabs [role=tab]')].map(t => t.textContent.replace(/\\s+/g, ' ').trim()).join('|')"), f = [], before = await counts();
    await ctx.ev("document.querySelector('#tagChips [data-filter=claude]').click()"); const shown = await ctx.ev("document.querySelectorAll('#articlesFeed .item').length"); const after = await counts();
    if (before !== after) f.push('counts changed: ' + before + ' -> ' + after); if (shown >= 4) f.push('the filter did not narrow the list (' + shown + ')'); return f; } },
  { id: 'TC-RC-S01 each read keeps its LinkedIn share link (new tab, no opener), Copy link copies the address, and Share… exists only where the browser offers it', width: 1280, fixtures: TWO, ...uxWith("window.__copied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); }, readText: () => Promise.resolve('') } }); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });"), check: async ctx => {
    const r = await ctx.ev(`(() => { const row = document.querySelector('#articlesFeed .share-row'), a = row.querySelector('a'); const url = document.querySelector('#articlesFeed .read-title').getAttribute('href'); row.querySelector('[data-copy]').click(); return { href: a.getAttribute('href'), target: a.target, rel: a.rel, url, share: !!row.querySelector('[data-share]') }; })()`);
    await sleep(50); const copied = await ctx.ev('window.__copied'); const f = [];
    if (!r.href.startsWith('https://www.linkedin.com/sharing/share-offsite/?url=') || r.target !== '_blank' || !/noopener/.test(r.rel)) f.push('LinkedIn link: ' + JSON.stringify(r)); if (copied.length !== 1 || copied[0] !== r.url) f.push('copied: ' + JSON.stringify(copied) + ' want ' + r.url); if (r.share) f.push('Share… offered without navigator.share'); return f; } },
];

async function main() {
  installCleanup();
  // a filter must never turn the run into a silent no-op (review SH-02): refused in CI, and an empty selection is an error
  const only = process.env.SMOKE_ONLY;
  if (only && process.env.CI) { console.error('smoke: SMOKE_ONLY must not be set in CI (it would skip cases)'); process.exit(1); }
  if (!CASES.some(c => !only || c.id.includes(only))) { console.error(`smoke: no case matches SMOKE_ONLY=${only}`); process.exit(1); }
  // the whole run is bounded (110 s since SPEC-QA added cases; CI needs about half that), below the CI step's 2-minute limit, so cleanup and a clear message happen before the runner cuts it off
  const wd = Number(process.env.SMOKE_WATCHDOG_MS) || 110000;
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
      const t0 = Date.now(), fails = await runCase(cdp, base, c, errors), secs = (Date.now() - t0) / 1000;
      ran++;
      console.log(`${fails.length ? 'FAIL' : 'ok  '} ${c.id}${secs >= 2 ? `  [${secs.toFixed(1)} s]` : ''}`);   // only slow cases are timed, so the output stays readable
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
