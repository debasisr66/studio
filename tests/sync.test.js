'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scripts/sync-products.js');

const info = (o = {}) => ({ description: 'd', stargazers_count: 3, language: 'JS', topics: ['a'], pushed_at: '2026-10-19T07:52:03Z', html_url: 'https://github.com/o/r', ...o });
const rel = (o = {}) => ({ tag_name: 'v1', name: 'One', body: 'b', published_at: '2026-10-19T07:00:00Z', html_url: 'https://github.com/o/r/releases/tag/v1', assets: [{ name: 'a.zip', browser_download_url: 'https://x/a.zip', size: 10 }], ...o });

test('shapeProduct: maps repo and release fields; null release when none', () => {
  const p = S.shapeProduct(info(), rel());
  assert.equal(p.stars, 3);
  assert.equal(p.latest_release.tag, 'v1');
  assert.deepEqual(p.latest_release.assets, [{ name: 'a.zip', download_url: 'https://x/a.zip', size: 10 }]);
  assert.equal(S.shapeProduct(info(), null).latest_release, null);
});

test('shapeProduct: pushed_at is stored as a date, not a timestamp', () => {
  assert.equal(S.shapeProduct(info(), null).pushed_at, '2026-10-19');
  assert.equal(S.shapeProduct(info({ pushed_at: null }), null).pushed_at, '');
});

test('hasChanged: a second push on the same day is NOT a change (the churn fix)', () => {
  const a = { 'o/r': S.shapeProduct(info({ pushed_at: '2026-10-19T07:52:03Z' }), rel()) };
  const b = { 'o/r': S.shapeProduct(info({ pushed_at: '2026-10-19T23:59:59Z' }), rel()) };
  assert.equal(S.hasChanged(a, b), false);
});

test('hasChanged: a push on another day, a star, or a new release IS a change', () => {
  const base = { 'o/r': S.shapeProduct(info(), rel()) };
  assert.equal(S.hasChanged(base, { 'o/r': S.shapeProduct(info({ pushed_at: '2026-10-20T01:00:00Z' }), rel()) }), true);
  assert.equal(S.hasChanged(base, { 'o/r': S.shapeProduct(info({ stargazers_count: 4 }), rel()) }), true);
  assert.equal(S.hasChanged(base, { 'o/r': S.shapeProduct(info(), rel({ tag_name: 'v2' })) }), true);
  assert.equal(S.hasChanged(base, {}), true);
});
