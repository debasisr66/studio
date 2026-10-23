'use strict';
// SPEC-QA Phase B (QA-09): prefill by link. The pure parser and the structural parts; browser behaviour is in scripts/smoke.js (TC-QA-F*, S01).
// Test IDs match docs/specs/quick-add/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RL = require('../js/reads-lib.js');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const app = read('js/app.js');
const enc = encodeURIComponent;
const L = 'https://example.com/a/b?id=5';

test('TC-QA-F01 parseAddHash: an encoded link gives the normalised link, no error', () => {
  const p = RL.parseAddHash('#add=' + enc(L + '&utm_source=x#frag'));
  assert.equal(p.url, L); assert.equal(p.title, ''); assert.equal(p.error, '');
});
test('TC-QA-F02 parseAddHash: &t= gives a cleaned title; a bad or long title is dropped without losing the link', () => {
  assert.equal(RL.parseAddHash('#add=' + enc(L) + '&t=' + enc('  A  good\ttitle ')).title, 'A good title');
  assert.equal(RL.parseAddHash('#add=' + enc(L) + '&t=' + enc('Bell\u0007 title')).title, 'Bell title');
  const long = RL.parseAddHash('#add=' + enc(L) + '&t=' + enc('x'.repeat(141)));
  assert.equal(long.url, L); assert.equal(long.title, ''); assert.ok(long.titleError);
  const bad = RL.parseAddHash('#add=' + enc(L) + '&t=%E0%A4%A');
  assert.equal(bad.url, L); assert.equal(bad.title, ''); assert.ok(bad.titleError);
  assert.equal(RL.parseAddHash('#add=' + enc(L) + '&t=' + enc('<img src=x onerror=alert(1)>')).title, '<img src=x onerror=alert(1)>');   // text only: the page shows it with textContent and escapes it everywhere
});
test('TC-QA-F03 parseAddHash: malformed, oversized, empty and non-http(s) values are refused with a message and no link', () => {
  for (const h of ['#add=%E0%A4%A', '#add=' + enc('x'.repeat(5000)), '#add=' + enc('https://example.com/' + 'a'.repeat(3000)), '#add=', '#add=' + enc('javascript:alert(1)'), '#add=' + enc('JaVaScRiPt:alert(1)'),
    '#add=' + enc('data:text/html,<b>x</b>'), '#add=' + enc('https://user:pw@evil.example.com/x'), '#add=' + enc('//evil.example.com/x'), '#add=' + enc('file:///etc/passwd'), '#add=' + enc('example.com/no-scheme'),
    '#add=' + enc('two words https://example.com'), '#add=' + enc('ftp://example.com/x'), '#add=' + 'a'.repeat(9000), '#add=%00', '#add=' + enc('https://')]) {
    const p = RL.parseAddHash(h); assert.ok(p, h.slice(0, 40)); assert.equal(p.url, '', h.slice(0, 50)); assert.ok(p.error, h.slice(0, 50));
  }
});
test('TC-QA-F05 parseAddHash: odd keys and repeats are ignored; the first add= wins; nothing throws; nothing pollutes', () => {
  const p = RL.parseAddHash('#add=' + enc(L) + '&__proto__=x&constructor=y&toString=z&add=' + enc('https://evil.example.com/') + '&t=T&t=U&polluted=1');
  assert.equal(p.url, L); assert.equal(p.title, 'T'); assert.equal({}.polluted, undefined); assert.equal({}.x, undefined);
  assert.deepEqual(Object.keys(p).sort(), ['error', 'title', 'titleError', 'url']);
  for (const h of ['#add=' + enc(L) + '&&&=&=&add', '#add=' + enc(L) + '&__proto__[x]=1', '#add=' + enc(L) + '&t', '#add=' + enc(L) + '&' + 'a=1&'.repeat(5000).slice(0, 7000)]) assert.doesNotThrow(() => RL.parseAddHash(h));
});
test('TC-QA-F05 parseAddHash and isAddEntry: only an address that starts with #add= is a prefill; everything else is not; never throws', () => {
  for (const x of [undefined, null, 5, {}, [], '', '#', '#add', '#adds', '#add/x', '#ADD=x', ' #add=x', '#reads', 'add=x']) assert.equal(RL.parseAddHash(x), null, String(x));
  assert.equal(RL.isAddEntry('#add'), true); assert.equal(RL.isAddEntry('#add=' + enc(L)), true); assert.equal(RL.isAddEntry('#add='), true);
  for (const x of ['#adds', '#add/x', '#ADD', '#add ', '#add?x=1', '', null, undefined, 5]) assert.equal(RL.isAddEntry(x), false, String(x));
  assert.equal(RL.isAddHash('#add=' + enc(L)), false);   // Phase A's exact-match function is unchanged
});
test('TC-QA-F03 parseAddHash stays fast on hostile input', () => {
  const t0 = Date.now();
  RL.parseAddHash('#add=' + '%'.repeat(7900)); RL.parseAddHash('#add=' + '%41'.repeat(2600)); RL.parseAddHash('#add=' + enc(L) + '&t=' + '%C3%A9'.repeat(1300)); RL.parseAddHash('#add=' + '&'.repeat(7990));
  assert.ok(Date.now() - t0 < 500, 'took ' + (Date.now() - t0) + ' ms');
});

test('TC-QA-F01 the app only prefills: the prefill code never posts, publishes or asks for a token', () => {
  const a = app.indexOf('function qaPrefill'); assert.ok(a > 0, 'no qaPrefill function');
  const body = app.slice(a, app.indexOf('\n}\n', a));
  assert.ok(!/qaPost|publishContent|publishFile|askToken|\.click\(\)|requestSubmit|submit\(/.test(body), 'qaPrefill posts, publishes or submits');
  assert.ok(/Prefilled from a link: check it/.test(app));
  assert.ok(/RL\.parseAddHash\(/.test(app) && /RL\.isAddEntry\(/.test(app));
});
test('TC-QA-F04 after reading, the fragment is removed from the address bar and the draft key carries the values', () => {
  const a = app.indexOf('function qaPrefill'), body = app.slice(a, app.indexOf('\n}\n', a));
  assert.ok(/history\.replaceState/.test(body), 'the fragment is not cleared'); assert.ok(/qaSave\(\)/.test(body), 'the values are not carried into the draft');
});
test('TC-QA-F06 OPERATIONS and the LEARNING-GUIDE document the Share Sheet Shortcut with both address forms', () => {
  for (const f of ['docs/OPERATIONS.md', 'docs/LEARNING-GUIDE.md']) {
    const d = read(f);
    for (const s of ['Share Sheet', 'Add to Studio', 'https://debasisr66.github.io/studio/#add=', 'googlechromes://debasisr66.github.io/studio/#add=', 'URL Encode', 'Open URLs']) assert.ok(d.includes(s), f + ' lacks "' + s + '"');
    assert.ok(/prefill/i.test(d), f + ' does not say it only prefills');
  }
});
