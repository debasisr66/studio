'use strict';
// SPEC-RC Phase B: RC-02 (tabs), RC-03 (deep links), RC-04 (composer section): the pure parts. Browser behaviour is in scripts/smoke.js (TC-RC-U/L/E).
const test = require('node:test');
const assert = require('node:assert/strict');
const RL = require('../js/reads-lib.js');

const a = (category, o = {}) => ({ id: Math.random(), title: 'T', url: 'https://example.com/a', category, ...o });

test('TC-RC-U01 categoryTabs: one model entry per category, in CATEGORIES order, with label, slug and whole-section counts (reads and books)', () => {
  const t = RL.categoryTabs([a('technical'), a('technical'), a('other')], [a('technical')]);
  assert.deepEqual(t, [
    { category: 'technical', label: 'Technical', slug: 'technical', count: 3 },
    { category: 'other', label: 'Others', slug: 'others', count: 1 },
  ]);
  assert.deepEqual(RL.categoryTabs(null, undefined).map(x => x.count), [0, 0]);
});
test('TC-RC-U01 an entry with a missing or unknown category counts under Others', () => {
  const t = RL.categoryTabs([{ title: 'x' }, a('memes')], []);
  assert.equal(t.find(x => x.category === 'other').count, 2);
});
test('TC-RC-U02 nextTabIndex: arrows wrap, Home and End jump, other keys are not handled', () => {
  const n = RL.nextTabIndex;
  assert.equal(n('ArrowRight', 0, 2), 1); assert.equal(n('ArrowRight', 1, 2), 0);
  assert.equal(n('ArrowLeft', 0, 2), 1); assert.equal(n('ArrowLeft', 1, 2), 0);
  assert.equal(n('Home', 1, 3), 0); assert.equal(n('End', 0, 3), 2);
  for (const k of ['Tab', 'Enter', ' ', 'ArrowDown', 'a', undefined]) assert.equal(n(k, 0, 2), -1, String(k));
  assert.equal(n('ArrowRight', 0, 0), -1);
});
test('TC-RC-U04 defaultCategory: Technical, or the first section that has entries when Technical is empty', () => {
  assert.equal(RL.defaultCategory({ technical: 3, other: 1 }), 'technical');
  assert.equal(RL.defaultCategory({ technical: 0, other: 2 }), 'other');
  assert.equal(RL.defaultCategory({ technical: 0, other: 0 }), 'technical');
  assert.equal(RL.defaultCategory({}), 'technical');
  assert.equal(RL.defaultCategory(null), 'technical');
});
test('TC-RC-L01 categoryFromHash: #reads and #reads/ give no category (the default applies); other sections are not reads hashes', () => {
  for (const h of ['#reads', '#reads/', '', '#products', '#reads/technical/x']) assert.equal(RL.categoryFromHash(h), '', h);
  assert.equal(RL.isReadsHash('#reads'), true); assert.equal(RL.isReadsHash('#reads/others'), true);
  assert.equal(RL.isReadsHash('#readsx'), false); assert.equal(RL.isReadsHash('#products'), false); assert.equal(RL.isReadsHash(undefined), false);
});
test('TC-RC-L02 #reads/technical and #reads/others pick that section; categoryHash is the inverse', () => {
  assert.equal(RL.categoryFromHash('#reads/technical'), 'technical');
  assert.equal(RL.categoryFromHash('#reads/others'), 'other');
  for (const c of RL.CATEGORIES) assert.equal(RL.categoryFromHash(RL.categoryHash(c)), c);
  assert.equal(RL.categoryHash('other'), '#reads/others');
});
test('TC-RC-L03 an unknown, prototype-named, encoded or oversized slug is ignored', () => {
  for (const h of ['#reads/xyz', '#reads/__proto__', '#reads/constructor', '#reads/toString', '#reads/%00', '#reads/%E0%A4%A', '#reads/OTHERS', '#reads/other', '#reads/' + 'x'.repeat(5000), '#reads/<img>']) assert.equal(RL.categoryFromHash(h), '', h.slice(0, 30));
  assert.equal(RL.categoryFromHash(null), ''); assert.equal(RL.categoryFromHash(42), '');
});
test('TC-RC-E01 validateEntry with requireCategory: a missing or unknown section is an inline error; a known one passes', () => {
  const base = { url: 'https://example.com/a', title: 'T' };
  for (const c of [undefined, '', null, 'memes']) {
    const r = RL.validateEntry({ ...base, category: c }, { requireCategory: true });
    assert.equal(r.ok, false, String(c)); assert.match(r.errors.category, /section/i);
  }
  assert.equal(RL.validateEntry({ ...base, category: 'other' }, { requireCategory: true }).value.category, 'other');
  assert.equal(RL.validateEntry(base).ok, true, 'without the option nothing changes (an edit keeps its own category)');
});
test('TC-RC-X01 a value added to CATEGORIES gives a third tab, a slug, a label and a working hash with no other code change', () => {
  RL.CATEGORIES.push('news');
  try {
    const t = RL.categoryTabs([a('news')], []);
    assert.deepEqual(t.map(x => x.category), ['technical', 'other', 'news']);
    assert.deepEqual(t[2], { category: 'news', label: 'News', slug: 'news', count: 1 });
    assert.equal(RL.categoryFromHash('#reads/news'), 'news');
    assert.equal(RL.nextTabIndex('ArrowRight', 1, t.length), 2);
    assert.equal(RL.defaultCategory({ technical: 0, other: 0, news: 4 }), 'news');
  } finally { RL.CATEGORIES.pop(); }
  assert.equal(RL.categoryFromHash('#reads/news'), '');
});
