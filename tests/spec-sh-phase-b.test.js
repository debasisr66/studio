'use strict';
// SPEC-SH Phase B: SH-03 (content contract), SH-04 (schema versions), SH-07 docs. Test IDs match docs/specs/stabilize-core-hub/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../scripts/validate-site.js');
const RL = require('../js/reads-lib.js');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const article = (o = {}) => ({ id: 1, added: '2026-10-19', title: 'T', url: 'https://example.com/a', kind: 'article', tags: [], category: 'technical', ...o });
const reads = (o = {}) => ({ schema_version: 2, books: [], articles: [article()], ...o });

/* SH-03: the contract document is kept in step with the files and the rules */
test('TC-SH-C01 every file in content/ appears in CONTRACT.md', () => {
  const files = fs.readdirSync(path.join(ROOT, 'content'));
  assert.deepEqual(V.checkContractDoc(read('docs/CONTRACT.md'), files, []), []);
});
test('TC-SH-C02 every RULES id appears in CONTRACT.md', () => {
  assert.deepEqual(V.checkContractDoc(read('docs/CONTRACT.md'), [], V.RULES.map(r => r.id)), []);
});
test('TC-SH-C03 removing a file or a rule from the document is detected, naming it', () => {
  const doc = read('docs/CONTRACT.md');
  const files = ['products.json', 'profile.jpg'];
  const ids = ['cache-stars', 'product-slug-unique'];
  assert.deepEqual(V.checkContractDoc(doc, files, ids), []);
  const noPhoto = V.checkContractDoc(doc.replaceAll('profile.jpg', 'x'), files, ids);
  assert.equal(noPhoto.length, 1); assert.match(noPhoto[0], /profile\.jpg/);
  const noRule = V.checkContractDoc(doc.replaceAll('cache-stars', 'x'), files, ids);
  assert.equal(noRule.length, 1); assert.match(noRule[0], /cache-stars/);
});
test('TC-SH-C03 a new file in content/ that the document does not mention fails', () => {
  const p = V.checkContractDoc(read('docs/CONTRACT.md'), ['brand-new.json'], []);
  assert.equal(p.length, 1); assert.match(p[0], /brand-new\.json/);
});

/* SH-04: schema versions */
test('TC-SH-V01 reads.json with a known schema_version is accepted', () => {
  assert.deepEqual(V.validateReads(reads()).errors, []);
});
test('TC-SH-V02 an unknown or non-integer schema_version is a CI error naming the file', () => {
  for (const v of [1, 3, 0, -1, 1.5, '1', null, true]) {
    const e = V.validateReads(reads({ schema_version: v })).errors;
    assert.ok(e.some(m => /reads\.json: schema_version must be/.test(m)), JSON.stringify(v));
  }
});
test('TC-SH-V03 a missing schema_version is a CI error (the browser still tolerates it)', () => {
  const r = reads(); delete r.schema_version;
  assert.ok(V.validateReads(r).errors.some(m => /schema_version must be/.test(m)));
  assert.equal(RL.isSupportedReadsVersion(undefined), true);
  assert.equal(RL.isSupportedReadsVersion(null), true);
});
test('TC-SH-V03 the browser refuses only a version newer than it understands', () => {
  assert.equal(RL.READS_SCHEMA_VERSION, 2);
  assert.equal(RL.isSupportedReadsVersion(1), true);
  assert.equal(RL.isSupportedReadsVersion(2), true);
  assert.equal(RL.isSupportedReadsVersion(3), false);
  assert.equal(RL.isSupportedReadsVersion(99), false);
  assert.equal(RL.isSupportedReadsVersion('x'), true);   // garbage is treated as an old file, never a crash
});
test('TC-SH-V04 the real content/reads.json carries a supported schema_version', () => {
  const real = JSON.parse(read('content/reads.json'));
  assert.equal(RL.READS_SCHEMA_VERSION, 2);
  assert.equal(real.schema_version, 2);
  assert.deepEqual(V.validateReads(real).errors, []);
});
test('TC-SH-V04 the admin publish keeps the version: serializeReads writes it first, then books and articles', () => {
  const out = RL.serializeReads({ books: [{ title: 'B', category: 'technical' }], articles: [article()] });
  assert.deepEqual(Object.keys(out), ['schema_version', 'books', 'articles']);
  assert.equal(out.schema_version, RL.READS_SCHEMA_VERSION);
  const again = RL.serializeReads({ schema_version: 2, books: out.books, articles: out.articles });
  assert.equal(JSON.stringify(again), JSON.stringify(out));
  assert.deepEqual(RL.serializeReads({}), { schema_version: 2, books: [], articles: [] });
});

/* SH-07 / D02: the documents' links and anchors resolve */
const slug = h => h.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-');
test('TC-SH-D02 every relative link and #anchor in README and docs/ resolves', () => {
  const files = ['README.md'];
  (function walk(d) { for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const rel = path.posix.join(d, f.name);
    if (f.isDirectory()) walk(rel); else if (f.name.endsWith('.md')) files.push(rel); } })('docs');
  const bad = [];
  for (const f of files) {
    const text = read(f).replace(/```[\s\S]*?```/g, '');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const [target, frag] = m[1].split('#');
      if (/^(https?:|mailto:)/.test(target) || target === 'url') continue;
      const dest = target ? path.posix.normalize(path.posix.join(path.posix.dirname(f), target)) : f;
      if (!fs.existsSync(path.join(ROOT, dest))) { bad.push(`${f}: ${m[1]} (no such file)`); continue; }
      if (frag && dest.endsWith('.md')) {
        const heads = [...read(dest).replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6} (.+)$/gm)].map(h => slug(h[1]));
        if (!heads.includes(frag)) bad.push(`${f}: ${m[1]} (no heading "${frag}" in ${dest})`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
