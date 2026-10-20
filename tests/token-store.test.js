'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/token-store.js');

const memStorage = () => { const m = new Map(); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } }; };

test('usable storage: token goes into that storage only and reads back', () => {
  const s = memStorage(), other = memStorage();
  const t = T.create(() => s, 'k');
  assert.equal(t.get(), null);
  t.set('tok');
  assert.equal(s.getItem('k'), 'tok');
  assert.equal(t.get(), 'tok');
  assert.equal(other.m.size, 0);
  assert.equal(s.m.has('__probe'), false, 'the capability probe must clean up after itself');
});

test('del: removes the token from storage and memory', () => {
  const s = memStorage();
  const t = T.create(() => s, 'k');
  t.set('tok'); t.del();
  assert.equal(s.getItem('k'), null);
  assert.equal(t.get(), null);
});

test('blocked storage (getter throws): falls back to memory, works within the page, nothing persisted', () => {
  const t = T.create(() => { throw new Error('SecurityError'); }, 'k');
  assert.equal(t.get(), null);
  t.set('tok');
  assert.equal(t.get(), 'tok');
  t.del();
  assert.equal(t.get(), null);
});

test('storage that fails on write (quota or private mode): token kept in memory instead', () => {
  const s = memStorage(); const real = s.setItem;
  s.setItem = (k, v) => { if (k === '__probe') return real(k, v); throw new Error('QuotaExceededError'); };
  const t = T.create(() => s, 'k');
  t.set('tok');
  assert.equal(t.get(), 'tok');
  assert.equal(s.m.has('k'), false);
});

test('a new store over the same session storage sees the token (same-tab reload)', () => {
  const s = memStorage();
  T.create(() => s, 'k').set('tok');
  assert.equal(T.create(() => s, 'k').get(), 'tok');
});

test('a new store over a different (fresh) storage does not (new tab)', () => {
  T.create(() => memStorage(), 'k').set('tok');
  assert.equal(T.create(() => memStorage(), 'k').get(), null);
});

test('purge: removes a legacy token and reports it; reports false when none; survives blocked storage', () => {
  const s = memStorage(); s.setItem('k', 'old');
  assert.equal(T.purge(() => s, 'k'), true);
  assert.equal(s.getItem('k'), null);
  assert.equal(T.purge(() => s, 'k'), false);
  assert.equal(T.purge(() => { throw new Error('blocked'); }, 'k'), false);
});

test('purge never touches other keys', () => {
  const s = memStorage(); s.setItem('k', 'old'); s.setItem('studio-theme', 'dark'); s.setItem('studio-seen-version', '1.2');
  T.purge(() => s, 'k');
  assert.equal(s.getItem('studio-theme'), 'dark');
  assert.equal(s.getItem('studio-seen-version'), '1.2');
});

// ---- idle lock (v1.4): previously the only untested part of the admin session code ----

function fakeTimers() {
  let now = 0, id = 0; const pending = new Map();
  return {
    set: (fn, ms) => { id += 1; pending.set(id, { fn, at: now + ms }); return id; },
    clear: h => { pending.delete(h); },
    advance(ms) { now += ms; for (const [h, t] of [...pending]) if (t.at <= now) { pending.delete(h); t.fn(); } },
    count: () => pending.size,
  };
}

test('idle lock: fires once after the idle time, then is no longer armed', () => {
  const tm = fakeTimers(); let fired = 0;
  const lock = T.createIdleLock(1000, () => { fired += 1; }, tm);
  assert.equal(lock.isArmed(), false);
  lock.arm(); assert.equal(lock.isArmed(), true);
  tm.advance(999); assert.equal(fired, 0);
  tm.advance(1); assert.equal(fired, 1);
  assert.equal(lock.isArmed(), false);
  tm.advance(10_000); assert.equal(fired, 1);
});

test('idle lock: activity (arming again) restarts the countdown, and never leaves two timers', () => {
  const tm = fakeTimers(); let fired = 0;
  const lock = T.createIdleLock(1000, () => { fired += 1; }, tm);
  lock.arm(); tm.advance(900);
  lock.arm(); tm.advance(900);          // 1800 ms since start but only 900 since last activity
  assert.equal(fired, 0);
  assert.equal(tm.count(), 1);
  tm.advance(100); assert.equal(fired, 1);
});

test('idle lock: disarm cancels, and is safe to call when not armed', () => {
  const tm = fakeTimers(); let fired = 0;
  const lock = T.createIdleLock(1000, () => { fired += 1; }, tm);
  lock.disarm();
  lock.arm(); lock.disarm();
  tm.advance(5000);
  assert.equal(fired, 0);
  assert.equal(lock.isArmed(), false);
});

test('idle lock: works with the real timers by default', () => {
  const lock = T.createIdleLock(60_000, () => {});
  lock.arm(); assert.equal(lock.isArmed(), true);
  lock.disarm(); assert.equal(lock.isArmed(), false);
});
