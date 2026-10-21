'use strict';
// SPEC-SH Phase A: SH-01 (section isolation) and SH-08 (bounded waits). Test IDs match docs/specs/stabilize-core-hub/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/safe-lib.js');

test('TC-SH-I01 runGuarded runs every step even when earlier ones throw, and names the failures', () => {
  const ran = [];
  const failed = S.runGuarded([
    { name: 'a', run: () => ran.push('a') },
    { name: 'b', run: () => { ran.push('b'); throw new TypeError('boom'); } },
    { name: 'c', run: () => ran.push('c') },
    { name: 'd', run: () => { throw new Error('again'); } },
    { name: 'e', run: () => ran.push('e') },
  ], () => {});
  assert.deepEqual(ran, ['a', 'b', 'c', 'e']);
  assert.deepEqual(failed, ['b', 'd']);
});

test('TC-SH-I01 onFail receives the step name and the error', () => {
  const seen = [];
  S.runGuarded([{ name: 'x', run: () => { throw new RangeError('r'); } }], (name, err) => seen.push([name, err.name]));
  assert.deepEqual(seen, [['x', 'RangeError']]);
});

test('TC-SH-I01 runGuarded never throws, even if the failure handler throws', () => {
  assert.doesNotThrow(() => S.runGuarded([{ name: 'x', run: () => { throw new Error('a'); } }, { name: 'y', run: () => {} }], () => { throw new Error('handler'); }));
  const ran = [];
  S.runGuarded([{ name: 'x', run: () => { throw new Error('a'); } }, { name: 'y', run: () => ran.push('y') }], () => { throw new Error('handler'); });
  assert.deepEqual(ran, ['y']);
});

test('TC-SH-I01 runGuarded tolerates a missing handler and an empty list', () => {
  assert.deepEqual(S.runGuarded([], null), []);
  assert.deepEqual(S.runGuarded([{ name: 'x', run: () => { throw new Error('a'); } }]), ['x']);
});

test('TC-SH-I03 the fallback markup is a constant: no error text can reach the page', () => {
  const evil = new Error('<img src=x onerror=alert(1)> TypeError: secret');
  const html = S.fallbackHtml(evil);
  assert.equal(html, S.fallbackHtml());
  assert.ok(html.includes(S.FALLBACK_TEXT));
  assert.ok(!/onerror|TypeError|secret|<img/.test(html));
  assert.equal(S.FALLBACK_TEXT, 'This section could not load. The rest of the page is unaffected.');
});

test('TC-SH-T02 fetchJson returns the parsed body when the answer is in time', async () => {
  const f = async () => ({ ok: true, status: 200, json: async () => ({ a: 1 }) });
  assert.deepEqual(await S.fetchJson(f, 'content/x.json', { timeoutMs: 200 }), { a: 1 });
});

test('TC-SH-I04 fetchJson throws for a non-OK status and names the path', async () => {
  const f = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(S.fetchJson(f, 'content/x.json', { timeoutMs: 200 }), /content\/x\.json 404/);
});

test('TC-SH-I04 fetchJson rejects when the body is not JSON', async () => {
  const f = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } });
  await assert.rejects(S.fetchJson(f, 'content/x.json', { timeoutMs: 200 }), SyntaxError);
});

test('TC-SH-T01 fetchJson gives up after the timeout and aborts the request', async () => {
  let aborted = false;
  const f = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }));
  const t0 = Date.now();
  await assert.rejects(S.fetchJson(f, 'content/slow.json', { timeoutMs: 60 }), /timed out after 60 ms/);
  assert.ok(aborted);
  assert.ok(Date.now() - t0 < 1000);
});

test('TC-SH-T02 a slow answer inside the limit still succeeds, and the timer is cleared', async () => {
  const f = (url, init) => new Promise(res => setTimeout(() => res({ ok: true, status: 200, json: async () => 'late' }), 40));
  assert.equal(await S.fetchJson(f, 'content/x.json', { timeoutMs: 500 }), 'late');
});

test('TC-SH-T01 the default limit is 8 seconds', () => {
  assert.equal(S.FETCH_TIMEOUT_MS, 8000);
});
