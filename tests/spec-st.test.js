'use strict';
// SPEC-ST: the owner status line (content/status.json). Browser cases are in scripts/smoke.js (TC-ST-R*).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RL = require('../js/reads-lib.js');
const V = require('../scripts/validate-site.js');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const NOW = Date.parse('2026-10-27T12:00:00Z');
const good = (over = {}) => ({ schema_version: 1, updated: '2026-10-27', items: [{ label: 'Studio', value: 'Steady' }, { label: 'Next', value: 'Incubating' }, { label: 'Owner', value: 'Thinking' }], ...over });
const errs = (f, now = NOW) => RL.validateStatusFile(f, now).errors;
const items = n => Array.from({ length: n }, (_, i) => ({ label: 'L' + i, value: 'v' + i }));

test('TC-ST-D01 the real content/status.json exists and passes', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'content/status.json')));
  assert.deepEqual(errs(JSON.parse(read('content/status.json'))), []);
});
test('TC-ST-D03 boundaries: 1 and 4 items pass, 0 and 5 fail; label 20 passes and 21 fails; value 40 passes and 41 fails', () => {
  assert.deepEqual(errs(good({ items: items(1) })), []); assert.deepEqual(errs(good({ items: items(4) })), []);
  assert.ok(errs(good({ items: [] })).some(e => /1 to 4/.test(e))); assert.ok(errs(good({ items: items(5) })).some(e => /1 to 4/.test(e)));
  assert.deepEqual(errs(good({ items: [{ label: 'x'.repeat(20), value: 'y'.repeat(40) }] })), []);
  assert.ok(errs(good({ items: [{ label: 'x'.repeat(21), value: 'ok' }] })).some(e => /label/.test(e)));
  assert.ok(errs(good({ items: [{ label: 'ok', value: 'y'.repeat(41) }] })).some(e => /value/.test(e)));
  assert.ok(errs(good({ items: [{ label: '', value: 'ok' }] })).some(e => /label/.test(e)) && errs(good({ items: [{ label: 'ok', value: '   ' }] })).some(e => /value/.test(e)));
});
test('TC-ST-D04 updated: a real date passes; tomorrow (beyond the one day of clock slack), a bad format and an impossible date fail', () => {
  assert.deepEqual(errs(good({ updated: '2026-10-28' })), []);   // one day of slack for time zones
  assert.ok(errs(good({ updated: '2026-10-30' })).some(e => /future/.test(e)));
  for (const bad of ['27 Oct', '2026-13-01', '2026-02-30', 20261027, null, '']) assert.ok(errs(good({ updated: bad })).some(e => /updated/.test(e)), String(bad));
});
test('TC-ST-D05 plain text: markup, links and www are refused in labels and values', () => {
  for (const s of ['<b>x</b>', 'a > b', 'see http://x.co', 'https://x.co', 'www.x.co', '<img src=x onerror=1>']) {
    assert.ok(errs(good({ items: [{ label: 'ok', value: s }] })).some(e => /plain text/.test(e)), s);
    assert.ok(errs(good({ items: [{ label: s.slice(0, 20), value: 'ok' }] })).some(e => /plain text|label/.test(e)), s);
  }
});
test('TC-ST-D06a the schema version and the shape: a newer or missing version, non-objects, extra junk types, never throw', () => {
  assert.ok(errs(good({ schema_version: 2 })).some(e => /schema_version/.test(e))); assert.ok(errs(good({ schema_version: undefined })).some(e => /schema_version/.test(e)));
  for (const bad of [null, undefined, 5, 'x', [], { items: 'x' }, { schema_version: 1, updated: '2026-10-27', items: [null, 5, 'x'] }]) assert.ok(errs(bad).length > 0, JSON.stringify(bad));
});
test('TC-ST-D02 the six rules exist, each with a failing fixture that fails with its own rule', () => {
  const ids = ['status-schema-version', 'status-items', 'status-label', 'status-value', 'status-updated', 'status-plain'];
  for (const id of ids) {
    const rule = V.RULES.find(r => r.id === id); assert.ok(rule, id + ' missing from RULES');
    const fx = JSON.parse(read('tests/fixtures/' + id + '.json'));
    const out = V.runRule(rule, fx); assert.ok(out.errors.some(e => rule.match.test(e)), id + ': ' + JSON.stringify(out));
  }
});
test('TC-ST-D06b the contract names the file and its rule ids, and the runbook explains them', () => {
  const c = read('docs/CONTRACT.md'), rb = read('docs/RUNBOOK.md');
  assert.ok(c.includes('content/status.json') && /^## status\.json/m.test(c));
  for (const id of ['status-schema-version', 'status-items', 'status-label', 'status-value', 'status-updated', 'status-plain']) assert.ok(c.includes(id), id);
  assert.ok(/status\.json/.test(rb));
});
test('TC-ST-D07 the health check expects status.json to be served', () => assert.match(read('scripts/health-check.js'), /'\/content\/status\.json'/));
test('TC-ST-V01 statusView gives the page only what is valid: null for anything CI would refuse, trimmed items and the date otherwise', () => {
  assert.equal(RL.statusView(null), null); assert.equal(RL.statusView(good({ items: items(5) })), null); assert.equal(RL.statusView(good({ schema_version: 2 })), null);
  assert.equal(RL.statusView(good({ items: [{ label: '<b>', value: 'x' }] })), null);
  const v = RL.statusView(good({ items: [{ label: ' Studio ', value: ' Steady ' }] }));
  assert.deepEqual(v, { items: [{ label: 'Studio', value: 'Steady' }], updated: '2026-10-27' });
});
test('TC-ST-S01 the renderer is guarded, uses textContent only, and adds no storage key, cookie, host or inline code', () => {
  const app = read('js/app.js'), html = read('index.html');
  const fn = app.match(/function renderStatus\(\) \{[\s\S]*?\n\}/); assert.ok(fn, 'renderStatus exists');
  assert.ok(!/innerHTML|insertAdjacentHTML/.test(fn[0]) && /textContent/.test(fn[0]));
  assert.match(app, /name: 'status', run: renderStatus/);
  assert.ok(html.includes("connect-src 'self' https://api.github.com;") && !/document\.cookie/.test(app));
  const keys = new Set([...(app + read('js/token-store.js')).matchAll(/'(studio-[a-z-]+)'/g)].map(m => m[1]));
  assert.deepEqual([...keys].sort(), ['studio-admin-pat', 'studio-quick-draft', 'studio-seen-version', 'studio-theme']);
});
test('TC-ST-S02 the line is in the page as a hidden element under the hero, not a section and not in the navs', () => {
  const html = read('index.html');
  assert.match(html, /<div class="owner-status" id="ownerStatus"[^>]* hidden>/);
  assert.ok(html.indexOf('id="ownerStatus"') > html.indexOf('class="hero"') && html.indexOf('id="ownerStatus"') < html.indexOf('id="products"'));
  assert.ok(!/href="#ownerStatus"|href="#status"/.test(html));
});
