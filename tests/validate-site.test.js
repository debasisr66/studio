'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../scripts/validate-site.js');

const product = (o = {}) => ({ repo: 'debasisr66/App', name: 'App', tagline: 't', category: 'Tools', featured: false, hidden: false, ...o });

test('products: valid registry passes', () => {
  assert.deepEqual(V.validateProducts([product(), product({ repo: 'debasisr66/Other', url: 'https://x.dev/', download_asset: 'App-*.zip' })]), []);
});

test('products: catches non-array, bad repo, duplicate repo, bad url, bad types', () => {
  assert.ok(V.validateProducts({}).length);
  assert.ok(V.validateProducts([product({ repo: 'nope' })]).some(e => /repo/.test(e)));
  assert.ok(V.validateProducts([product(), product()]).some(e => /duplicate/i.test(e)));
  assert.ok(V.validateProducts([product({ url: 'javascript:alert(1)' })]).some(e => /url/.test(e)));
  assert.ok(V.validateProducts([product({ download_asset: 5 })]).some(e => /download_asset/.test(e)));
  assert.ok(V.validateProducts([product({ featured: 'yes' })]).some(e => /featured/.test(e)));
});

const cacheEntry = (o = {}) => ({ description: '', stars: 1, language: 'JS', topics: [], pushed_at: '2026-10-19', html_url: 'https://github.com/debasisr66/App', latest_release: null, ...o });

test('cache: valid cache passes; null release allowed', () => {
  const r = V.validateCache({ synced_at: '2026-10-19T00:00:00Z', products: { 'debasisr66/App': cacheEntry() } }, [product()]);
  assert.deepEqual(r.errors, []);
});

test('cache: catches missing products object, bad release shape, unsafe download url', () => {
  assert.ok(V.validateCache({}, []).errors.length);
  const bad = cacheEntry({ latest_release: { tag: '', download_url: 'javascript:x', assets: 'no' } });
  const r = V.validateCache({ products: { 'debasisr66/App': bad } }, [product()]);
  assert.ok(r.errors.some(e => /tag/.test(e)));
  assert.ok(r.errors.some(e => /download_url/.test(e)));
  assert.ok(r.errors.some(e => /assets/.test(e)));
});

test('cache: warns (does not fail) for a registry product that is not cached yet', () => {
  const r = V.validateCache({ products: {} }, [product()]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
});

test('blog: valid passes; bad date, empty title, unsafe link caught', () => {
  assert.deepEqual(V.validateBlog({ posts: [{ id: 1, date: '2026-10-19', title: 'T', body: 'B', link: '' }] }), []);
  const e = V.validateBlog({ posts: [{ id: 1, date: '19/10/2026', title: '', body: 'B', link: 'javascript:alert(1)' }] });
  assert.ok(e.some(x => /date/.test(x)));
  assert.ok(e.some(x => /title/.test(x)));
  assert.ok(e.some(x => /link/.test(x)));
  assert.ok(V.validateBlog({}).length);
});

const read = (o = {}) => ({ id: 1, added: '2026-10-19', title: 'T', url: 'https://example.com/a', comment: 'c', kind: 'article', tags: ['ai'], ...o });

test('reads: valid, legacy-shaped and book entries pass', () => {
  const r = V.validateReads({ books: [{ title: 'B', author: 'A' }], articles: [read(), { title: 'Old', url: 'https://old.org/x', note: 'n' }] });
  assert.deepEqual(r.errors, []);
});

test('reads: catches javascript: URL, bad kind, too many tags, long comment, bad date, duplicate id', () => {
  const r = V.validateReads({ books: [], articles: [
    read({ id: 1, url: 'javascript:alert(1)' }),
    read({ id: 2, kind: 'weird' }),
    read({ id: 3, tags: ['a', 'b', 'c', 'd', 'e', 'f'] }),
    read({ id: 4, comment: 'x'.repeat(281) }),
    read({ id: 5, added: 'yesterday' }),
    read({ id: 5, url: 'https://example.com/b' }),
  ] });
  for (const re of [/url/, /kind/, /tags/, /comment/, /added/, /duplicate id/i]) assert.ok(r.errors.some(e => re.test(e)), String(re));
});

test('reads: duplicate URLs only warn', () => {
  const r = V.validateReads({ books: [], articles: [read({ id: 1 }), read({ id: 2, url: 'https://www.example.com/a/' })] });
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
});

test('reads: malformed container is an error', () => {
  assert.ok(V.validateReads({ books: {}, articles: [] }).errors.length);
  assert.ok(V.validateReads(null).errors.length);
});

const GOOD_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>T</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'"></head>
<body><script src="js/app.js"></script></body></html>`;

test('index: valid page passes', () => {
  assert.deepEqual(V.validateIndex(GOOD_HTML, () => true), []);
});

test('index: catches missing CSP, inline script, missing referenced file, missing lang/title', () => {
  assert.ok(V.validateIndex(GOOD_HTML.replace(/<meta http-equiv[^>]*>/, ''), () => true).some(e => /Content-Security-Policy/.test(e)));
  assert.ok(V.validateIndex(GOOD_HTML.replace('<script src="js/app.js"></script>', '<script>alert(1)</script>'), () => true).some(e => /inline/i.test(e)));
  assert.ok(V.validateIndex(GOOD_HTML, () => false).some(e => /js\/app\.js/.test(e)));
  assert.ok(V.validateIndex(GOOD_HTML.replace(' lang="en"', ''), () => true).some(e => /lang/.test(e)));
  assert.ok(V.validateIndex(GOOD_HTML.replace('<title>T</title>', ''), () => true).some(e => /title/.test(e)));
});

test('index: CSP that allows unsafe-inline scripts or eval is rejected', () => {
  const loose = GOOD_HTML.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
  assert.ok(V.validateIndex(loose, () => true).some(e => /unsafe/.test(e)));
});

test('size budget: flags files over budget', () => {
  assert.deepEqual(V.checkSizes({ 'index.html': 1000, 'js/app.js': 1000 }), []);
  assert.ok(V.checkSizes({ 'index.html': 10 ** 6 }).some(e => /index\.html/.test(e)));
  assert.ok(V.checkSizes({ 'js/app.js': 10 ** 6 }).some(e => /js\/app\.js/.test(e)));
});

test('syntax: valid JS passes, broken JS is reported', () => {
  assert.deepEqual(V.checkSyntax({ 'a.js': 'const x = 1;' }), []);
  assert.ok(V.checkSyntax({ 'b.js': 'const = ;' }).some(e => /b\.js/.test(e)));
});
