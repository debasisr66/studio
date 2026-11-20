'use strict';
// SPEC-SE search visibility: sitemap.xml and its CI check. Test IDs match docs/specs/search-visibility/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../scripts/validate-site.js');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://debasisr66.github.io/studio/';
const map = (locs = [SITE], head = '<?xml version="1.0" encoding="UTF-8"?>\n', ns = 'http://www.sitemaps.org/schemas/sitemap/0.9') =>
  `${head}<urlset xmlns="${ns}">\n${locs.map(l => `  <url><loc>${l}</loc></url>`).join('\n')}\n</urlset>\n`;
const page = (url = SITE) => `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'Person', url })}</script></head><body></body></html>`;
const errs = (xml, html = page()) => V.checkSitemap(xml, html);

test('TC-SE-M01 a valid one-URL sitemap that lists the JSON-LD url passes', () => {
  assert.deepEqual(errs(map()), []);
});

test('TC-SE-M02 a missing sitemap is an error', () => {
  assert.ok(errs(null).some(e => /sitemap\.xml: missing/.test(e)));
});

test('TC-SE-M03 no XML declaration, no urlset, or the wrong namespace is an error', () => {
  for (const xml of [map([SITE], ''), `<?xml version="1.0" encoding="UTF-8"?>\n<url><loc>${SITE}</loc></url>`,
    map([SITE], undefined, 'http://example.com/ns'), map().replace('</urlset>', '')]) {
    assert.ok(errs(xml).length > 0, xml);
  }
});

test('TC-SE-M04 a sitemap with no <loc> is an error', () => {
  assert.ok(errs(map([])).some(e => /no <loc>/.test(e)));
});

test('TC-SE-M05 a <loc> outside the site, not https, or with # ? & or a space is an error naming it', () => {
  for (const bad of ['http://debasisr66.github.io/studio/', 'https://example.com/studio/', 'https://debasisr66.github.io/other/',
    SITE + '#reads', SITE + '?x=1', SITE + 'a&b', SITE + 'a b', 'javascript:alert(1)']) {
    const e = errs(map([SITE, bad]));
    assert.ok(e.some(m => m.includes(bad)), bad);
  }
});

test('TC-SE-M06 the same <loc> twice is an error', () => {
  assert.ok(errs(map([SITE, SITE])).some(e => /duplicate/.test(e)));
});

test('TC-SE-M07 <!DOCTYPE or <!ENTITY is an error', () => {
  assert.ok(errs(map().replace('<urlset', '<!DOCTYPE x [<!ENTITY a "b">]>\n<urlset')).some(e => /DOCTYPE|ENTITY/.test(e)));
  assert.ok(errs(map().replace('<urlset', '<!ENTITY a "b">\n<urlset')).some(e => /DOCTYPE|ENTITY/.test(e)));
});

test('TC-SE-M08 the JSON-LD url must be listed', () => {
  const other = SITE + 'about/';
  assert.ok(errs(map([SITE]), page(other)).some(e => e.includes(other) && /JSON-LD/.test(e)));
});

test('TC-SE-M09 the real sitemap.xml passes with the real index.html', () => {
  const file = path.join(ROOT, 'sitemap.xml');
  assert.ok(fs.existsSync(file), 'sitemap.xml exists at the repo root');
  assert.deepEqual(V.checkSitemap(fs.readFileSync(file, 'utf8'), fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), []);
});

test('TC-SE-D01 the RUNBOOK covers the sitemap and every new message', () => {
  const rb = fs.readFileSync(path.join(ROOT, 'docs/RUNBOOK.md'), 'utf8');
  for (const s of ['sitemap.xml: missing', 'sitemap.xml: not a sitemap', 'sitemap.xml: no <loc>', 'is not a page of this site',
    'duplicate <loc>', '<!DOCTYPE', 'does not list the JSON-LD url', 'Request indexing', 'site:debasisr66.github.io/studio']) {
    assert.ok(rb.includes(s), s);
  }
});
