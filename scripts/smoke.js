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
  const server = http.createServer((req, res) => {
    const rel = path.posix.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (rel.startsWith('..') || rel.includes('\0')) { res.writeHead(403); return res.end(); }
    const target = rel.endsWith('/') ? rel + 'index.html' : rel;
    const m = overlay.manifest;
    if ((m.missing || []).includes(target)) { res.writeHead(404); return res.end('missing (fixture)'); }
    if ((m.hang || []).includes(target)) return;                       // never answered: the connection is closed at shutdown
    const send = () => {
      for (const base of [...overlay.dirs, ROOT]) {
        const f = path.join(base, target);
        if (f.startsWith(base) && fs.existsSync(f) && fs.statSync(f).isFile()) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
          return res.end(fs.readFileSync(f));
        }
      }
      res.writeHead(404); res.end('not found');
    };
    const d = (m.delay || {})[target];
    d ? setTimeout(send, d) : send();
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

/* ---------- Chrome and a minimal DevTools-protocol client ---------- */
function findChrome() {
  const cands = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const c of cands) {
    if (path.isAbsolute(c) ? fs.existsSync(c) : spawnSync('which', [c]).status === 0) return c;
  }
  return null;
}

async function launchChrome(bin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-smoke-'));
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars',
    '--remote-debugging-port=0', `--user-data-dir=${dir}`, ...(process.env.CI ? ['--no-sandbox'] : []), 'about:blank'];
  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome did not report a DevTools address within 20 s\n' + buf)), 20000);
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
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else listeners.forEach(l => l(m));
  };
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools connection failed')); });
  const send = (method, params = {}) => new Promise((res, rej) => { pending.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  return { ready, send, on: l => listeners.push(l), close: () => ws.close() };
}

/* ---------- running one case ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runCase(cdp, base, c, errors) {
  overlay = { dirs: (c.fixtures || []).map(f => path.join(FIX, f)), manifest: {} };
  for (const f of c.fixtures || []) { const mf = path.join(FIX, f, 'fixture.json'); if (fs.existsSync(mf)) Object.assign(overlay.manifest, JSON.parse(fs.readFileSync(mf, 'utf8'))); }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: c.width, height: c.width < 500 ? 812 : 800, deviceScaleFactor: 1, mobile: c.width < 500 });
  await cdp.send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'all' }).catch(() => {});
  const init = c.token ? await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{sessionStorage.setItem('studio-admin-pat','not-a-real-token-smoke-test')}catch(e){}" }) : null;
  errors.length = 0;
  const t0 = Date.now();
  await cdp.send('Page.navigate', { url: base + '/' });
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

const CASES = [
  { id: 'TC-SH-B01 real content, 1280 px', width: 1280, fixtures: [], noErrors: true, check: async ctx => {
    const f = [];
    for (const [sel, name] of [['#products', 'Products'], ['#updates', 'Updates'], ['#reads', 'Reads']]) if (!(await ctx.ev(count(sel)))) f.push(name + ' section missing');
    if (!(await ctx.ev(count('#grid .card:not(.skel)')))) f.push('no product cards from the real content');
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
  { id: 'TC-SH-T01 reads.json never answers: the page still loads (8 s timeout) and the rest renders', width: 1280, fixtures: ['hang-reads', 'healthy'], timeout: 20000, check: async ctx => {
    const f = [...await sectionsRendered(ctx, ['reads'])]; if (ctx.ms > 14000) f.push(`took ${ctx.ms} ms; the timeout should end the wait at about 8 s`); return f; } },
  { id: 'TC-SH-T02 reads.json answers after 2 s: it still renders', width: 1280, fixtures: ['slow-reads', 'healthy'], check: ctx => sectionsRendered(ctx) },
];

async function main() {
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
    const only = process.env.SMOKE_ONLY;
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
    try { fs.rmSync(chrome.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* temp folder, the OS cleans it */ }
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${failed ? 'FAILED' : 'OK'}: ${ran - failed} of ${ran} cases passed in ${secs} s`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Browser smoke test: ${failed ? 'FAILED' : 'OK'} (${ran - failed}/${ran}, ${secs} s)\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('smoke crashed: ' + e.message); process.exit(1); });
