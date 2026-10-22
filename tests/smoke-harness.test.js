'use strict';
// SPEC-SH SH-02 hardening after the independent review (docs/reviews/SH-02.md): the smoke harness's own server, process cleanup and CI behaviour.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const S = require('../scripts/smoke.js');

const ROOT = path.resolve(__dirname, '..');
const SMOKE = path.join(ROOT, 'scripts', 'smoke.js');

/* raw request so the path and Host header are sent exactly as given (fetch normalises both) */
const raw = (port, { method = 'GET', url = '/', host } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, method, path: url, headers: { Host: host === undefined ? `127.0.0.1:${port}` : host } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', reject); req.end();
});
/* a hand-written request on a TCP socket, for the cases Node's HTTP client would repair (an empty Host, no Host at all) */
const sock = (port, text) => new Promise((resolve, reject) => {
  const s = net.connect(port, '127.0.0.1', () => s.write(text)); let buf = '';
  s.on('data', d => { buf += d; const m = buf.match(/^HTTP\/1\.[01] (\d{3})/); if (m) { s.destroy(); resolve(Number(m[1])); } });
  s.on('error', reject); s.on('close', () => resolve(0)); setTimeout(() => { s.destroy(); resolve(-1); }, 3000);
});
async function withServer(fn) {
  const server = await S.startServer(); const port = server.address().port;
  try { await fn(port); } finally { server.closeAllConnections(); server.close(); }
}

test('TC-SH-S01 the server serves the page and stays up after a malformed URL (finding 2)', async () => withServer(async port => {
  assert.equal(await raw(port, { url: '/index.html' }), 200);
  assert.equal(await raw(port, { url: '/%E0%A4%A' }), 400);          // used to throw inside the handler and kill the whole run
  assert.equal(await raw(port, { url: '/%' }), 400);
  assert.equal(await raw(port, { url: '/index.html' }), 200, 'still serving after the bad request');
}));
test('TC-SH-S02 only GET and HEAD are served (finding 4)', async () => withServer(async port => {
  assert.equal(await raw(port, { method: 'HEAD', url: '/index.html' }), 200);
  for (const m of ['DELETE', 'POST', 'PUT', 'PATCH']) assert.equal(await raw(port, { method: m, url: '/index.html' }), 405, m);
}));
test('TC-SH-S03 dot-files and dot-folders (.git, .claude, .github) are never served (finding 4)', async () => withServer(async port => {
  // exactly 403 (a missing file would also give 404, and in a git worktree .git is a file, so it proves nothing there)
  for (const u of ['/.claude/settings.local.json', '/.github/workflows/ci.yml', '/.git/config', '/.git/HEAD', '/%2egit/config', '/%2eclaude/x', '/js/.env', '/js/%2eenv', '/docs/.hidden/x'])
    assert.equal(await raw(port, { url: u }), 403, u);
}));
test('TC-SH-S04 a request whose Host is not this server is refused, against DNS rebinding (finding 4)', async () => withServer(async port => {
  assert.equal(await raw(port, { url: '/index.html', host: `localhost:${port}` }), 200);
  for (const h of ['evil.example', `evil.example:${port}`, `127.0.0.1:${port + 1}`, 'LOCALHOST.evil.example']) assert.equal(await raw(port, { url: '/index.html', host: h }), 403, JSON.stringify(h));
  assert.equal(await sock(port, 'GET /index.html HTTP/1.1\r\nHost:\r\nConnection: close\r\n\r\n'), 403, 'empty Host');
  assert.equal(await sock(port, 'GET /index.html HTTP/1.0\r\n\r\n'), 403, 'no Host header');
  assert.equal(await sock(port, `GET http://evil.example/index.html HTTP/1.1\r\nHost: evil.example\r\nConnection: close\r\n\r\n`), 403, 'absolute-form request to another host');
}));
test('TC-SH-S05 path traversal cannot reach a file outside the repo; fixture files are still served', async () => withServer(async port => {
  // a real file one level above the served root: if any escape worked, one of these would answer 200
  const canary = path.join(path.dirname(ROOT), `smoke-canary-${process.pid}.txt`);
  fs.writeFileSync(canary, 'outside the repo');
  try {
    const name = path.basename(canary);
    // %2f forms decode to '../' after URL parsing, so the harness itself must refuse them: exactly 403
    for (const u of [`/..%2f${name}`, `/%2e%2e%2f${name}`, `/a/..%2f..%2f${name}`, '/%00', '/js/%00.js']) assert.equal(await raw(port, { url: u }), 403, u);
    // dot segments are removed by URL parsing and resolve inside the root, where the file does not exist: never 200
    for (const u of [`/../${name}`, `/%2e%2e/${name}`, `/a/../../${name}`, `/....//${name}`, `/a%5c..%5c..%5c${name}`, '//etc/passwd']) assert.notEqual(await raw(port, { url: u }), 200, u);
  } finally { fs.rmSync(canary, { force: true }); }
  assert.equal(await raw(port, { url: '/content/reads.json' }), 200);
}));

/* finding 3: a filter that matches nothing must not report success; in CI no filter is allowed at all */
test('TC-SH-S06 SMOKE_ONLY that matches no case exits 1 with a clear message, without launching Chrome (finding 3)', () => {
  const r = spawnSync('node', [SMOKE], { env: { ...process.env, CI: '', SMOKE_ONLY: 'no-such-case-xyz', CHROME_BIN: '/nonexistent' }, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 1); assert.match(r.stderr + r.stdout, /no case matches SMOKE_ONLY/);
});
test('TC-SH-S07 in CI SMOKE_ONLY is refused outright, so an environment variable cannot turn the step into a no-op (finding 3)', () => {
  const r = spawnSync('node', [SMOKE], { env: { ...process.env, CI: 'true', SMOKE_ONLY: 'TC-SH-B01', CHROME_BIN: '/nonexistent' }, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 1); assert.match(r.stderr + r.stdout, /SMOKE_ONLY must not be set in CI/);
});

/* finding 1: no browser is left running, and the run cannot hang forever */
function fakeChrome(dir, body) {
  const bin = path.join(dir, 'fake-chrome.sh'), pidFile = path.join(dir, 'pid');
  const helperFile = path.join(dir, 'helper-pid');   // a child in the same process group, like Chrome's renderer and GPU helpers
  fs.writeFileSync(bin, `#!/bin/sh\necho $$ > "${pidFile}"\nsleep 301 &\necho $! > "${helperFile}"\n${body}\nexec sleep 300\n`); fs.chmodSync(bin, 0o755);
  return { bin, pidFile, helperFile };
}
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const waitDead = async (pid, ms = 4000) => { const t = Date.now(); while (alive(pid) && Date.now() - t < ms) await new Promise(r => setTimeout(r, 100)); return !alive(pid); };

test('TC-SH-S08 a Chrome that never reports a DevTools address is killed when the run fails (finding 1)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-fake-'));
  try {
    const { bin, pidFile, helperFile } = fakeChrome(dir, 'true');
    const r = spawnSync('node', [SMOKE], { env: { ...process.env, CI: '', CHROME_BIN: bin, SMOKE_LAUNCH_TIMEOUT_MS: '600', SMOKE_ONLY: 'TC-SH-B01' }, encoding: 'utf8', timeout: 30000 });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.ok(await waitDead(pid), 'the fake browser (pid ' + pid + ') is still running after the harness exited');
    const helper = Number(fs.readFileSync(helperFile, 'utf8'));
    assert.ok(await waitDead(helper), 'the browser\'s helper process (pid ' + helper + ') is still running: only the main process was killed, not the group');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('TC-SH-S09 a browser that connects but never answers is killed by the watchdog and the run exits 1 (finding 1)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-fake-'));
  const stub = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify([{ type: 'page', webSocketDebuggerUrl: `ws://127.0.0.1:${stub.address().port}/page` }])); });
  stub.on('upgrade', () => { /* accept the connection and never complete the handshake */ });
  await new Promise(r => stub.listen(0, '127.0.0.1', r));
  try {
    const { bin, pidFile } = fakeChrome(dir, `echo "DevTools listening on ws://127.0.0.1:${stub.address().port}/devtools/browser/x" >&2`);
    const t0 = Date.now();
    const child = spawn('node', [SMOKE], { env: { ...process.env, CI: '', CHROME_BIN: bin, SMOKE_WATCHDOG_MS: '1500', SMOKE_ONLY: 'TC-SH-B01' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
    const code = await new Promise(res => { const t = setTimeout(() => { child.kill('SIGKILL'); res('hung'); }, 15000); child.on('exit', c => { clearTimeout(t); res(c); }); });
    assert.equal(code, 1, 'exit code ' + code + ' after ' + (Date.now() - t0) + ' ms: ' + out);
    assert.match(out, /watchdog|timed out/i);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.ok(await waitDead(pid), 'the fake browser is still running');
  } finally { stub.close(); stub.closeAllConnections(); fs.rmSync(dir, { recursive: true, force: true }); }
});
