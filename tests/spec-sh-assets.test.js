'use strict';
// SPEC-SH SH-06. No network: validate the cached URLs, not their redirect targets.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../scripts/validate-site.js');
const url = 'https://github.com/o/a/releases/download/v1/App.zip';
const release = () => ({ tag: 'v1.0', download_url: 'https://github.com/o/a/releases/tag/v1', assets: [{ name: 'App.zip', download_url: url, size: 123 }] });
const check = r => V.validateCache({ synced_at: '2026-10-21T03:00:00Z', products: { 'o/a': { stars: 1, latest_release: r } } }, [{ repo: 'o/a' }], Date.parse('2026-10-26T00:00:00Z'));

for (const size of [-1, 0.5, '1', null, undefined, true, NaN, Infinity, -Infinity, {}, []]) {
  test(`TC-SH-A01 rejects asset size ${String(size)} (${typeof size})`, () => {
    const r = release(); r.assets[0].size = size;
    assert.ok(check(r).errors.some(e => /assets\[0\]\.size/.test(e)));
  });
}
for (const size of [0, 1, Number.MAX_SAFE_INTEGER]) {
  test(`TC-SH-A01 accepts non-negative integer size ${size}`, () => {
    const r = release(); r.assets[0].size = size;
    assert.deepEqual(check(r), { errors: [], warnings: [] });
  });
}
const badUrls = [
  'https://example.com/App.zip', 'https://github.com.evil.test/a',
  'https://evilgithub.com/a', 'https://api.github.com/a', 'https://github.com./a',
  'https://github.com@evil.test/a', 'https://evil.test/github.com/a',
  'https://evil.test/?next=https://github.com/a', 'https://evil.test/#github.com',
  'https://user:pass@github.com/a', 'ftp://github.com/a', '//github.com/a',
  'javascript:alert(1)', 'https://github.com/a b', 'https://github.com/a\n',
  'https://github.com/' + 'x'.repeat(2048), 'not a URL', '', null, undefined, 5,
];
for (const field of ['release', 'asset']) {
  for (const [i, value] of badUrls.entries()) {
    test(`TC-SH-A02 rejects invalid ${field} URL #${i + 1}`, () => {
      const r = release(); (field === 'release' ? r : r.assets[0]).download_url = value;
      assert.ok(check(r).errors.some(e => e.includes(field === 'release' ? 'latest_release.download_url' : 'assets[0]')));
    });
  }
  for (const value of [url, url.replace('https:', 'http:'), url.replace('github.com', 'GITHUB.COM'), url + '?download=1#file']) {
    test(`TC-SH-A02 accepts legitimate ${field} URL ${value}`, () => {
      const r = release(); (field === 'release' ? r : r.assets[0]).download_url = value;
      assert.deepEqual(check(r), { errors: [], warnings: [] });
    });
  }
}
test('release fallbacks and unrelated external links remain valid', () => {
  for (const r of [null, undefined, { ...release(), assets: [] }]) assert.deepEqual(check(r), { errors: [], warnings: [] });
  assert.deepEqual(V.validateProducts([{ repo: 'o/a', url: 'https://example.com' }]), []);
});
test('malformed assets report errors without throwing; all assets are checked', () => {
  for (const asset of [null, 4, [], {}, { ...release().assets[0], name: 4 }]) {
    const r = release(); r.assets.push(asset);
    assert.ok(check(r).errors.some(e => /assets\[1\]/.test(e)));
  }
  const r = release(); r.assets.push({ name: 'Bad.zip', download_url: 'https://example.com/a', size: -1 });
  assert.ok(check(r).errors.some(e => /assets\[1\]/.test(e)));
});
for (const tag of [1, null, undefined, '', 'x'.repeat(65)]) {
  test(`SH-06 rejects invalid or oversized badge tag (${String(tag).length} characters)`, () => {
    assert.ok(check({ ...release(), tag }).errors.some(e => /latest_release.tag/.test(e)));
  });
}
test('SH-06 accepts badge tag at the documented 64-character boundary', () => {
  assert.deepEqual(check({ ...release(), tag: 'x'.repeat(64) }), { errors: [], warnings: [] });
});
test('SH-06 bounds changelog version text without changing its format', () => {
  const checkVersion = version => V.validateChangelog({ releases: [{ version, date: '2026-10-21', title: 'Release', items: ['Done'] }] });
  assert.deepEqual(checkVersion('1.' + '2'.repeat(62)), []);
  assert.ok(checkVersion('1.' + '2'.repeat(63)).some(e => /version/.test(e)));
  assert.ok(checkVersion('v1.0').some(e => /version/.test(e)));
});
test('TC-SH-A03 real cache and registry pass with no warnings', () => {
  const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', file), 'utf8'));
  assert.deepEqual(V.validateCache(read('cache.json'), read('products.json')), { errors: [], warnings: [] });
});
