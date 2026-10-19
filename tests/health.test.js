'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../scripts/health-check.js');

const reg = [{ repo: 'o/a' }, { repo: 'o/b', hidden: true }, { repo: 'o/c' }];
const cache = { products: { 'o/a': { latest_release: { tag: 'v3.2' } }, 'o/c': { latest_release: null } } };

test('findDrift: matching tags (and matching "no release") produce no drift', () => {
  assert.deepEqual(H.findDrift(reg, cache, { 'o/a': 'v3.2', 'o/c': null }), []);
});

test('findDrift: a newer GitHub release than the cache is drift', () => {
  const d = H.findDrift(reg, cache, { 'o/a': 'v3.3', 'o/c': null });
  assert.equal(d.length, 1);
  assert.match(d[0], /o\/a.*v3\.2.*v3\.3/);
});

test('findDrift: release appeared where cache has none, and release removed, both count', () => {
  assert.equal(H.findDrift(reg, cache, { 'o/a': 'v3.2', 'o/c': 'v1' }).length, 1);
  assert.equal(H.findDrift(reg, cache, { 'o/a': null, 'o/c': null }).length, 1);
});

test('findDrift: hidden products are ignored; repos with unknown GitHub state are skipped', () => {
  assert.deepEqual(H.findDrift(reg, cache, { 'o/a': 'v3.2', 'o/b': 'v9', 'o/c': null }), []);
  assert.deepEqual(H.findDrift(reg, cache, {}), []);                 // fetch failed: not drift, reported separately
});

test('findDrift: a visible product missing from the cache entirely is drift', () => {
  assert.equal(H.findDrift([{ repo: 'o/new' }], { products: {} }, { 'o/new': null }).length, 1);
});
