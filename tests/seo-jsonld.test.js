'use strict';
// SEO data block (JSON-LD) and <noscript> placement. One narrow exception to "no inline <script>": a single
// application/ld+json data block, which browsers never execute. Everything else inline stays a CI error.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../scripts/validate-site.js');

const person = (o = {}) => ({
  '@context': 'https://schema.org', '@type': 'Person', name: 'Debasis Ray',
  url: 'https://debasisr66.github.io/studio/',
  sameAs: ['https://github.com/debasisr66', 'https://www.linkedin.com/in/debasisray/'], ...o,
});
const block = (data, type = 'application/ld+json') => `<script type="${type}">\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n</script>`;
const page = (head = '', body = '') => `<!doctype html><html lang="en"><head><title>T</title>${head}</head><body>${body}<script src="js/app.js"></script></body></html>`;
const errs = html => V.checkJsonLd(html);

test('JL01 one valid JSON-LD data block is allowed', () => {
  assert.deepEqual(errs(page(block(person()))), []);
});

test('JL02 every other inline script is still an error (no type, JavaScript, module, a lookalike type)', () => {
  for (const s of ['<script>alert(1)</script>', '<script type="text/javascript">x()</script>', '<script type="module">x()</script>',
    '<script type="application/ld+json-x">{}</script>', '<script type="application/json">{}</script>']) {
    assert.ok(errs(page(s)).some(e => /inline <script>/.test(e)), s);
  }
});

test('JL03 more than one JSON-LD block is an error', () => {
  assert.ok(errs(page(block(person()) + block(person()))).some(e => /one JSON-LD block/.test(e)));
});

test('JL04 a block that is not valid JSON is an error', () => {
  assert.ok(errs(page(block('{ "name": "x", }'))).some(e => /not valid JSON/.test(e)));
});

test('JL05 a block over 4 KB is an error', () => {
  assert.ok(errs(page(block(person({ description: 'x'.repeat(4200) })))).some(e => /4 KB/.test(e)));
});

test('JL06 a block holding "</" or "<!--" is an error (it could close the script or hide markup)', () => {
  assert.ok(errs(page(block(person({ description: 'a </b> b' })))).some(e => /must not contain/.test(e)));
  assert.ok(errs(page(block(person({ description: 'a <!-- b' })))).some(e => /must not contain/.test(e)));
});

test('JL07 an unsafe or malformed link in url or sameAs is an error', () => {
  for (const bad of ['javascript:alert(1)', ' https://a.com/x', 'https://user:pw@a.com/x', 'data:text/html,x']) {
    assert.ok(errs(page(block(person({ url: bad })))).some(e => /url/.test(e)), bad);
    assert.ok(errs(page(block(person({ sameAs: [bad] })))).some(e => /sameAs/.test(e)), bad);
  }
});

test('JL08 a bare home page in url or sameAs is an error: it points at a site, not at a profile', () => {
  for (const bare of ['https://github.io', 'https://github.com', 'https://linkedin.com', 'https://www.linkedin.com/']) {
    assert.ok(errs(page(block(person({ sameAs: [bare] })))).some(e => /home page/.test(e)), bare);
    assert.ok(errs(page(block(person({ url: bare })))).some(e => /home page/.test(e)), bare);
  }
  // an organisation's own address may be its home page
  assert.deepEqual(errs(page(block(person({ worksFor: { '@type': 'Organization', name: 'Cybage Software', url: 'https://cybage.com' } })))), []);
});

test('JL09 <noscript> outside <body> is an error; inside <body> it is fine', () => {
  const ns = '<noscript><p>x</p></noscript>';
  const outside = `<!doctype html><html lang="en"><head><title>T</title></head>${ns}<body><script src="js/app.js"></script></body></html>`;
  assert.ok(V.validateIndex(outside, () => true).some(e => /noscript/.test(e)));
  assert.ok(!V.validateIndex(page('', ns), () => true).some(e => /noscript/.test(e)));
});

test('JL10 a placeholder meta tag (an attribute written as "...") is an error', () => {
  assert.ok(V.validateIndex(page('<meta name="google-site-verification" ...>'), () => true).some(e => /placeholder/.test(e)));
});

test('JL11 the real index.html passes: one JSON-LD block with real profile links, <noscript> inside <body>', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.deepEqual(errs(html), []);
  assert.ok(!V.validateIndex(html, () => true).some(e => /noscript|placeholder|inline <script>|JSON-LD/.test(e)));
});

/* Independent review (docs/reviews/SE-JSONLD.md): findings F1-F5, each case taken from the reviewer's report */
test('JL12 (F1) an inline script is not mistaken for an external one by "src=" text inside another attribute', () => {
  for (const s of ['<script data-src="x">alert(1)</script>', '<script title="src=x">alert(1)</script>', "<script data-x='a src=b'>alert(1)</script>"]) {
    assert.ok(errs(page(s)).some(e => /inline <script>/.test(e)), s);
  }
  assert.deepEqual(errs(page('<script src="js/x.js"></script>')), []);
});

test('JL13 (F2, F3) the type comes from the real type attribute; the JSON-LD tag may carry no other attribute', () => {
  for (const s of ['<script data-x="type=application/ld+json" type="module">{}</script>',
    '<script type="application/ld+json" onload="x()">{}</script>', '<script type="application/ld+json" data-a="1">{}</script>',
    '<script/type="module">{}</script>', '<script type="module" type="application/ld+json">{}</script>']) {
    assert.ok(errs(page(s)).some(e => /inline <script>/.test(e)), s);
  }
  assert.deepEqual(errs(page('<script/type="application/ld+json">' + JSON.stringify(person()) + '</script>')), []);
  assert.deepEqual(errs(page("<script type='application/ld+json'>" + JSON.stringify(person()) + '</script>')), []);
});

test('JL14 (F4) a "..." placeholder anywhere in a tag, or as a whole value, is an error', () => {
  for (const t of ['<meta ... name="x">', '<meta name="x" content="...">', "<meta name='x' content='...'>", '<a href=... >x</a>']) {
    assert.ok(V.validateIndex(page(t), () => true).some(e => /placeholder/.test(e)), t);
  }
  assert.ok(!V.validateIndex(page('<p>Loading...</p>'), () => true).some(e => /placeholder/.test(e)));
});

test('JL15 (F5) a "<body" inside a comment or a JSON-LD string does not hide a <noscript> placed before the body', () => {
  const ns = '<noscript><p>x</p></noscript>';
  const viaComment = `<!doctype html><html lang="en"><head><title>T</title><!-- <body> --></head>${ns}<body><script src="js/app.js"></script></body></html>`;
  const viaJson = `<!doctype html><html lang="en"><head><title>T</title>${block(person({ description: '<body class=x>' }))}</head>${ns}<body><script src="js/app.js"></script></body></html>`;
  assert.ok(V.validateIndex(viaComment, () => true).some(e => /noscript/.test(e)));
  assert.ok(V.validateIndex(viaJson, () => true).some(e => /noscript/.test(e)));
});


test('JL16 (F5b) a "<body" inside an attribute value does not hide a <noscript> placed before the body', () => {
  const html = '<!doctype html><html lang="en"><head><title>T</title><meta name="x" content="<body >"><noscript>x</noscript></head><body><script src="js/app.js"></script></body></html>';
  assert.ok(V.validateIndex(html, () => true).some(e => /noscript/.test(e)));
});
