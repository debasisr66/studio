'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/reads-lib.js');

test('normalizeUrl: accepts http/https and adds https to bare domains', () => {
  assert.equal(L.normalizeUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(L.normalizeUrl('http://example.com/a'), 'http://example.com/a');
  assert.equal(L.normalizeUrl('example.com/a'), 'https://example.com/a');
  assert.equal(L.normalizeUrl('  https://Example.COM/Path  '), 'https://example.com/Path');
});

test('normalizeUrl: rejects dangerous or unsupported schemes', () => {
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'ftp://x.com/f', 'file:///etc/passwd', 'vbscript:x', '//evil.com']) {
    assert.equal(L.normalizeUrl(bad), null, bad);
  }
});

test('normalizeUrl: rejects empty, garbage, credentials and over-long input', () => {
  assert.equal(L.normalizeUrl(''), null);
  assert.equal(L.normalizeUrl('   '), null);
  assert.equal(L.normalizeUrl(null), null);
  assert.equal(L.normalizeUrl('not a url'), null);
  assert.equal(L.normalizeUrl('https://user:pass@example.com/'), null);
  assert.equal(L.normalizeUrl('https://example.com/' + 'a'.repeat(2100)), null);
});

test('normalizeUrl: strips tracking params and fragments, keeps real params', () => {
  assert.equal(
    L.normalizeUrl('https://example.com/p?id=7&utm_source=x&utm_medium=y&fbclid=abc&gclid=1#section'),
    'https://example.com/p?id=7');
  assert.equal(L.normalizeUrl('https://example.com/p?utm_source=x'), 'https://example.com/p');
});

test('domainOf: hostname without www, null for invalid', () => {
  assert.equal(L.domainOf('https://www.example.com/a'), 'example.com');
  assert.equal(L.domainOf('https://blog.example.co.uk/a'), 'blog.example.co.uk');
  assert.equal(L.domainOf('nope'), null);
});

test('isDuplicate: ignores www, trailing slash, tracking params', () => {
  const list = [{ url: 'https://example.com/a/' }];
  assert.equal(L.isDuplicate(list, 'https://www.example.com/a?utm_source=x'), true);
  assert.equal(L.isDuplicate(list, 'https://example.com/b'), false);
  assert.equal(L.isDuplicate([], 'https://example.com/a'), false);
  assert.equal(L.isDuplicate([{ url: 'junk' }, {}], 'https://example.com/a'), false);
});

test('isDuplicate: can exclude the entry being edited', () => {
  const list = [{ id: 1, url: 'https://example.com/a' }, { id: 2, url: 'https://example.com/b' }];
  assert.equal(L.isDuplicate(list, 'https://example.com/a', 1), false);
  assert.equal(L.isDuplicate(list, 'https://example.com/a', 2), true);
});

test('parseTags: lowercases, trims, dedupes, caps at 5 and 24 chars', () => {
  assert.deepEqual(L.parseTags(' AI, ai , Cloud,, security '), ['ai', 'cloud', 'security']);
  assert.equal(L.parseTags('a,b,c,d,e,f,g').length, 5);
  assert.equal(L.parseTags('x'.repeat(40))[0].length, 24);
  assert.deepEqual(L.parseTags(''), []);
  assert.deepEqual(L.parseTags(null), []);
});

test('parseTags: strips markup and unsafe characters, hyphenates spaces, drops leading #', () => {
  assert.deepEqual(L.parseTags('<b>x</b>, #AI, machine learning, "q"'), ['bxb', 'ai', 'machine-learning', 'q']);
  assert.deepEqual(L.parseTags('<>, ,!!'), []);
});

test('validateEntry: valid entry is normalized', () => {
  const r = L.validateEntry({ url: 'example.com/a?utm_source=x', title: ' Great read ', comment: ' Worth it ', kind: 'paper', tags: 'AI, ml' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { url: 'https://example.com/a', title: 'Great read', comment: 'Worth it', kind: 'paper', tags: ['ai', 'ml'] });
});

test('validateEntry: reports field errors', () => {
  const r = L.validateEntry({ url: 'javascript:alert(1)', title: '', comment: 'x'.repeat(281), kind: 'weird' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.url);
  assert.ok(r.errors.title);
  assert.ok(r.errors.comment);
  assert.ok(r.errors.kind);
});

test('validateEntry: title length limit and default kind', () => {
  assert.ok(L.validateEntry({ url: 'https://a.com', title: 'x'.repeat(141) }).errors.title);
  const r = L.validateEntry({ url: 'https://a.com', title: 'ok' });
  assert.equal(r.ok, true);
  assert.equal(r.value.kind, 'article');
});

test('shareLinks: LinkedIn URL is encoded and cannot be injected into', () => {
  const s = L.shareLinks('https://example.com/a?x=1&y=2');
  assert.equal(s.linkedin, 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent('https://example.com/a?x=1&y=2'));
  assert.equal(L.shareLinks('javascript:alert(1)'), null);
});

test('entryView: legacy {title,url,note} entries still render', () => {
  const v = L.entryView({ title: 'Old', url: 'https://old.com', note: 'legacy note' });
  assert.equal(v.comment, 'legacy note');
  assert.equal(v.kind, 'article');
  assert.deepEqual(v.tags, []);
  assert.equal(v.added, '');
  const n = L.entryView({ title: 'New', url: 'https://n.com', comment: 'c', note: 'ignored', kind: 'video', tags: ['a'], added: '2026-10-19' });
  assert.equal(n.comment, 'c');
  assert.equal(n.kind, 'video');
});

test('filterReads: by tag and text, case-insensitive', () => {
  const list = [
    { title: 'Rust memory', url: 'https://a.com', tags: ['rust'], comment: 'ownership' },
    { title: 'Cloud costs', url: 'https://b.com', tags: ['cloud'], note: 'finops' },
  ];
  assert.equal(L.filterReads(list, { tag: 'rust' }).length, 1);
  assert.equal(L.filterReads(list, { q: 'FINOPS' }).length, 1);
  assert.equal(L.filterReads(list, { q: 'b.com' }).length, 1);
  assert.equal(L.filterReads(list, {}).length, 2);
  assert.equal(L.filterReads(list, { tag: 'rust', q: 'cloud' }).length, 0);
});

test('allTags: unique, sorted by frequency then name', () => {
  const list = [{ tags: ['b', 'a'] }, { tags: ['a'] }, {}];
  assert.deepEqual(L.allTags(list), ['a', 'b']);
});

test('pickAsset: no pattern keeps first-asset behavior', () => {
  const a = [{ name: 'doc.docx', download_url: 'u1' }, { name: 'app.zip', download_url: 'u2' }];
  assert.equal(L.pickAsset(a).name, 'doc.docx');
  assert.equal(L.pickAsset(a, '').name, 'doc.docx');
  assert.equal(L.pickAsset([]), null);
  assert.equal(L.pickAsset(undefined, '*.zip'), null);
});

test('pickAsset: wildcard match, case-insensitive, first match wins', () => {
  const a = [
    { name: 'Notes.md', download_url: 'u0' },
    { name: 'PennyExpenseManager-v3.2.zip.sha256', download_url: 'u1' },
    { name: 'PennyExpenseManager-v3.2.zip', download_url: 'u2' },
    { name: 'Other.zip', download_url: 'u3' },
  ];
  assert.equal(L.pickAsset(a, 'PennyExpenseManager-*.zip').download_url, 'u2');   // not the .sha256
  assert.equal(L.pickAsset(a, 'pennyexpensemanager-*.ZIP').download_url, 'u2');
  assert.equal(L.pickAsset(a, '*.zip').download_url, 'u2');
});

test('pickAsset: no match returns null; regex characters in the pattern are literal', () => {
  const a = [{ name: 'app.zip', download_url: 'u1' }, { name: 'appXzip', download_url: 'u2' }];
  assert.equal(L.pickAsset(a, '*.ipa'), null);
  assert.equal(L.pickAsset(a, 'app.zip').download_url, 'u1');       // '.' is literal, so appXzip is not matched first
  assert.equal(L.pickAsset(a, 'a(p)p.zip'), null);
  assert.equal(L.pickAsset([{ name: 'x', download_url: 'u' }], '[')?.name, undefined);
});

test('formatDate: date-only strings are calendar dates, the same in every timezone', () => {
  const { execFileSync } = require('node:child_process');
  const probe = "console.log(require('./js/reads-lib.js').formatDate('2026-10-19'))";
  for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati']) {
    const out = execFileSync(process.execPath, ['-e', probe], { env: { ...process.env, TZ: tz }, cwd: require('node:path').resolve(__dirname, '..') }).toString().trim();
    assert.equal(out, '19 Oct 2026', tz);
  }
});

test('formatDate: invalid input gives an empty string; timestamps still format', () => {
  assert.equal(L.formatDate('not a date'), '');
  assert.equal(L.formatDate(undefined), '');
  assert.match(L.formatDate('2026-10-19T12:00:00Z'), /^\d{1,2} Oct 2026$/);
});
