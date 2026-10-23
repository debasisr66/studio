'use strict';
// scripts/make-sandbox.js: builds the throwaway phone-preview copy of Studio (docs/specs/quick-add, owner decision 2026-10-23).
// The copy is a separate repository with a separate token, so a mistake there can never touch the real site or the real token.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'make-sandbox.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-'));
const run = (src, out) => spawnSync('node', [SCRIPT, src, out], { encoding: 'utf8' });
const read = (d, rel) => fs.readFileSync(path.join(d, rel), 'utf8');
const ls = d => { const o = []; (function w(p) { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); e.isDirectory() ? w(f) : o.push(path.relative(d, f)); } })(d); return o.sort(); };

test('make-sandbox copies only the site files and nothing else (no docs, tests, scripts, workflows, git data)', () => {
  const out = tmp();
  try {
    const r = run(ROOT, out); assert.equal(r.status, 0, r.stderr + r.stdout);
    const files = ls(out);
    assert.ok(files.includes('index.html') && files.includes('js/app.js') && files.includes('css/site.css') && files.includes('content/reads.json'));
    assert.ok(files.some(f => f.startsWith('fonts/')) && files.some(f => f.startsWith('assets/')));
    for (const bad of ['docs/', 'tests/', 'scripts/', '.github/', '.git/', '.claude/', 'README.md', 'node_modules/']) assert.ok(!files.some(f => f === bad || f.startsWith(bad)), 'copied ' + bad);
    assert.ok(files.includes('.nojekyll'), 'Pages needs .nojekyll so nothing is processed');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
test('make-sandbox points the admin at the sandbox repository, not at Studio', () => {
  const out = tmp();
  try {
    run(ROOT, out);
    const app = read(out, 'js/app.js');
    assert.match(app, /const OWNER = 'debasisr66', HUB = 'studio-sandbox', BRANCH = 'main';/);
    assert.ok(!/HUB = 'studio'[,;]/.test(app), 'the real repository name is still in the code');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
test('make-sandbox gives the token form a sandbox username so a password manager cannot mix the two tokens (SPEC-QA QA-04)', () => {
  const out = tmp();
  try {
    const r = run(ROOT, out); assert.equal(r.status, 0, r.stderr);
    const h = read(out, 'index.html');
    assert.match(h, /id="tok-user"[^>]*value="studio-admin-sandbox"/);
    assert.ok(!/value="studio-admin"/.test(h), 'the real username is still in the sandbox page');
    assert.match(read(ROOT, 'index.html'), /id="tok-user"[^>]*value="studio-admin"/);   // the source is untouched
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
test('make-sandbox marks the page so it cannot be mistaken for the real site (title)', () => {
  const out = tmp();
  try {
    run(ROOT, out);
    assert.match(read(out, 'index.html'), /<title>SANDBOX · [^<]+<\/title>/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
test('make-sandbox changes nothing else: only the patched lines differ from the source files', () => {
  const out = tmp();
  try {
    const r = run(ROOT, out); assert.equal(r.status, 0, r.stderr); assert.ok(ls(out).length > 10, 'nothing was copied');
    for (const f of ls(out).filter(x => x !== '.nojekyll')) {
      const a = fs.readFileSync(path.join(ROOT, f)), b = fs.readFileSync(path.join(out, f));
      if (f === 'js/app.js' || f === 'index.html') {
        const la = a.toString().split('\n'), lb = b.toString().split('\n');
        assert.equal(la.length, lb.length, f + ' changed length');
        assert.ok(la.filter((l, i) => l !== lb[i]).length <= 3, f + ' differs on too many lines');
      } else assert.ok(a.equals(b), f + ' differs from the source');
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
test('make-sandbox refuses (exit 1, nothing written) when a patch line is not found, so a code change cannot silently ship an unpatched sandbox', () => {
  const src = tmp(), out = tmp();
  try {
    for (const d of ['js', 'css', 'content', 'fonts', 'assets']) fs.mkdirSync(path.join(src, d));
    fs.writeFileSync(path.join(src, 'index.html'), '<html><head><title>Studio</title></head></html>');
    fs.writeFileSync(path.join(src, 'js/app.js'), "const OWNER = 'someone-else';\n");
    const r = run(src, path.join(out, 'x')); assert.equal(r.status, 1); assert.match(r.stderr + r.stdout, /patch.*not found/i);
    assert.ok(!fs.existsSync(path.join(out, 'x')) || ls(path.join(out, 'x')).length === 0, 'files were written');
  } finally { fs.rmSync(src, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); }
});
test('make-sandbox refuses to write into the source repository itself or into a folder that is not empty', () => {
  const same = run(ROOT, ROOT); assert.equal(same.status, 1); assert.match(same.stderr + same.stdout, /source/i);
  const out = tmp(); fs.writeFileSync(path.join(out, 'keep.txt'), 'x');
  try { const r = run(ROOT, out); assert.equal(r.status, 1); assert.match(r.stderr + r.stdout, /empty/i); assert.equal(read(out, 'keep.txt'), 'x'); } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
