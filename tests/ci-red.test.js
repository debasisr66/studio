'use strict';
// Red CI on main: the immediate trigger, the issue (an email with the fix steps) and the CI Red Fix doc.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const C = require('../scripts/ci-red.js');
const V = require('../scripts/validate-site.js');
const DOC = read('docs/CI-RED-FIX.md');

const run = (conclusion, t = '2026-10-27T10:00:00Z') => ({ status: 'completed', conclusion, updated_at: t, html_url: 'https://github.com/o/r/actions/runs/9', head_sha: 'abcdef1234567', display_title: 'Merge pull request #1' });
const fakeGh = (open = []) => {
  const calls = [];
  const fetch = async (url, o = {}) => {
    const m = (o.method || 'GET'), body = o.body ? JSON.parse(o.body) : null; calls.push({ m, url, body });
    if (m === 'GET') return { ok: true, status: 200, json: async () => open };
    return { ok: true, status: 201, json: async () => ({ number: 7 }) };
  };
  return { fetch, calls };
};

test('TC-CIR-D01 the fix doc exists, has the steps between markers, and covers the decisions: find the failure, flake or real, fix forward or revert, confirm, who is told', () => {
  assert.match(DOC, /<!-- steps:start -->[\s\S]+<!-- steps:end -->/);
  for (const w of ['gh run view', 'git revert', 'rerun', 'validate-site', 'smoke', 'health-check', 'issue']) assert.ok(DOC.includes(w), 'the doc does not mention ' + w);
  assert.ok(DOC.length > 1500 && DOC.length < 9000);
});
test('TC-CIR-D02 stepsFromDoc returns only the marked steps, and falls back to a pointer if the markers are missing', () => {
  const s = C.stepsFromDoc(DOC); assert.ok(s.includes('gh run view') && !s.includes('steps:start'));
  assert.match(C.stepsFromDoc('no markers here'), /docs\/CI-RED-FIX\.md/);
});
test('TC-CIR-D03 the runbook has a "CI is red on main" section that points to the doc, and the health message points to it', () => {
  const rb = read('docs/RUNBOOK.md');
  assert.match(rb, /^## CI is red on main/m); assert.ok(rb.includes('CI-RED-FIX.md'));
  const H = require('../scripts/health-check.js');
  assert.match(H.withFix(H.findCiRed([run('failure')])[0]), /RUNBOOK\.md#ci-is-red-on-main/);
});

test('TC-CIR-I01 red CI and no open issue: one issue is created, with the run, the commit and the steps in the body', async () => {
  const g = fakeGh([]);
  const r = await C.syncIssue({ fetch: g.fetch, repo: 'o/r', token: 't', runs: [run('failure')], doc: DOC });
  const post = g.calls.filter(c => c.m === 'POST'); assert.equal(post.length, 1); assert.match(post[0].url, /repos\/o\/r\/issues$/);
  assert.equal(post[0].body.title, C.TITLE);
  for (const x of ['actions/runs/9', 'abcdef1', 'gh run view', 'CI-RED-FIX.md']) assert.ok(post[0].body.body.includes(x), x);
  assert.match(r, /created/);
});
test('TC-CIR-I02 red CI and an issue already open: a comment is added, no second issue', async () => {
  const g = fakeGh([{ number: 5, title: C.TITLE }]);
  await C.syncIssue({ fetch: g.fetch, repo: 'o/r', token: 't', runs: [run('failure')], doc: DOC });
  const w = g.calls.filter(c => c.m !== 'GET'); assert.equal(w.length, 1); assert.match(w[0].url, /issues\/5\/comments$/);
});
test('TC-CIR-I03 CI green again and an issue open: a comment, then the issue is closed', async () => {
  const g = fakeGh([{ number: 5, title: C.TITLE }]);
  await C.syncIssue({ fetch: g.fetch, repo: 'o/r', token: 't', runs: [run('success')], doc: DOC });
  const w = g.calls.filter(c => c.m !== 'GET'); assert.equal(w.length, 2);
  assert.match(w[0].url, /issues\/5\/comments$/); assert.equal(w[1].m, 'PATCH'); assert.equal(w[1].body.state, 'closed');
});
test('TC-CIR-I04 green and no issue, a cancelled newest run, or no runs: nothing is written', async () => {
  for (const runs of [[run('success')], [run('cancelled', '2026-10-27T11:00:00Z'), run('success')], []]) {
    const g = fakeGh([]); await C.syncIssue({ fetch: g.fetch, repo: 'o/r', token: 't', runs, doc: DOC });
    assert.equal(g.calls.filter(c => c.m !== 'GET').length, 0);
  }
});
test('TC-CIR-I05 only the exact title counts as ours: another open issue is left alone', async () => {
  const g = fakeGh([{ number: 3, title: 'Something else' }, { number: 4, title: C.TITLE + ' (copy)' }]);
  await C.syncIssue({ fetch: g.fetch, repo: 'o/r', token: 't', runs: [run('failure')], doc: DOC });
  assert.equal(g.calls.filter(c => c.m === 'POST' && /issues$/.test(c.url)).length, 1);
});
test('TC-CIR-I06 API failures never throw (the health check must still report); pull requests listed as issues are ignored; no token means no calls', async () => {
  const bad = async () => ({ ok: false, status: 403, json: async () => ({}) });
  assert.match(await C.syncIssue({ fetch: bad, repo: 'o/r', token: 't', runs: [run('failure')], doc: DOC }), /could not/);
  const boom = async () => { throw new Error('network'); };
  assert.match(await C.syncIssue({ fetch: boom, repo: 'o/r', token: 't', runs: [run('failure')], doc: DOC }), /could not/);
  const g = fakeGh([{ number: 8, title: C.TITLE, pull_request: {} }]);
  await C.syncIssue({ fetch: g.fetch, repo: 'o/r', token: 't', runs: [run('failure')], doc: DOC });
  assert.equal(g.calls.filter(c => c.m === 'POST' && /issues$/.test(c.url)).length, 1);
  const g2 = fakeGh([]); assert.match(await C.syncIssue({ fetch: g2.fetch, repo: 'o/r', token: '', runs: [run('failure')], doc: DOC }), /no token/); assert.equal(g2.calls.length, 0);
});
test('TC-CIR-I07 the issue text is plain text: run fields from the API cannot add markup that links or mentions elsewhere', () => {
  const body = C.issueBody({ conclusion: 'failure', html_url: 'https://github.com/o/r/actions/runs/9', head_sha: 'abcdef1234567', display_title: '@everyone <script>x</script> [click](http://evil)' }, 'steps');
  assert.ok(!/@everyone/.test(body) && !/<script>/.test(body) && !/\]\(http:\/\/evil\)/.test(body));
});

test('TC-CIR-W01 the health workflow also runs when CI finishes on main, keeps the daily run, and may write issues and nothing else', () => {
  const y = read('.github/workflows/health.yml');
  assert.match(y, /workflow_run:\s*\n\s*workflows:\s*\[CI\]\s*\n\s*types:\s*\[completed\]\s*\n\s*branches:\s*\[main\]/);
  assert.match(y, /schedule:[\s\S]*cron:/); assert.match(y, /workflow_dispatch:/);
  const block = y.match(/^permissions:\s*\n((?:[ \t]+[^\n]*\n)+)/m)[1];
  assert.match(block, /issues:\s*write/); assert.deepEqual([...block.matchAll(/^[ \t]+([a-z-]+):\s*write/gm)].map(m => m[1]), ['issues']);
  assert.match(y, /name: CI|workflows:\s*\[CI\]/);
});
test('TC-CIR-W02 the validator allows issues: write only in health.yml, and still refuses it elsewhere and every other write', () => {
  const wf = perm => `permissions:\n  contents: read\n  ${perm}\njobs: {}\n`;
  assert.deepEqual(V.checkWorkflows({ '.github/workflows/health.yml': wf('issues: write') }), []);
  assert.ok(V.checkWorkflows({ '.github/workflows/ci.yml': wf('issues: write') }).some(e => /issues: write is not allowed/.test(e)));
  assert.ok(V.checkWorkflows({ '.github/workflows/health.yml': wf('pull-requests: write') }).some(e => /not allowed/.test(e)));
  assert.ok(V.checkWorkflows({ '.github/workflows/health.yml': wf('actions: write') }).some(e => /not allowed/.test(e)));
});
test('TC-CIR-W03 the real workflow files pass the validator rules', () => {
  const src = {}; for (const f of fs.readdirSync(path.join(ROOT, '.github/workflows'))) src['.github/workflows/' + f] = read('.github/workflows/' + f);
  assert.deepEqual(V.checkWorkflows(src), []);
});
test('TC-CIR-W04 the workflow run only trusts main: the trigger is limited to main and the checkout is the default branch', () => {
  const y = read('.github/workflows/health.yml'); assert.match(y, /branches:\s*\[main\]/);
  assert.ok(!/github\.event\.workflow_run\.head_branch/.test(y.replace(/#.*$/gm, '')) || /ref:\s*main/.test(y));
});
