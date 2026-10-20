'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../scripts/keepalive.js');

const DAY = 86400, NOW = 1_800_000_000;

test('recent activity: no heartbeat', () => {
  const r = K.needsHeartbeat({ lastCommitEpoch: NOW - 2 * DAY, nowEpoch: NOW });
  assert.equal(r.needed, false);
  assert.equal(r.ageDays, 2);
});

test('exactly at the threshold and beyond: heartbeat; just under: none', () => {
  assert.equal(K.needsHeartbeat({ lastCommitEpoch: NOW - 30 * DAY, nowEpoch: NOW }).needed, true);
  assert.equal(K.needsHeartbeat({ lastCommitEpoch: NOW - 59 * DAY, nowEpoch: NOW }).needed, true);
  assert.equal(K.needsHeartbeat({ lastCommitEpoch: NOW - (30 * DAY - 1), nowEpoch: NOW }).needed, false);
});

test('the threshold is configurable', () => {
  assert.equal(K.needsHeartbeat({ lastCommitEpoch: NOW - 10 * DAY, nowEpoch: NOW, thresholdDays: 7 }).needed, true);
  assert.equal(K.needsHeartbeat({ lastCommitEpoch: NOW - 10 * DAY, nowEpoch: NOW, thresholdDays: 45 }).needed, false);
});

test('force always makes a heartbeat, even when activity is recent', () => {
  const r = K.needsHeartbeat({ lastCommitEpoch: NOW - 60, nowEpoch: NOW, force: true });
  assert.equal(r.needed, true);
  assert.match(r.reason, /forced/i);
});

test('an unreadable last-commit date is treated as needing a heartbeat (harmless, and safe)', () => {
  for (const bad of [NaN, null, undefined, 'x', Infinity]) {
    const r = K.needsHeartbeat({ lastCommitEpoch: bad, nowEpoch: NOW });
    assert.equal(r.needed, true, String(bad));
    assert.match(r.reason, /unknown|unreadable|could not/i);
  }
});

test('a last commit dated in the future (clock skew) never triggers a heartbeat', () => {
  const r = K.needsHeartbeat({ lastCommitEpoch: NOW + 3 * DAY, nowEpoch: NOW });
  assert.equal(r.needed, false);
});

test('the heartbeat commit message names the reason and is stable text', () => {
  const m = K.heartbeatMessage({ ageDays: 41.2, reason: 'quiet' });
  assert.match(m, /^chore: keep scheduled workflows active/);
  assert.match(m, /41/);
  assert.ok(m.length < 120);
});

test('the default threshold is 30 days, half of GitHub\'s 60-day limit', () => {
  assert.equal(K.DEFAULT_THRESHOLD_DAYS, 30);
});
