'use strict';
// SPEC-TR Phase C: TR-03, TR-04, TR-07, TR-08 (test IDs match docs/specs/product-trust-reliability/test.md)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../scripts/validate-site.js');
const H = require('../scripts/health-check.js');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const fixture = id => JSON.parse(fs.readFileSync(path.join(FIX, id + '.json'), 'utf8'));
const RUNBOOK = fs.readFileSync(path.join(ROOT, 'docs/RUNBOOK.md'), 'utf8');
const anchors = new Set([...RUNBOOK.matchAll(/^#{1,3} (.+)$/gm)].map(m => m[1].toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-')));
const P = (o = {}) => ({ repo: 'o/a', name: 'A', tagline: 't', category: 'Tools', ...o });

/* TR-03 */
test('TC-TR-R01 duplicate slug is an error', () => {
  assert.ok(V.validateProducts([P({ slug: 'a' }), P({ repo: 'o/b', slug: 'a' })]).some(e => /duplicate slug/.test(e)));
});
test('TC-TR-R02 slug with uppercase or spaces is an error; good slugs pass', () => {
  for (const s of ['Pen ny', 'PENNY', 'a_b', '']) assert.ok(V.validateProducts([P({ slug: s })]).some(e => /slug must/.test(e)), JSON.stringify(s));
  assert.deepEqual(V.validateProducts([P({ slug: 'debasis-web-2' })]), []);
});
test('TC-TR-R03 empty category is an error', () => {
  assert.ok(V.validateProducts([P({ category: '' })]).some(e => /category must not be empty/.test(e)));
});
test('TC-TR-R04 unknown category is a warning that lists the known ones', () => {
  assert.deepEqual(V.validateProducts([P({ category: 'Wibble' })]), []);
  const w = V.productWarnings([P({ category: 'Wibble' })]);
  assert.equal(w.length, 1);
  assert.match(w[0], /unknown category "Wibble".*Productivity/);
  assert.deepEqual(V.productWarnings([P({ category: 'Productivity' })]), []);
});

/* TR-04: every enumerated rule has a failing fixture, and the baseline passes */
test('TC-TR-X01 every rule has a fixture that triggers exactly its message, at its level', () => {
  assert.ok(V.RULES.length >= 20);
  for (const rule of V.RULES) {
    const r = V.runRule(rule, fixture(rule.id));
    const list = rule.level === 'warning' ? r.warnings : r.errors;
    assert.ok(list.some(m => rule.match.test(m)), `${rule.id}: fixture did not raise ${rule.match}; got ${JSON.stringify(list)}`);
  }
});
test('TC-TR-X01 the good baseline raises no rule message', () => {
  const good = fixture('good');
  for (const rule of V.RULES) {
    const r = V.runRule(rule, { input: good[rule.fn], registry: good.registry });
    assert.deepEqual([...r.errors, ...r.warnings].filter(m => rule.match.test(m)), [], rule.id);
  }
});
test('TC-TR-X02 the guard fails when a fixture is missing', () => {
  const ids = V.RULES.map(r => r.id);
  assert.deepEqual(V.missingFixtures(V.RULES, ids), []);
  assert.deepEqual(V.missingFixtures(V.RULES, ids.slice(1)), [ids[0]]);
  const onDisk = fs.readdirSync(FIX).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  assert.deepEqual(V.missingFixtures(V.RULES, onDisk), []);
});
test('TC-TR-D02 every rule maps to a runbook anchor that exists and a phrase the runbook contains', () => {
  for (const r of V.RULES) {
    assert.ok(anchors.has(r.fix), `${r.id}: runbook has no section "${r.fix}"`);
    assert.ok(RUNBOOK.includes(r.doc), `${r.id}: runbook does not mention "${r.doc}"`);
  }
});

/* TR-07 */
const asset = (name, url) => ({ name, browser_download_url: url });
const cacheFor = (repo, tag, assets) => ({ products: { [repo]: { latest_release: tag && { tag, download_url: 'https://x/rel', assets: assets || [] } } } });
const reg = [{ repo: 'o/a', download_asset: 'App-*.zip' }];

test('TC-TR-H06 configured download_asset missing from the latest release is a parity problem naming the product', () => {
  const p = H.findAssetParity(reg, cacheFor('o/a', 'v1', [{ name: 'App-1.zip', download_url: 'https://x/App-1.zip' }]), { 'o/a': { assets: [asset('Other.tar', 'https://x/o')] } });
  assert.equal(p.length, 1);
  assert.match(p[0], /o\/a.*App-\*\.zip/);
});
test('TC-TR-H07 cached download_url differs from GitHub for the matched asset', () => {
  const p = H.findAssetParity(reg, cacheFor('o/a', 'v1', [{ name: 'App-1.zip', download_url: 'https://x/OLD.zip' }]), { 'o/a': { assets: [asset('App-1.zip', 'https://x/App-1.zip')] } });
  assert.equal(p.length, 1);
  assert.match(p[0], /differs/);
});
test('parity: matching asset, no download_asset configured, no release, or repo not fetched are all fine', () => {
  const ok = H.findAssetParity(reg, cacheFor('o/a', 'v1', [{ name: 'App-1.zip', download_url: 'https://x/App-1.zip' }]), { 'o/a': { assets: [asset('App-1.zip', 'https://x/App-1.zip')] } });
  assert.deepEqual(ok, []);
  assert.deepEqual(H.findAssetParity([{ repo: 'o/a' }], cacheFor('o/a', 'v1'), { 'o/a': { assets: [] } }), []);
  assert.deepEqual(H.findAssetParity(reg, cacheFor('o/a', null), { 'o/a': null }), []);
  assert.deepEqual(H.findAssetParity(reg, cacheFor('o/a', 'v1'), {}), []);
});
test('TC-TR-H08 cached repo that is hidden or not in the registry is reported as a warning', () => {
  const c = { products: { 'o/a': {}, 'o/gone': {}, 'o/hid': {} } };
  const w = H.findOrphans([{ repo: 'o/a' }, { repo: 'o/hid', hidden: true }], c);
  assert.equal(w.length, 2);
  assert.ok(w.some(x => /o\/gone/.test(x)) && w.some(x => /o\/hid/.test(x)));
});
test('TC-TR-H09 a product repo that GitHub says does not exist is named, not a crash', () => {
  const p = H.findMissingRepos([{ repo: 'o/a' }, { repo: 'o/b' }, { repo: 'o/h', hidden: true }], { 'o/a': true, 'o/b': false, 'o/h': false });
  assert.equal(p.length, 1);
  assert.match(p[0], /o\/b.*not found/);
});

/* TR-08 */
test('TC-TR-H10 every kind of health problem gets a Fix pointer to a runbook section that exists', () => {
  const samples = [
    'https://x/ returned 404', 'o/a: cache says v1, GitHub says v2', 'o/a: not in cache.json at all',
    'workflow "Sync" is disabled_inactivity, so it will not run (re-enable: gh workflow enable "Sync")',
    ...H.findSyncStale([], Date.now()), 'o/a: configured download_asset "App-*.zip" matches no asset in the latest release',
    'o/b: repository not found on GitHub',
  ];
  for (const s of samples) {
    const out = H.withFix(s);
    const m = out.match(/Fix: docs\/RUNBOOK\.md#([a-z0-9-]+)/);
    assert.ok(m, 'no Fix pointer: ' + s);
    assert.ok(anchors.has(m[1]), `${s}: runbook has no section ${m[1]}`);
    assert.equal((out.match(/Fix:/g) || []).length, 1, 'doubled Fix: ' + out);
  }
});
