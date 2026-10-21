'use strict';
// SPEC-TR Phase A: TR-01 (strict URL rule) and TR-02 (cache envelope). Test IDs match docs/specs/product-trust-reliability/test.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../scripts/validate-site.js');
const RL = require('../js/reads-lib.js');

const NOW = Date.parse('2026-10-21T12:00:00Z');
const entry = (o = {}) => ({ description: '', stars: 1, language: 'JS', topics: [], pushed_at: '2026-10-19', html_url: 'https://github.com/o/App', latest_release: null, ...o });
const cache = (o = {}) => ({ synced_at: '2026-10-21T03:00:00.000Z', products: { 'o/App': entry() }, ...o });
const reg = [{ repo: 'o/App' }];
const errs = (c, r = reg) => V.validateCache(c, r, NOW);

test('TC-TR-U01/U02 accepted: plain http and https', () => {
  assert.equal(RL.isPublishableUrl('https://example.com/a?b=1'), true);
  assert.equal(RL.isPublishableUrl('http://example.com'), true);
});
test('TC-TR-U03/U04 rejected: javascript: and data:', () => {
  assert.equal(RL.isPublishableUrl('javascript:alert(1)'), false);
  assert.equal(RL.isPublishableUrl('data:text/html,x'), false);
});
test('TC-TR-U05 rejected: leading/trailing whitespace', () => {
  assert.equal(RL.isPublishableUrl(' https://a.com'), false);
  assert.equal(RL.isPublishableUrl('https://a.com\n'), false);
});
test('TC-TR-U06 rejected: control characters anywhere', () => {
  assert.equal(RL.isPublishableUrl('https://a.\tcom'), false);
  assert.equal(RL.isPublishableUrl('https://a.com/\u0000x'), false);
  assert.equal(RL.isPublishableUrl('https://a.com/\u007fx'), false);
});
test('TC-TR-U07 rejected: embedded credentials', () => {
  assert.equal(RL.isPublishableUrl('https://user:pw@a.com'), false);
  assert.equal(RL.isPublishableUrl('https://user@a.com'), false);
});
test('TC-TR-U08 rejected: empty, no host, too long, non-string', () => {
  for (const u of ['', 'http://', 'https:///x', 'https://' + 'a'.repeat(2050) + '.com', null, undefined, 5]) assert.equal(RL.isPublishableUrl(u), false, String(u));
  assert.equal(RL.isPublishableUrl('https://a.com/' + 'x'.repeat(2048 - 14)), true);
});
test('TC-TR-U09 the rule is applied to every URL field and names file, entry and field', () => {
  const bad = ' https://a.com';
  assert.ok(V.validateProducts([{ repo: 'o/A', url: bad }]).some(e => /products\.json\[0\].*url/.test(e)));
  assert.ok(V.validateCache(cache({ products: { 'o/App': entry({ html_url: bad }) } }), reg, NOW).errors.some(e => /cache\.json\[o\/App\].*html_url/.test(e)));
  const rel = entry({ latest_release: { tag: 'v1', download_url: bad, assets: [{ name: 'a', download_url: bad }] } });
  const r = V.validateCache(cache({ products: { 'o/App': rel } }), reg, NOW).errors;
  assert.ok(r.some(e => /download_url/.test(e)) && r.some(e => /assets\[0\]/.test(e)));
  assert.ok(V.validateBlog({ posts: [{ date: '2026-10-21', title: 't', body: 'b', link: bad }] }).some(e => /blog\.json\[0\].*link/.test(e)));
  assert.ok(V.validateReads({ books: [], articles: [{ title: 't', url: 'https://a.com/\tx' }] }).errors.some(e => /reads\.json articles\[0\].*url/.test(e)));
});

test('TC-TR-C01 error: synced_at missing', () => {
  const c = cache(); delete c.synced_at;
  assert.ok(errs(c).errors.some(e => /synced_at/.test(e)));
});
test('TC-TR-C02 error: synced_at not ISO-8601 UTC', () => {
  for (const v of ['yesterday', '2026-10-21', '2026-10-21T03:00:00+05:30', 12345]) assert.ok(errs(cache({ synced_at: v })).errors.some(e => /synced_at/.test(e)), String(v));
  assert.deepEqual(errs(cache({ synced_at: '2026-10-21T03:00:00Z' })).errors, []);
});
test('TC-TR-C03 error: synced_at more than 5 minutes in the future', () => {
  assert.ok(errs(cache({ synced_at: '2026-10-21T12:06:00Z' })).errors.some(e => /future/.test(e)));
  assert.deepEqual(errs(cache({ synced_at: '2026-10-21T12:04:00Z' })).errors, []);
});
test('TC-TR-C04 error: stars negative or fractional', () => {
  for (const s of [-1, 1.5]) assert.ok(errs(cache({ products: { 'o/App': entry({ stars: s }) } })).errors.some(e => /stars/.test(e)), String(s));
});
test('TC-TR-C05 error: release tag empty', () => {
  const rel = { tag: '', download_url: 'https://a.com/x', assets: [] };
  assert.ok(errs(cache({ products: { 'o/App': entry({ latest_release: rel }) } })).errors.some(e => /tag/.test(e)));
});
test('TC-TR-C06 warning only: cached repo not in registry, or hidden', () => {
  const c = cache({ products: { 'o/App': entry(), 'o/Gone': entry() } });
  let r = errs(c);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some(w => /o\/Gone/.test(w)));
  r = errs(cache(), [{ repo: 'o/App', hidden: true }]);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some(w => /o\/App/.test(w) && /hidden|not in the registry/.test(w)));
});
test('TC-TR-C07 the real content/cache.json passes', () => {
  const real = require('../content/cache.json'), registry = require('../content/products.json');
  const r = V.validateCache(real, registry, Date.parse(real.synced_at) + 3600e3);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});
