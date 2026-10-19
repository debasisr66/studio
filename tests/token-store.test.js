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
