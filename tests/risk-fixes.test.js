'use strict';
// Residual-risk fixes (docs/security.md 11.4): #7 whole-file validation of reads before every publish, #2 a red CI on main is a health problem.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RL = require('../js/reads-lib.js');
const V = require('../scripts/validate-site.js');
const H = require('../scripts/health-check.js');
const ROOT = path.resolve(__dirname, '..');

test('TC-RISK-R01 reads-lib validates a whole reads file with the rules and messages CI uses', () => {
  assert.equal(typeof RL.validateReadsFile, 'function');
  const dir = path.join(ROOT, 'tests', 'fixtures');
  const files = fs.readdirSync(dir).filter(f => /^reads-.*\.json$/.test(f));
  assert.ok(files.length >= 5);
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.deepEqual(RL.validateReadsFile(data), V.validateReads(data), f);
  }
  assert.deepEqual(RL.validateReadsFile(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/reads.json'), 'utf8'))).errors, []);
});
test('TC-RISK-R02 the validator delegates to the library, so the two cannot drift apart', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'scripts/validate-site.js'), 'utf8'), /RL\.validateReadsFile/);
});
test('TC-RISK-R03 the admin publish path runs the reads check before anything is written', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.match(app, /RL\.validateReadsFile\(data\)/);
});
test('TC-RISK-R04 reads-lib stays within its size budget', () => assert.ok(fs.statSync(path.join(ROOT, 'js/reads-lib.js')).size <= 26 * 1024));

const run = (conclusion, when, status = 'completed') => ({ conclusion, status, updated_at: when, html_url: 'https://github.com/o/r/actions/runs/1' });
test('TC-RISK-C01 findCiRed: the newest finished CI run on main failing is a problem; a passing newest run is not', () => {
  assert.equal(typeof H.findCiRed, 'function');
  assert.equal(H.findCiRed([run('failure', '2026-10-26T10:00:00Z'), run('success', '2026-10-25T10:00:00Z')]).length, 1);
  assert.deepEqual(H.findCiRed([run('success', '2026-10-26T10:00:00Z'), run('failure', '2026-10-25T10:00:00Z')]), []);
});
test('TC-RISK-C02 findCiRed: cancelled and still-running runs are ignored; no runs at all is not an alarm; bad input does not throw', () => {
  assert.deepEqual(H.findCiRed([run('cancelled', '2026-10-26T10:00:00Z'), run('success', '2026-10-25T10:00:00Z')]), []);
  assert.deepEqual(H.findCiRed([run(null, '2026-10-26T10:00:00Z', 'in_progress'), run('success', '2026-10-25T10:00:00Z')]), []);
  assert.deepEqual(H.findCiRed([]), []);
  for (const bad of [undefined, null, 5, 'x', [null], [{}]]) assert.deepEqual(H.findCiRed(bad), []);
});
test('TC-RISK-C03 the message names the run and points to a runbook section that exists', () => {
  const m = H.findCiRed([run('failure', '2026-10-26T10:00:00Z')])[0], out = H.withFix(m);
  assert.match(out, /actions\/runs\/1/);
  const anchor = out.match(/Fix: docs\/RUNBOOK\.md#([a-z0-9-]+)/);
  assert.ok(anchor);
  const rb = fs.readFileSync(path.join(ROOT, 'docs/RUNBOOK.md'), 'utf8');
  const anchors = new Set([...rb.matchAll(/^#{1,3} (.+)$/gm)].map(x => x[1].toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-')));
  assert.ok(anchors.has(anchor[1]), anchor[1]);
  assert.ok(rb.includes('CI is red on main'), 'the health-messages table in the runbook lists the new message');
});
test('TC-RISK-C04 the health workflow may read workflow runs (it already has actions: read)', () => {
  assert.match(fs.readFileSync(path.join(ROOT, '.github/workflows/health.yml'), 'utf8'), /actions: read/);
});
