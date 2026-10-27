'use strict';
// The ReadsLib interface is built from four files (reads-lib.js plus podcast-lib.js, status-lib.js, quickadd-lib.js). The page and the tests see ONE interface.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const RL = require('../js/reads-lib.js');
const V = require('../scripts/validate-site.js');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const PARTS = ['js/podcast-lib.js', 'js/status-lib.js', 'js/quickadd-lib.js'];
// the public interface as it was before the split (51 names); a part that forgets to install its names, or a rename, fails here
const API = ['KINDS', 'CATEGORIES', 'categoryLabel', 'categorySlug', 'categoryFromHash', 'isReadsHash', 'categoryHash', 'categoryTabs', 'defaultCategory', 'nextTabIndex', 'DEFAULT_NEW_CATEGORY', 'categoryOf', 'categoryCounts', 'pickAsset', 'formatDate', 'LIMITS', 'normalizeUrl', 'isPublishableUrl', 'READS_SCHEMA_VERSION', 'PODCASTS_SCHEMA_VERSION', 'PODCAST_LIMITS', 'isSupportedPodcastsVersion', 'platformOf', 'podcastView', 'validatePodcastEntry', 'serializePodcasts', 'validatePodcastsFile', 'validateReadsFile', 'validateStatusFile', 'statusView', 'filterPodcasts', 'podcastTags', 'redirectHash', 'extractLink', 'extractTitle', 'suggestKind', 'isAddHash', 'serializeDraft', 'parseDraft', 'isSupportedReadsVersion', 'serializeReads', 'domainOf', 'keyOf', 'isDuplicate', 'parseTags', 'validateEntry', 'shareLinks', 'entryView', 'filterReads', 'allTags'];

test('TC-SPLIT-01 the interface is the same 51 names after the split, in Node', () => {
  const have = Object.keys(RL).filter(k => k !== '_h').sort();
  assert.deepEqual(have, [...API].sort());
  for (const k of API) assert.ok(RL[k] !== undefined, k);
});
test('TC-SPLIT-02 the browser path gives the same interface: the four files run in order with no module system, as the page loads them', () => {
  const sandbox = { self: {}, URL };   // a browser has URL sandbox.self.self = sandbox.self; vm.createContext(sandbox);
  for (const f of ['js/reads-lib.js', ...PARTS]) vm.runInContext(read(f), sandbox, { filename: f });
  const L = sandbox.self.ReadsLib; assert.ok(L, 'ReadsLib was not created');
  assert.deepEqual(Object.keys(L).filter(k => k !== '_h').sort(), [...API].sort());
  assert.equal(L.platformOf('https://open.spotify.com/show/x'), 'Spotify');                               // podcast part
  assert.deepEqual(L.statusView({ schema_version: 1, updated: '2026-10-01', items: [{ label: 'a', value: 'b' }] }).items, [{ label: 'a', value: 'b' }]);   // status part
  assert.equal(L.suggestKind('https://open.spotify.com/show/x'), 'podcast');                               // quick add part uses the podcast part
  assert.equal(L.normalizeUrl('https://Example.com/a#x'), 'https://example.com/a');                         // core
});
test('TC-SPLIT-03 the page loads the four files in order, before the app', () => {
  const html = read('index.html'), at = f => html.indexOf('<script src="' + f + '"></script>');
  const order = ['js/safe-lib.js', 'js/reads-lib.js', ...PARTS, 'js/token-store.js', 'js/image-lib.js', 'js/app.js'].map(at);
  assert.ok(order.every(i => i > 0), JSON.stringify(order)); assert.deepEqual([...order].sort((a, b) => a - b), order);
});
test('TC-SPLIT-04 each file has its own size budget, and reads-lib.js has room again', () => {
  for (const f of PARTS) assert.ok(V.BUDGETS[f], f + ' has no budget');
  assert.ok(V.BUDGETS['js/reads-lib.js'] <= 24 * 1024);
  for (const f of ['js/reads-lib.js', ...PARTS]) assert.ok(fs.statSync(path.join(ROOT, f)).size <= V.BUDGETS[f], f);
  const own = fs.statSync(path.join(ROOT, 'js/reads-lib.js')).size; assert.ok(own < 0.8 * V.BUDGETS['js/reads-lib.js'], 'reads-lib.js is at ' + own);
});
test('TC-SPLIT-05 the health check expects every file to be served', () => {
  const h = read('scripts/health-check.js'); for (const f of PARTS) assert.ok(h.includes("'/" + f + "'"), f);
});
test('TC-SPLIT-06 the shared helpers for the parts are internal: the page never uses ReadsLib._h', () => {
  assert.ok(!/ReadsLib\._h|RL\._h/.test(read('js/app.js')));
});
test('TC-SPLIT-07 no part defines the same name as another file at top level (a copy would drift)', () => {
  const names = f => new Set([...read(f).matchAll(/^\s{2,4}function (\w+)/gm)].map(m => m[1]));
  const seen = new Map(); for (const f of ['js/reads-lib.js', ...PARTS]) for (const n of names(f)) { assert.ok(!seen.has(n), n + ' is in ' + seen.get(n) + ' and ' + f); seen.set(n, f); }
});
