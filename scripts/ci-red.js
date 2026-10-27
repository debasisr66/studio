// "CI is red on main" alert (docs/CI-RED-FIX.md). Used by scripts/health-check.js inside GitHub Actions only.
// A failed CI run on main opens ONE issue titled TITLE with the fix steps (GitHub emails the owner about new issues, which is how the
// steps reach the inbox); later red runs add a comment; the first green run comments and closes it. Nothing here throws: the health check
// must still report its own findings when GitHub's API is down. No dependencies, no secrets beyond the workflow's own token.
'use strict';

const TITLE = 'CI is red on main';
const DOC = 'docs/CI-RED-FIX.md';

/* The steps shown in the issue: the text between the markers in docs/CI-RED-FIX.md, so there is one source for the doc and the email. */
function stepsFromDoc(text) {
  const m = String(text || '').match(/<!-- steps:start -->([\s\S]*?)<!-- steps:end -->/);
  return m ? m[1].trim() : `The fix steps are in ${DOC} in the repository.`;
}

/* Plain text only: run fields come from the API (a pull request title can hold anything), so markup, mentions and links are removed. */
const plain = (s, n) => String(s == null ? '' : s).replace(/[<>@\[\]()`*_#|\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

function issueBody(run, steps) {
  return [
    `The newest finished CI run on \`main\` ${plain(run.conclusion, 20)}.`,
    '',
    `- Run: ${plain(run.html_url, 200)}`,
    `- Commit: \`${plain(run.head_sha, 40).slice(0, 7)}\` ${plain(run.display_title, 100)}`,
    '',
    '## What to do',
    '',
    steps,
    '',
    `Full guide: ${DOC} in the repository. This issue updates itself: it gets a comment while CI stays red and closes when CI is green again.`,
  ].join('\n');
}

function newest(runs) {
  const done = (Array.isArray(runs) ? runs : []).filter(r => r && r.status === 'completed' && r.conclusion && r.conclusion !== 'cancelled' && !isNaN(Date.parse(r.updated_at)))
    .sort((a, b) => (b.run_number || 0) - (a.run_number || 0) || Date.parse(b.updated_at) - Date.parse(a.updated_at));   // push order, not finishing order
  return done[0] || null;
}

async function syncIssue({ fetch, repo, token, runs, doc }) {
  if (!token) return 'no token: the CI-red issue was not updated';
  const run = newest(runs);
  if (!run) return 'no finished CI run to report on';
  const red = !['success', 'skipped', 'neutral'].includes(run.conclusion);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'studio-health', Authorization: 'Bearer ' + token };
  const base = `https://api.github.com/repos/${repo}/issues`;
  const send = (method, url, body) => fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const res = await fetch(`${base}?state=open&per_page=50`, { headers });
    if (!res.ok) return `could not read issues: GitHub API ${res.status}`;
    const open = (await res.json()).find(i => i && !i.pull_request && i.title === TITLE);
    if (red && !open) {
      const r = await send('POST', base, { title: TITLE, body: issueBody(run, stepsFromDoc(doc)) });
      return r.ok ? 'CI-red issue created' : `could not create the CI-red issue: GitHub API ${r.status}`;
    }
    if (red) {
      const r = await send('POST', `${base}/${open.number}/comments`, { body: `Still red: ${plain(run.html_url, 200)} (${plain(run.updated_at, 30)}).` });
      return r.ok ? 'CI-red issue updated' : `could not update the CI-red issue: GitHub API ${r.status}`;
    }
    if (open) {
      const c = await send('POST', `${base}/${open.number}/comments`, { body: `CI is green again: ${plain(run.html_url, 200)}. Closing.` });
      const r = await send('PATCH', `${base}/${open.number}`, { state: 'closed' });
      return c.ok && r.ok ? 'CI-red issue closed' : `could not close the CI-red issue: GitHub API ${c.ok ? r.status : c.status}`;
    }
    return 'CI is green; no open CI-red issue';
  } catch (e) { return 'could not update the CI-red issue: ' + e.message; }
}

module.exports = { TITLE, DOC, stepsFromDoc, issueBody, syncIssue };
