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

/* SPEC-TR Phase B, TR-06: freshness is the last successful sync run, never the age of cache.json */
const NOW = Date.parse('2026-10-21T12:00:00Z');
const hoursAgo = h => new Date(NOW - h * 3600e3).toISOString();
const runs = (...h) => h.map(x => ({ conclusion: 'success', updated_at: hoursAgo(x) }));

test('TC-TR-H01 last good sync 10 h ago is healthy even though cache.json is 20 days old', () => {
  assert.deepEqual(H.findSyncStale(runs(10), NOW), []);
});
test('TC-TR-H02 last good sync 49 h ago is a problem that names the time and the fix', () => {
  const p = H.findSyncStale(runs(49), NOW);
  assert.equal(p.length, 1);
  assert.match(p[0], /49 hours ago|2026-10-19T11:00/);
  assert.match(p[0], /RUNBOOK/);
});
test('TC-TR-H03 no successful run at all is a problem', () => {
  assert.equal(H.findSyncStale([], NOW).length, 1);
  assert.equal(H.findSyncStale([{ conclusion: 'failure', updated_at: hoursAgo(1) }], NOW).length, 1);
  assert.equal(H.findSyncStale(undefined, NOW).length, 1);
});
test('TC-TR-H05 the limit is one constant: 48 h passes, just over fails, and it is exported', () => {
  assert.equal(H.SYNC_MAX_AGE_HOURS, 48);
  assert.deepEqual(H.findSyncStale(runs(47.9), NOW), []);
  assert.equal(H.findSyncStale(runs(48.1), NOW).length, 1);
  assert.equal(H.findSyncStale(runs(30), NOW, 24).length, 1);
});
test('freshness uses the newest successful run, ignoring order and failures', () => {
  const mixed = [{ conclusion: 'failure', updated_at: hoursAgo(1) }, ...runs(60, 5, 90)];
  assert.deepEqual(H.findSyncStale(mixed, NOW), []);
});
