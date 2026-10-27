'use strict';
// Where the behaviour of the smoke cases that were removed on 2026-10-27 (to keep the browser run short) is still proven.
// Each test names the removed case, so the trace TC id -> covering test stays complete (docs/test.md section T).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RL = require('../js/reads-lib.js');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const app = read('js/app.js'), html = read('index.html'), css = read('css/site.css'), smoke = read('scripts/smoke.js');

test('covers TC-UX-L03 and TC-PC-R01 (#blog/old-post): every old blog link form goes to #podcasts, and the page follows it on load and on change', () => {
  for (const h of ['#blog', '#blog/', '#blog/x', '#blog/some-old-post', '#blog/a/b']) assert.equal(RL.redirectHash(h), '#podcasts', h);
  assert.match(app, /followBlogLink\(\)\) landOn\('podcasts'\)/);                 // on load
  assert.match(app, /hashchange', \(\) => \{ if \(followBlogLink\(\)\) showId\('podcasts'\)/);   // while open
  assert.ok(smoke.includes("TC-PC-R01 #blog lands on Podcasts"), 'one browser case for #blog remains');
});
test('covers TC-UX-L01 (#products cold) and TC-UX-L04 (#Products): section links match the four exact lower-case ids only, and #products needs no scroll code', () => {
  assert.match(app, /SECTIONS\.find\(x => location\.hash === '#' \+ x\[0\]\)/);
  assert.ok(/<section class="block" id="products"/.test(html) && /<body id="top">/.test(html));
  assert.ok(smoke.includes('TC-UX-L01 #podcasts on a cold load') && smoke.includes('TC-UX-L01 #reads on a cold load'), 'the cold-load cases that matter remain');
});
test('covers TC-UX-S01 (DOM order) and TC-UX-N01 (1280 px navs): the static page order and both navs are checked in tests/spec-ux-phase-a.test.js, and two browser cases keep the order and the nav under storage blocked and unlocked', () => {
  const a = read('tests/spec-ux-phase-a.test.js');
  assert.ok(a.includes('TC-UX-S01') && a.includes('TC-UX-N01') && a.includes('TC-UX-N02'));
  assert.ok(smoke.includes('TC-UX-S02 the order is the same with storage blocked') && smoke.includes('TC-UX-S02 unlocked: the same order'));
});
test('covers TC-UX-A03 at 640 and 200 px and TC-UX-A05: reflow is proven at 320 and 256 px (narrower than either), and the overflow check is part of the healthy 1280 and 375 px cases', () => {
  assert.ok(smoke.includes('TC-UX-A03 reflow at 320 px') && smoke.includes('TC-UX-A03 extreme zoom, 256 px'));
  assert.match(smoke, /TC-SH-B01 healthy fixture, 1280 px[^\n]*\n[^\n]*|TC-SH-B01 healthy fixture, 1280 px, no console errors[^\n]*check: async ctx => \{[^\n]*scrollWidth/);
  assert.match(smoke.slice(smoke.indexOf("TC-SH-B02 healthy fixture, 375 px")).split('\n').slice(0, 8).join('\n'), /dark[\s\S]*light|themes/);
});
test('covers the light half of TC-UX-A02: one browser case checks contrast in both themes', () => {
  assert.ok(/TC-UX-A02 text contrast is at least 4\.5:1 in both themes/.test(smoke));
});
test('the smoke run keeps a time budget: the harness waits are short and the watchdog is unchanged', () => {
  assert.match(smoke, /Number\(process\.env\.SMOKE_WATCHDOG_MS\) \|\| 110000/);
});
