'use strict';
// SPEC-UX Phase B (UX-05, UX-06): the structural parts. Measured behaviour (contrast, focus, targets, reflow, first screen) is in scripts/smoke.js (TC-UX-A*, P03, F01).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const css = read('css/site.css'), app = read('js/app.js'), html = read('index.html');

test('TC-UX-A04 prefers-reduced-motion switches off smooth scrolling, animation and transitions, and no script asks for smooth scrolling', () => {
  const m = css.match(/@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/);
  assert.ok(m, 'a reduced-motion block exists');
  assert.ok(/scroll-behavior:auto/.test(m[1]) && /animation:none!important/.test(m[1]) && /transition:none!important/.test(m[1]));
  assert.ok(!/behavior:\s*['"]smooth/.test(app) && !/scrollTo\([^)]*smooth/.test(app), 'no scripted smooth scroll');
});
test('TC-UX-A01 the page declares its language and viewport, keeps a skip link, and does not block zoom', () => {
  assert.ok(/<html lang="en"/.test(html));
  assert.ok(/<meta name="viewport" content="width=device-width, initial-scale=1">/.test(html), 'no user-scalable=no or maximum-scale');
  assert.ok(!/user-scalable|maximum-scale/.test(html));
  assert.ok(/<a class="skip" href="#main">/.test(html) && /<main id="main"/.test(html));
});
test('TC-UX-A01 focus is never removed without a replacement: no "outline:none" or "outline:0" except next to a visible focus style', () => {
  for (const m of css.matchAll(/[^{}]*\{[^}]*outline:\s*(none|0)[^}]*\}/g)) assert.ok(/#modalTitle/.test(m[0]) || /box-shadow|border-color/.test(m[0]) || /\.field|input|textarea|select/.test(m[0]), 'outline removed in: ' + m[0].slice(0, 80));
  assert.ok(/:focus-visible\{outline:2px solid var\(--focus\)/.test(css));
});
test('TC-UX-P03 on a phone the controls are enlarged in CSS (not only for a coarse pointer)', () => {
  const m = css.match(/@media \(max-width:620px\)\{([\s\S]*?)\n\}/g).join('\n');
  for (const sel of ['.chip', '.card .actions a', 'summary', '.share-row']) assert.ok(m.includes(sel), sel + ' has a phone rule');
});
test('TC-UX-P03 no later rule makes a phone control smaller again: a pointer:coarse block never sets a min-height under 44px on controls the phone block enlarges', () => {
  const coarse = (css.match(/@media \(pointer:coarse\)\{([\s\S]*?)\n\}/) || [])[1] || '';
  for (const m of coarse.matchAll(/([^{}]+)\{[^}]*min-height:(\d+)px/g)) if (/\.chip|\.card|summary|\.share-row|\.read-title/.test(m[1])) assert.ok(Number(m[2]) >= 44, m[1].trim() + ' is ' + m[2] + ' px under pointer:coarse');
});
test('UX Phase B privacy: no new storage key, cookie or host', () => {
  assert.ok(!/document\.cookie/.test(app));
  assert.ok(html.includes("connect-src 'self' https://api.github.com;"));
  const keys = new Set([...(app + read('js/token-store.js')).matchAll(/'(studio-[a-z-]+)'/g)].map(x => x[1]));
  assert.deepEqual([...keys].sort(), ['studio-admin-pat', 'studio-quick-draft', 'studio-seen-version', 'studio-theme']);
});
