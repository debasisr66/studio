'use strict';
// Studio 2.1 release: the changelog entry, the tag and rollback steps, and the artefacts agree with each other and with the code.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RL = require('../js/reads-lib.js');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const log = JSON.parse(read('content/changelog.json')).releases;

test('TC-REL21-01 the newest changelog entry is 2.1, directly above 2.0, dated, plain, within the limits', () => {
  assert.equal(log[0].version, '2.1'); assert.equal(log[1].version, '2.0');
  assert.match(log[0].date, /^2026-1\d-\d\d$/); assert.ok(log[0].date > log[1].date || log[0].date === log[1].date);
  assert.ok(log[0].title.length <= 80 && /2\.1/.test(log[0].title));
  assert.ok(log[0].items.length >= 4 && log[0].items.length <= 6);
  for (const t of [log[0].title, ...log[0].items]) assert.ok(!/[<>]|https?:|www\./.test(t), t);
  for (const t of log[0].items) assert.ok(t.length <= 160, t);
});
test('TC-REL21-02 the notes cover what visitors get: the status line, search in Others, landscape phones, links that keep their place', () => {
  const all = log[0].items.join(' ').toLowerCase();
  for (const [name, re] of [['status line', /status/], ['search in Others', /others/], ['landscape', /sideways|landscape/], ['links', /link/]]) assert.ok(re.test(all), 'the notes do not mention: ' + name);
});
test('TC-REL21-03 every claim is backed by the code: the status file and its renderer, search below four reads, the landscape rule, the section-link fix, the CI alarm', () => {
  const app = read('js/app.js'), css = read('css/site.css'), html = read('index.html');
  assert.ok(fs.existsSync(path.join(ROOT, 'content/status.json')) && /function renderStatus/.test(app) && /id="ownerStatus"/.test(html));
  assert.match(app, /\$\('#toolbar'\)\.hidden = mine\.length < 2/);
  assert.match(css, /@media \(max-height:500px\) and \(orientation:landscape\)/);
  assert.match(app, /function landOn\(id\)/);
  assert.match(read('.github/workflows/health.yml'), /workflow_run:/);
  assert.equal(RL.statusView(JSON.parse(read('content/status.json'))) !== null, true, 'the shipped status file is valid');
});
test('TC-REL21-04 build.md gives the 2.1 tag command and names the rollback tag v2.0 and the revert command', () => {
  const b = read('docs/build.md');
  assert.match(b, /### 18\.5b Release 2\.1/); assert.match(b, /git tag -a v2\.1 -m "Studio 2\.1/);
  const s = b.slice(b.indexOf('### 18.5b'), b.indexOf('### 18.6'));
  assert.ok(/rollback/i.test(s) && /v2\.0/.test(s) && /git revert -m 1/.test(s) && /refs\/tags\/v2\.1/.test(s));
  assert.match(b, /Current release line: \*\*v2\.1\*\*/);
});
test('TC-REL21-05 the README, the product intro and the plan name v2.1; the status spec says shipped in 2.1', () => {
  assert.match(read('README.md'), /v2\.1/); assert.match(read('docs/product-intro.md'), /current version \*\*v2\.1\*\*/);
  assert.match(read('docs/plan.md'), /Studio 2\.1/);
  assert.match(read('docs/specs/owner-status/spec.md'), /^\| Status \| \*\*Shipped in v2\.1/m);
  assert.ok(/Shipped in v2\.1/.test(read('docs/specs/README.md')));
});
test('TC-REL21-06 the test plan has a results section for the 2.1 release', () => assert.match(read('docs/test.md'), /^## W\. Results: the 2\.1 release PR/m));
