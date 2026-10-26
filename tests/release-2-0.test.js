'use strict';
// Studio 2.0 release (plan step 12): the changelog entry, the tag command and the artefact set agree with each other.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const log = JSON.parse(read('content/changelog.json')).releases;

test('TC-REL-01 the newest changelog entry is 2.0, above 1.6, dated, plain text, within the limits', () => {
  assert.equal(log[0].version, '2.0'); assert.equal(log[1].version, '1.6');
  assert.match(log[0].date, /^2026-10-\d\d$/);
  assert.ok(log[0].title.length <= 80 && /2\.0/.test(log[0].title));
  assert.ok(log[0].items.length >= 5 && log[0].items.length <= 6);
  for (const t of [log[0].title, ...log[0].items]) assert.ok(!/[<>]|https?:|www\./.test(t), t);
  for (const t of log[0].items) assert.ok(t.length <= 160, t);
});
test('TC-REL-02 the 2.0 notes cover the overhaul, Reads, Podcasts, the phone and accessibility work, and security and privacy', () => {
  const all = log[0].items.join(' ').toLowerCase() + ' ' + log[0].title.toLowerCase();
  for (const [name, re] of [['overhaul', /overhaul|redesign|rebuilt/], ['Reads', /reads/], ['Podcasts', /podcasts/], ['order or menu', /order|menu|navigation/], ['phone', /phone/], ['accessibility', /accessib|contrast|focus|zoom/], ['security', /secur|safer|checks/], ['privacy', /privacy|private|no tracking|cookies|nothing about you|nothing stored/]])
    assert.ok(re.test(all), 'the notes do not mention: ' + name);
});
test('TC-REL-03 the notes make no claim the code does not back: no cookies, no new third party, the Blog is gone', () => {
  const html = read('index.html'), app = read('js/app.js');
  assert.ok(!/document\.cookie/.test(app) && /default-src 'none'/.test(html));
  assert.ok(!/id="blog"/.test(html));
});
test('TC-REL-04 the tag command in build.md and the planned version agree with the changelog, and the rollback tag is named', () => {
  const b = read('docs/build.md');
  assert.ok(/git tag -a v2\.0 -m "Studio 2\.0/.test(b));
  assert.ok(/rollback/i.test(b) && /v1\.6|v1\.5/.test(b));
});
test('TC-REL-05 each of the four specs says Shipped (v2.0) in its status line and in the specs index', () => {
  for (const d of ['stabilize-core-hub', 'reads-categories', 'podcast-links', 'simple-layout']) assert.match(read('docs/specs/' + d + '/spec.md'), /^\| Status \| \*\*Shipped in v2\.0/m, d);
  assert.ok((read('docs/specs/README.md').match(/Shipped in v2\.0/g) || []).length >= 4);
});
test('TC-REL-06 the README, the product intro and the plan name v2.0 as the current release', () => {
  assert.match(read('README.md'), /v2\.0/); assert.match(read('docs/product-intro.md'), /current version \*\*v2\.0\*\*/);
  assert.match(read('docs/plan.md'), /\| 12 \| all \| Release \|.*(Prepared|Merged)/);
});
test('TC-REL-07 the status rows of REQ-51, 54, 55, 56, 58 and 59 in the test plan have no open case', () => {
  const t = read('docs/test.md'); for (const r of ['REQ-51', 'REQ-54', 'REQ-55', 'REQ-56', 'REQ-58', 'REQ-59']) { const row = t.split('\n').find(l => new RegExp('^\\| ' + r + ' \\| (TC-|Regression|Artefact)').test(l)); assert.ok(row, r + ': no status row'); assert.ok(!/⬜/.test(row), r + ' still has an open case: ' + row); }
});
