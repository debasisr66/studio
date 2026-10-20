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

// ---- v1.3: strict style CSP, no inline styles, changelog ----

test('index: CSP that allows unsafe-inline styles is rejected', () => {
  const loose = GOOD_HTML.replace("script-src 'self'", "script-src 'self'; style-src 'self' 'unsafe-inline'");
  assert.ok(V.validateIndex(loose, () => true).some(e => /style-src/.test(e)));
  const strict = GOOD_HTML.replace("script-src 'self'", "script-src 'self'; style-src 'self'");
  assert.deepEqual(V.validateIndex(strict, () => true), []);
});

test('index: inline <style> blocks and style= attributes are rejected', () => {
  assert.ok(V.validateIndex(GOOD_HTML.replace('</head>', '<style>a{color:red}</style></head>'), () => true).some(e => /<style>/.test(e)));
  assert.ok(V.validateIndex(GOOD_HTML.replace('<body>', '<body><p style="color:red">x</p>'), () => true).some(e => /style=/.test(e)));
  assert.ok(V.validateIndex(GOOD_HTML.replace('<body>', "<body><p STYLE='x'>x</p>"), () => true).some(e => /style=/.test(e)));
});

test('index: a linked stylesheet that exists is fine, one that is missing is reported', () => {
  const linked = GOOD_HTML.replace('</head>', '<link rel="stylesheet" href="css/site.css"></head>');
  assert.deepEqual(V.validateIndex(linked, f => f === 'css/site.css' || f === 'js/app.js'), []);
  assert.ok(V.validateIndex(linked, f => f !== 'css/site.css').some(e => /css\/site\.css/.test(e)));
});

test('script templates: style attributes generated by JS are rejected', () => {
  assert.deepEqual(V.checkNoInlineStyles({ 'js/app.js': "el.innerHTML = '<p class=\"a\">x</p>'; el.style.setProperty('--h', 1);" }), []);
  assert.ok(V.checkNoInlineStyles({ 'js/app.js': 'return `<i style="background:red"></i>`;' }).some(e => /js\/app\.js/.test(e)));
  assert.ok(V.checkNoInlineStyles({ 'js/app.js': "x.setAttribute('style', 'a:b')" }).length);
  assert.ok(V.checkNoInlineStyles({ 'js/app.js': "x.innerHTML = '<b style=\\'a:b\\'>'" }).length);
});

const rel = (o = {}) => ({ version: '1.3', date: '2026-10-19', title: 'T', items: ['One', 'Two'], ...o });

test('changelog: valid, newest-first list passes', () => {
  assert.deepEqual(V.validateChangelog({ releases: [rel(), rel({ version: '1.2' }), rel({ version: '1.1.1' }), rel({ version: '1.1' })] }), []);
});

test('changelog: catches missing releases, bad version, bad date, ordering, duplicates', () => {
  assert.ok(V.validateChangelog({}).length);
  assert.ok(V.validateChangelog({ releases: [] }).length);
  assert.ok(V.validateChangelog({ releases: [rel({ version: 'one' })] }).some(e => /version/.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ date: '19/10/2026' })] }).some(e => /date/.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ version: '1.1' }), rel({ version: '1.2' })] }).some(e => /descending|order/i.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel(), rel()] }).some(e => /duplicate|order/i.test(e)));
});

test('changelog: title and item limits, types, and no links or markup', () => {
  assert.ok(V.validateChangelog({ releases: [rel({ title: '' })] }).some(e => /title/.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ title: 'x'.repeat(81) })] }).some(e => /title/.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ items: [] })] }).some(e => /items/.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ items: Array(7).fill('x') })] }).some(e => /items/.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ items: ['x'.repeat(161)] })] }).some(e => /items/.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ items: [5] })] }).some(e => /items/.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ items: ['<img src=x onerror=alert(1)>'] })] }).some(e => /markup|plain text/i.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ items: ['see https://evil.example/x'] })] }).some(e => /link/i.test(e)));
  assert.ok(V.validateChangelog({ releases: [rel({ title: '<b>T</b>' })] }).some(e => /markup|plain text/i.test(e)));
});

test('size budget: stylesheet is budgeted', () => {
  assert.deepEqual(V.checkSizes({ 'css/site.css': 1000 }), []);
  assert.ok(V.checkSizes({ 'css/site.css': 10 ** 6 }).some(e => /css\/site\.css/.test(e)));
});

// ---- v1.4: no third parties, self-hosted fonts ----

test('index: third-party hosts in style-src or font-src are rejected; self-only passes', () => {
  const fonts = GOOD_HTML.replace("script-src 'self'", "script-src 'self'; style-src 'self'; font-src 'self'");
  assert.deepEqual(V.validateIndex(fonts, () => true), []);
  const g1 = GOOD_HTML.replace("script-src 'self'", "script-src 'self'; style-src 'self' https://fonts.googleapis.com");
  assert.ok(V.validateIndex(g1, () => true).some(e => /style-src.*third-party|third-party.*style-src/i.test(e)));
  const g2 = GOOD_HTML.replace("script-src 'self'", "script-src 'self'; font-src https://fonts.gstatic.com");
  assert.ok(V.validateIndex(g2, () => true).some(e => /font-src/.test(e)));
});

test('index: external stylesheet, font or script links are rejected', () => {
  const ext = GOOD_HTML.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"></head>');
  assert.ok(V.validateIndex(ext, () => true).some(e => /external/i.test(e)));
  const ext2 = GOOD_HTML.replace('<body>', '<body><script src="https://cdn.example.com/x.js"></script>');
  assert.ok(V.validateIndex(ext2, () => true).some(e => /external/i.test(e)));
  const protoRel = GOOD_HTML.replace('<body>', '<body><script src="//cdn.example.com/x.js"></script>');
  assert.ok(V.validateIndex(protoRel, () => true).some(e => /external/i.test(e)));
});

test('css: external urls and imports are rejected; relative urls must exist', () => {
  const ok = "@font-face{font-family:X;src:url(../fonts/x.woff2) format('woff2')}";
  assert.deepEqual(V.checkCss({ 'css/site.css': ok }, p => p === 'fonts/x.woff2'), []);
  assert.ok(V.checkCss({ 'css/site.css': ok }, () => false).some(e => /fonts\/x\.woff2/.test(e)));
  assert.ok(V.checkCss({ 'css/site.css': "a{background:url(https://evil.example/x.png)}" }, () => true).some(e => /external/i.test(e)));
  assert.ok(V.checkCss({ 'css/site.css': "@import url('https://fonts.googleapis.com/css');" }, () => true).some(e => /external|import/i.test(e)));
  assert.deepEqual(V.checkCss({ 'css/site.css': "a{background:url(data:image/svg+xml;base64,AAAA)}" }, () => true), []);
});

test('fonts: each font needs a licence file and stays within budget', () => {
  const sizes = { 'fonts/inter-latin.woff2': 48000, 'fonts/jetbrains-mono-latin.woff2': 31000 };
  assert.deepEqual(V.checkFonts(sizes, ['fonts/LICENSE-Inter.txt', 'fonts/LICENSE-JetBrainsMono.txt']), []);
  assert.ok(V.checkFonts(sizes, ['fonts/LICENSE-Inter.txt']).some(e => /jetbrains-mono-latin\.woff2.*licen[cs]e/i.test(e)));
  assert.ok(V.checkFonts({ 'fonts/inter-latin.woff2': 10 ** 6 }, ['fonts/LICENSE-Inter.txt']).some(e => /budget/.test(e)));
  assert.deepEqual(V.checkFonts({}, []), []);
});

test('font coverage: Inter must declare a unicode-range that includes the rupee sign (U+20B9)', () => {
  const latinOnly = "@font-face{font-family:'Inter';src:url(a.woff2);unicode-range:U+0000-00FF,U+2000-206F,U+20AC}";
  const withExt = latinOnly + "@font-face{font-family:'Inter';src:url(b.woff2);unicode-range:U+0100-02BA,U+20A0-20AB,U+20AD-20C0}";
  assert.ok(V.checkFontCoverage({ 'css/site.css': latinOnly }).some(e => /20B9/i.test(e)));
  assert.deepEqual(V.checkFontCoverage({ 'css/site.css': withExt }), []);
  assert.deepEqual(V.checkFontCoverage({ 'css/site.css': "@font-face{font-family:'Inter';src:url(a.woff2)}" }), [], 'no unicode-range means the face covers everything');
  assert.deepEqual(V.checkFontCoverage({ 'css/site.css': 'a{color:red}' }), [], 'no Inter face declared at all: nothing to check');
});

test('css sanity: the main stylesheet must still define the design tokens and both themes', () => {
  const good = ":root{--bg:#000;--text:#fff}:root[data-theme=\"light\"]{--bg:#fff;--text:#000}body{background:var(--bg)}";
  assert.deepEqual(V.checkCssSanity({ 'css/site.css': good }), []);
  assert.ok(V.checkCssSanity({ 'css/site.css': "@font-face{font-family:X}body{margin:0}" }).some(e => /design tokens/i.test(e)));
  assert.ok(V.checkCssSanity({ 'css/site.css': ":root{--bg:#000}body{}" }).some(e => /light/i.test(e)));
  assert.deepEqual(V.checkCssSanity({}), [], 'no stylesheet in the set: nothing to check');
});

test('svg assets: no script, event handlers, foreignObject or external references; bounded size', () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#000"/></svg>';
  assert.deepEqual(V.checkSvg({ 'assets/logo.svg': ok }), []);
  for (const [name, bad] of Object.entries({
    script: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    handler: '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="x()"/></svg>',
    foreign: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>',
    external: '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
    xlink: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.example/a.svg#x"/></svg>',
    js: '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
    cssurl: '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://evil.example/x)"/></svg>',
  })) assert.ok(V.checkSvg({ 'assets/x.svg': bad }).length, name);
  assert.ok(V.checkSvg({ 'assets/big.svg': ok + ' '.repeat(40 * 1024) }).some(e => /budget|size/i.test(e)));
  assert.deepEqual(V.checkSvg({}), []);
});

// ---- v1.4: published profile photo ----
function jpegBuf(w, h, extra = 0) {
  return Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]), Buffer.alloc(extra), Buffer.from([0xFF, 0xD9])]);
}

test('profile photo: a 512x512 JPEG under the budget passes', () => {
  assert.deepEqual(V.validateProfileImage(jpegBuf(512, 512, 5000)), []);
});

test('profile photo: rejects non-JPEG content (PNG, SVG, HTML), however it is named', () => {
  assert.ok(V.validateProfileImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).some(e => /JPEG/.test(e)));
  assert.ok(V.validateProfileImage(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])).some(e => /JPEG/.test(e)));
  assert.ok(V.validateProfileImage(Buffer.from('<html><script>alert(1)</script></html>')).some(e => /JPEG/.test(e)));
});

test('profile photo: rejects oversized files and oversized or tiny dimensions', () => {
  assert.ok(V.validateProfileImage(jpegBuf(512, 512, 201 * 1024)).some(e => /KB|budget|size/i.test(e)));
  assert.ok(V.validateProfileImage(jpegBuf(2000, 2000, 100)).some(e => /1024|pixels/i.test(e)));
  assert.ok(V.validateProfileImage(jpegBuf(64, 64, 100)).some(e => /128|small/i.test(e)));
});

// ---- v1.4: profile manifest ----
test('profile manifest: no photo yet, or a photo path with an ISO timestamp, is valid', () => {
  assert.deepEqual(V.validateProfileManifest({ photo: null, updated: null }, () => true).errors, []);
  assert.deepEqual(V.validateProfileManifest({ photo: 'content/profile.jpg', updated: '2026-10-20T08:00:00.000Z' }, () => true).errors, []);
});

test('profile manifest: rejects unsafe or odd photo paths and bad timestamps', () => {
  for (const photo of ['https://evil.example/x.jpg', '//evil.example/x.jpg', '../secret.jpg', 'content/../x.jpg', 'content/profile.svg', 'content/profile.jpg?x=1', '', 5]) {
    assert.ok(V.validateProfileManifest({ photo, updated: null }, () => true).errors.some(e => /photo/.test(e)), String(photo));
  }
  assert.ok(V.validateProfileManifest({ photo: 'content/profile.jpg', updated: 'yesterday' }, () => true).errors.some(e => /updated/.test(e)));
  assert.ok(V.validateProfileManifest({ photo: 'content/profile.jpg' }, () => true).errors.some(e => /updated/.test(e)));
  assert.ok(V.validateProfileManifest('nope', () => true).errors.length);
  assert.ok(V.validateProfileManifest({}, () => true).errors.length);
});

test('profile manifest: a photo that does not exist is an error; a file with no photo set only warns', () => {
  assert.ok(V.validateProfileManifest({ photo: 'content/profile.jpg', updated: '2026-10-20T08:00:00.000Z' }, () => false).errors.some(e => /does not exist/.test(e)));
  const r = V.validateProfileManifest({ photo: null, updated: null }, p => p === 'content/profile.jpg');
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
});
