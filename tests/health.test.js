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

// ---- v1.4: disabled workflows ----
test('findInactiveWorkflows: all active is clean', () => {
  assert.deepEqual(H.findInactiveWorkflows([{ name: 'CI', state: 'active' }, { name: 'Sync product cache', state: 'active' }]), []);
});

test('findInactiveWorkflows: names every workflow that is not active, with its state', () => {
  const p = H.findInactiveWorkflows([{ name: 'CI', state: 'active' }, { name: 'Sync product cache', state: 'disabled_inactivity' }, { name: 'Health check', state: 'disabled_manually' }]);
  assert.equal(p.length, 2);
  assert.match(p[0], /Sync product cache.*disabled_inactivity/);
  assert.match(p[1], /Health check.*disabled_manually/);
});

test('findInactiveWorkflows: tolerates missing or odd input', () => {
  assert.deepEqual(H.findInactiveWorkflows(undefined), []);
  assert.deepEqual(H.findInactiveWorkflows([]), []);
  assert.deepEqual(H.findInactiveWorkflows([null, {}, { name: 'X' }]), []);
});
