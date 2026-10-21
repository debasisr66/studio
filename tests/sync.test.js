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

/* SPEC-TR Phase B, TR-05 (test IDs match docs/specs/product-trust-reliability/test.md) */
const okFetch = tags => async repo => S.shapeProduct(info(), tags[repo] === null ? null : rel({ tag_name: tags[repo] || 'v1' }));
const failing = (bad, kind) => fn => async repo => {
  if (bad.includes(repo)) { const e = new Error(kind === 'rate' ? 'rate-limit guard tripped' : 'repo not found or not public'); if (kind === 'rate') e.rateLimited = true; throw e; }
  return fn(repo);
};
const reg2 = [{ repo: 'o/a' }, { repo: 'o/b' }, { repo: 'o/hidden', hidden: true }];

test('TC-TR-S01 a failed product keeps its prior entry and is reported with repo and reason', async () => {
  const prev = { 'o/b': S.shapeProduct(info({ stargazers_count: 99 }), rel({ tag_name: 'old' })) };
  const r = await S.collect(reg2, prev, failing(['o/b'])(okFetch({})));
  assert.deepEqual(r.next['o/b'], prev['o/b']);
  assert.ok(r.next['o/a']);
  assert.equal(r.failures.length, 1);
  assert.deepEqual([r.failures[0].repo, r.failures[0].kind, /not found/.test(r.failures[0].reason)], ['o/b', 'error', true]);
  assert.equal('o/hidden' in r.next, false);
});

test('TC-TR-S01 a failed product with no prior entry is omitted but still reported', async () => {
  const r = await S.collect(reg2, {}, failing(['o/b'])(okFetch({})));
  assert.equal('o/b' in r.next, false);
  assert.equal(r.failures.length, 1);
});

test('TC-TR-S02 partial failure: good products still change the cache, and the verdict is red', async () => {
  const prev = { 'o/a': S.shapeProduct(info(), rel({ tag_name: 'v1' })), 'o/b': S.shapeProduct(info(), rel({ tag_name: 'v1' })) };
  const r = await S.collect(reg2, prev, failing(['o/b'])(okFetch({ 'o/a': 'v2' })));
  assert.equal(S.hasChanged(prev, r.next), true);
  assert.equal(S.verdict(r), 'partial');
});

test('TC-TR-S03 rate-limit trips are reported as such, with prior entries kept', async () => {
  const prev = { 'o/b': S.shapeProduct(info(), rel({ tag_name: 'v1' })) };
  const r = await S.collect(reg2, prev, failing(['o/b'], 'rate')(okFetch({})));
  assert.equal(r.failures[0].kind, 'rate-limit');
  assert.deepEqual(r.next['o/b'], prev['o/b']);
  assert.match(S.summaryMarkdown(r), /rate limit/i);
});

test('TC-TR-S04 all products fail: cache content identical to before, verdict is failed', async () => {
  const prev = { 'o/a': S.shapeProduct(info(), rel()), 'o/b': S.shapeProduct(info(), rel()) };
  const r = await S.collect(reg2, prev, failing(['o/a', 'o/b'])(okFetch({})));
  assert.equal(S.hasChanged(prev, r.next), false);
  assert.equal(S.verdict(r), 'failed');
});

test('TC-TR-S05 nothing changed, nothing failed: verdict ok and no failure section', async () => {
  const prev = { 'o/a': S.shapeProduct(info(), rel()), 'o/b': S.shapeProduct(info(), rel()) };
  const r = await S.collect(reg2, prev, okFetch({}));
  assert.equal(S.hasChanged(prev, r.next), false);
  assert.equal(S.verdict(r), 'ok');
  assert.equal(S.summaryMarkdown(r), '');
});

test('summary names every failed repo and reason, and never echoes a token', async () => {
  const r = await S.collect(reg2, {}, failing(['o/a', 'o/b'])(okFetch({})));
  const md = S.summaryMarkdown(r);
  assert.match(md, /o\/a/); assert.match(md, /o\/b/); assert.match(md, /RUNBOOK/);
});
