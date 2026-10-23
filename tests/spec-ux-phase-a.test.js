'use strict';
// SPEC-UX Phase A (UX-01 … UX-04): the structural parts of the simple layout. Browser behaviour is in scripts/smoke.js (TC-UX-*).
// Test IDs match docs/specs/simple-layout/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html'), app = read('js/app.js'), css = read('css/site.css');
const ORDER = ['products', 'updates', 'reads', 'podcasts'];
const navOf = id => { const m = html.match(new RegExp('<nav[^>]*id="' + id + '"[\\s\\S]*?</nav>')); assert.ok(m, id + ' exists'); return m[0]; };
const linksOf = nav => [...nav.matchAll(/<a href="(#[a-z]+)">([\s\S]*?)<\/a>/g)].map(m => [m[1], m[2].replace(/<b[^>]*>.*?<\/b>/, '').trim()]);
const sectionHtml = id => { const m = html.match(new RegExp('<section class="block" id="' + id + '"[\\s\\S]*?</section>')); assert.ok(m, id + ' section'); return m[0]; };

test('TC-UX-S01 the page order is hero, Products, Updates, Reads, Podcasts', () => {
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const found = [...main.matchAll(/<section class="(hero|block)"(?: id="([a-z]+)")?/g)].map(m => m[1] === 'hero' ? 'hero' : m[2]);
  assert.deepEqual(found, ['hero', ...ORDER]);
});

test('TC-UX-N01 the header and the bottom nav list the same four links with the same labels', () => {
  const head = linksOf(navOf('navlinks')), bottom = linksOf(navOf('navbottom'));
  assert.deepEqual(head, [['#products', 'Products'], ['#updates', 'Updates'], ['#reads', 'Reads'], ['#podcasts', 'Podcasts']]);
  assert.deepEqual(bottom, head);
});

test('TC-UX-N02 both navs are built from one ordered list in app.js, which matches the page order (UX-03, UX-07)', () => {
  const m = app.match(/const SECTIONS = (\[[\s\S]*?\]);\s*\n/);
  assert.ok(m, 'app.js has one SECTIONS list');
  const list = (0, eval)('(' + m[1] + ')');
  assert.deepEqual(list.map(s => s[0]), ORDER);
  assert.deepEqual(list.map(s => s[1]), ['Products', 'Updates', 'Reads', 'Podcasts']);
  assert.ok(/#navlinks/.test(app) && /#navbottom/.test(app), 'both navs are filled from it');
  assert.equal((app.match(/const SECTIONS\b/g) || []).length, 1);
});

test('TC-UX-P01 every section has the same head: a heading and one description line', () => {
  for (const id of ORDER) {
    const s = sectionHtml(id);
    assert.ok(new RegExp('<div class="sec-head"><h2 id="h-' + id + '">[A-Z][a-z]+</h2><p class="sec-desc">[^<]{8,}').test(s), id + ' head');
    assert.ok(/aria-labelledby="h-/.test(s), id + ' is labelled by its heading');
    assert.ok(!/class="sub"/.test(s), id + ' has no second, differently styled sub-line');
  }
});

test('TC-UX-P01 every section has a friendly empty state in code', () => {
  for (const t of ['No products to show yet', 'No releases published yet', 'Nothing here yet', 'No podcasts yet']) assert.ok(app.includes(t), t);
});

test('TC-UX-P02 the owner add actions are hidden until unlocked, and Products and Updates have none', () => {
  assert.equal((sectionHtml('products').match(/composer-open|addbtn/g) || []).length, 0);
  assert.equal((sectionHtml('updates').match(/composer-open|addbtn/g) || []).length, 0);
  assert.equal((sectionHtml('podcasts').match(/class="composer-open"/g) || []).length, 1);
  assert.equal((sectionHtml('reads').match(/class="composer-open"/g) || []).length, 1);
  assert.ok(/\.composer\{display:none/.test(css) && /\.addbtn\{[^}]*display:none/.test(css), 'hidden by default');
  assert.ok(/body\.admin \.composer/.test(css) && /body\.admin \.addbtn/.test(css), 'shown only in admin mode');
});

test('TC-UX-P03 phone targets: the bottom nav items and the theme button are at least 44 px (the header links are hidden on a phone)', () => {
  assert.ok(/nav\.bottom a\{[^}]*min-height:44px/.test(css), 'bottom nav item');
  assert.ok(/\.icon-btn\{width:44px;height:44px\}/.test(css));
});

test('TC-UX-P04 the two-column Reading list / Books layout is gone: one column, Books under the reads', () => {
  const s = sectionHtml('reads');
  assert.ok(!/class="two\b/.test(s) && !/class="two\b/.test(html), 'no two-column wrapper');
  assert.ok(!/\.two\b/.test(css), 'no .two rule');
  assert.ok(s.indexOf('id="articlesFeed"') > 0 && s.indexOf('id="booksFeed"') > s.indexOf('id="articlesFeed"'), 'Books come after the reads');
  assert.ok(/id="readsPanel"[^>]*role="tabpanel"/.test(s) || /role="tabpanel"[^>]*id="readsPanel"/.test(s), 'the tab panel is kept');
  assert.ok(s.indexOf('id="readsPanel"') < s.indexOf('id="booksFeed"'), 'Books are inside the panel');
});

test('TC-UX-L04 a fragment is never written into the page: no line of app.js mixes location.hash with innerHTML or insertAdjacentHTML', () => {
  for (const line of app.split('\n')) if (/location\.hash/.test(line)) assert.ok(!/innerHTML|insertAdjacentHTML|document\.write|eval\(/.test(line), line.slice(0, 120));
});

test('TC-UX-L04 section links are matched against the closed list, not built from the fragment', () => {
  assert.ok(!/querySelector\([^)]*location\.hash/.test(app) && !/getElementById\([^)]*location\.hash/.test(app), 'the fragment is never used as a selector');
});

test('TC-UX-N02 the static nav links in index.html are kept as the no-script fallback and say so', () => {
  assert.ok(/no-script fallback|fallback for a page where scripts fail/.test(html), 'index.html comments that app.js replaces the navs from SECTIONS');
});

test('TC-UX-N05 the skip link, logo, theme toggle and What\'s new button are unchanged', () => {
  assert.ok(html.includes('<a class="skip" href="#main">Skip to content</a>'));
  assert.ok(html.includes('id="theme"') && html.includes('id="whatsNewBtn"') && /class="brand" href="#top"/.test(html));
});

test('UX privacy: no new storage key, cookie or network host (the invariant of docs/security.md §11)', () => {
  const keys = new Set([...(app + read('js/token-store.js')).matchAll(/'(studio-[a-z-]+)'/g)].map(m => m[1]));
  assert.deepEqual([...keys].sort(), ['studio-admin-pat', 'studio-quick-draft', 'studio-seen-version', 'studio-theme']);
  assert.ok(!/document\.cookie/.test(app));
  assert.ok(html.includes("connect-src 'self' https://api.github.com;"), 'CSP connect-src unchanged');
  assert.ok(!/IntersectionObserver[\s\S]{0,400}(fetch|localStorage|sessionStorage)/.test(app), 'the section-in-view observer records nothing');
});

test('TC-UX-F02 the footer says what each date is: the release date of the version, and when the product data last changed', () => {
  assert.ok(!/Synced from GitHub/.test(html), 'the old, misleading label is gone');
  assert.ok(/Product data updated · <span id="synced">/.test(html));
  assert.ok(/'Studio v' \+ r\.version \+ ' · ' \+ fmtDate\(r\.date\)/.test(app) || /versionBtn'\)\.textContent = 'Studio v' \+ r\.version \+ ' · '/.test(app), 'the version button carries the release date');
});
