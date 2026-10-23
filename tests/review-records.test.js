'use strict';
// Independent review gate (docs/REVIEW-GATE.md): a security-sensitive phase is not marked passed by its author.
// Every record in docs/reviews/ must name an author model and a DIFFERENT reviewer model, carry the reviewer's own verdict, and say who acknowledged it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'docs', 'reviews');
const VERDICTS = ['APPROVE', 'APPROVE WITH CONDITIONS', 'REJECT'];
const row = (doc, key) => { const m = doc.match(new RegExp('^\\| ' + key + ' \\| (.+?) \\|\\s*$', 'm')); return m ? m[1].trim() : ''; };
const family = s => { const m = String(s).toLowerCase().match(/sonnet|opus|haiku|fable/); return m ? m[0] : String(s).toLowerCase().trim(); };   // the model family is what must differ

/* exported for the checks below so a broken record can be shown to fail */
function checkRecord(name, doc) {
  const errors = [], author = row(doc, 'Author model'), reviewer = row(doc, 'Reviewer model'), verdict = row(doc, 'Reviewer verdict'), ack = row(doc, 'Owner acknowledgement');
  if (!author) errors.push(`${name}: no "Author model" row`);
  if (!reviewer) errors.push(`${name}: no "Reviewer model" row`);
  if (author && reviewer && family(author) === family(reviewer)) errors.push(`${name}: reviewer model "${reviewer}" is the same as the author model "${author}"`);
  if (!VERDICTS.includes(verdict)) errors.push(`${name}: "Reviewer verdict" must be exactly one of ${VERDICTS.join(' / ')} (got "${verdict}")`);
  if (!ack) errors.push(`${name}: no "Owner acknowledgement" row`);
  if (!/^\| Reviewed commit \| [0-9a-f]{7,40}/m.test(doc)) errors.push(`${name}: no "Reviewed commit" row with a commit id`);
  if (!/^## Findings/m.test(doc)) errors.push(`${name}: no "## Findings" section`);
  return errors;
}

const GOOD = `| Author model | Claude Sonnet 5.5 |\n| Reviewer model | Claude Opus 5.5 (separate agent) |\n| Reviewed commit | a89ce2f |\n| Reviewer verdict | APPROVE |\n| Owner acknowledgement | pending |\n\n## Findings\n`;

test('review gate: a well-formed record passes', () => assert.deepEqual(checkRecord('x', GOOD), []));
test('review gate: the author cannot review their own work (same model, even with a different label)', () => {
  assert.ok(checkRecord('x', GOOD.replace('Claude Opus 5.5 (separate agent)', 'Claude Sonnet 5.5 (fresh context)')).some(e => /same as the author/.test(e)));
  assert.ok(checkRecord('x', GOOD.replace('Claude Opus 5.5 (separate agent)', 'claude-sonnet-5-5')).some(e => /same as the author/.test(e)));
  assert.deepEqual(checkRecord('x', GOOD.replace('Claude Opus 5.5 (separate agent)', 'Claude Haiku 5.5')), []);
});
test('review gate: a missing or made-up verdict, a missing acknowledgement or commit fails', () => {
  assert.ok(checkRecord('x', GOOD.replace('| APPROVE |', '| PASSED |')).some(e => /Reviewer verdict/.test(e)));
  assert.ok(checkRecord('x', GOOD.replace('| Owner acknowledgement | pending |\n', '')).some(e => /Owner acknowledgement/.test(e)));
  assert.ok(checkRecord('x', GOOD.replace('a89ce2f', 'later')).some(e => /Reviewed commit/.test(e)));
  assert.ok(checkRecord('x', GOOD.replace('## Findings', '## Notes')).some(e => /Findings/.test(e)));
});
test('review gate: SH-02 (the CI tool, merged before the gate existed) has a record', () => {
  assert.ok(fs.existsSync(path.join(DIR, 'SH-02.md')), 'docs/reviews/SH-02.md is missing: the CI tool needs an independent review');
});
test('review gate: the file-name pattern covers requirement ids and phase names (SH-02.md, PC-B.md) and ignores README', () => {
  const re = /^[A-Z]{2}-[A-Z0-9]+.*\.md$/;
  for (const n of ['SH-02.md', 'PC-B.md', 'UX-04.md']) assert.ok(re.test(n), n);
  assert.ok(!re.test('README.md'));
});
test('review gate: every record in docs/reviews/ is well-formed', () => {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^[A-Z]{2}-[A-Z0-9]+.*\.md$/.test(f)) : [];
  assert.ok(files.length >= 1, 'no review records yet');
  for (const f of files) assert.deepEqual(checkRecord(f, fs.readFileSync(path.join(DIR, f), 'utf8')), []);
});
test('review gate: the process document names the gated phases and the rule', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'REVIEW-GATE.md'), 'utf8');
  for (const s of ['SH-02', 'UX-04', 'UX-05', 'different model', 'Owner acknowledgement']) assert.ok(doc.includes(s), 'REVIEW-GATE.md does not mention ' + s);
});
