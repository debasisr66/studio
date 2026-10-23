#!/usr/bin/env node
// Builds the throwaway phone-preview copy of Studio (SPEC-QA, owner decision 2026-10-23).
// Usage: node scripts/make-sandbox.js <source repo folder> <empty target folder>
// The copy goes to a SEPARATE repository (debasisr66/studio-sandbox) that has its own fine-grained token, so a mistake there can never touch the
// real site or the real token. Only the site files are copied (no docs, tests, scripts or workflows). Each patch must match exactly one line or
// the script stops and writes nothing: a code change can never silently ship an unpatched sandbox.
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = ['index.html', 'css', 'js', 'fonts', 'assets', 'content'];
// [file, text to find (exactly once), replacement]
const PATCHES = [
  ['js/app.js', "const OWNER = 'debasisr66', HUB = 'studio', BRANCH = 'main';", "const OWNER = 'debasisr66', HUB = 'studio-sandbox', BRANCH = 'main';"],
  ['index.html', /<title>(?!SANDBOX)/, '<title>SANDBOX · '],
];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else if (e.isFile()) fs.copyFileSync(a, b);
  }
}
function fail(msg) { console.error('make-sandbox: ' + msg); process.exit(1); }

function main(argv) {
  const [srcArg, outArg] = argv;
  if (!srcArg || !outArg) fail('usage: node scripts/make-sandbox.js <source repo folder> <empty target folder>');
  const src = path.resolve(srcArg), out = path.resolve(outArg);
  if (out === src || out.startsWith(src + path.sep) || src.startsWith(out + path.sep)) fail('the target must be a different folder from the source');
  if (fs.existsSync(out) && fs.readdirSync(out).length) fail('the target folder must be empty (nothing was written)');
  // patch in memory first, so a missing patch line writes nothing
  const patched = {};
  for (const [file, find, repl] of PATCHES) {
    const p = path.join(src, file);
    if (!fs.existsSync(p)) fail(`patch target ${file} not found (nothing was written)`);
    const text = patched[file] !== undefined ? patched[file] : fs.readFileSync(p, 'utf8');
    const hits = typeof find === 'string' ? text.split(find).length - 1 : (text.match(new RegExp(find.source, 'g')) || []).length;
    if (hits !== 1) fail(`patch for ${file} not found exactly once (found ${hits}): ${String(find).slice(0, 60)} (nothing was written)`);
    patched[file] = typeof find === 'string' ? text.replace(find, () => repl) : text.replace(find, repl);
  }
  for (const item of SITE) { if (!fs.existsSync(path.join(src, item))) fail(`patch source ${item} not found (nothing was written)`); }
  fs.mkdirSync(out, { recursive: true });
  for (const item of SITE) {
    const a = path.join(src, item), b = path.join(out, item);
    fs.statSync(a).isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
  for (const [file, text] of Object.entries(patched)) fs.writeFileSync(path.join(out, file), text);
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  console.log(`make-sandbox: wrote the sandbox copy to ${out} (${Object.keys(patched).length} patches)`);
}
if (require.main === module) main(process.argv.slice(2));
module.exports = { PATCHES, SITE };
