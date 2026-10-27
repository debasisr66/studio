'use strict';
// SPEC-QA Phase A (QA-01 … QA-08): the pure helpers and the structural parts. Browser behaviour is in scripts/smoke.js (TC-QA-*).
// Test IDs match docs/specs/quick-add/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RL = require('../js/reads-lib.js');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html'), app = read('js/app.js');
const section = (src, id) => { const m = src.match(new RegExp('<div class="modal-bg" id="' + id + '">[\\s\\S]*?</div></div>\\s*(?=<div class="modal-bg"|<script)')); return m ? m[0] : ''; };

/* QA-02: finding the link and the title in whatever the clipboard holds */
test('TC-QA-P05 extractLink: share text in many shapes', () => {
  const L = 'https://example.com/a/b';
  const cases = [
    [L, L], ['  ' + L + '  ', L], ['Great read\n' + L, L], [L + '\nGreat read', L], ['Great read - ' + L, L], ['see ' + L + ' now', L],
    ['(' + L + ')', L], ['<' + L + '>', L], ['"' + L + '"', L], [L + '.', L], [L + ',', L], [L + '!', L], [L + '?', L],
    ['[a read](' + L + ')', L], ['https://en.wikipedia.org/wiki/Foo_(bar)', 'https://en.wikipedia.org/wiki/Foo_(bar)'],
    ['first https://one.example.com/x second https://two.example.com/y', 'https://one.example.com/x'],
    ['HTTPS://EXAMPLE.COM/Path', 'https://example.com/Path'],
    ['Title\r\nhttps://example.com/x?utm_source=a&fbclid=b&id=7#frag', 'https://example.com/x?id=7'],
    ['https://user:pw@evil.example.com/x then https://good.example.com/y', 'https://good.example.com/y'],
  ];
  for (const [input, want] of cases) assert.equal(RL.extractLink(input), want, JSON.stringify(input));
});
test('TC-QA-P04 extractLink refuses what the composers refuse: other schemes, credentials, protocol-relative, no link', () => {
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'file:///etc/passwd', 'https://user:pw@example.com/x', '//example.com/x',
    'just some words', 'example.com/no-scheme', '', '   ', 'https://', 'https:///x', 'https://localhost/x', 'ftp://example.com/x', 'https://exa mple.com'])
    assert.equal(RL.extractLink(bad), null, JSON.stringify(bad));
});
test('TC-QA-P05 extractLink and extractTitle never throw and stay bounded on hostile and oversized input', () => {
  for (const x of [undefined, null, 0, 1, true, {}, [], ['https://example.com'], () => 1, Symbol('s'), NaN]) {
    assert.equal(RL.extractLink(x), null); assert.equal(RL.extractTitle(x), '');
  }
  const big = 'a'.repeat(5000);
  assert.equal(RL.extractLink(big), null);
  assert.equal(RL.extractLink(big + ' https://example.com/late'), 'https://example.com/late');   // 5,000 characters of text before the link still works
  assert.equal(RL.extractLink('https://example.com/' + big), null);                                // a link over the 2,048 limit is refused, not truncated
  assert.equal(RL.extractLink('x'.repeat(1e6) + ' https://example.com/never'), null);              // far beyond what is scanned
  const t0 = Date.now();
  RL.extractLink('https://' + 'a.'.repeat(50000)); RL.extractLink('('.repeat(100000)); RL.extractTitle('\n'.repeat(100000) + 'x'); RL.extractLink('https://example.com/' + ')'.repeat(100000));
  assert.ok(Date.now() - t0 < 2000, 'took ' + (Date.now() - t0) + ' ms');
  assert.equal(RL.extractLink('\u0000https://example.com/x\u0007'), 'https://example.com/x');
});
test('TC-QA-P05 review F8: extractLink time grows linearly with trailing brackets', () => {
  const t = n => { const t0 = process.hrtime.bigint(); RL.extractLink('https://example.com/x' + ')'.repeat(n)); return Number(process.hrtime.bigint() - t0) / 1e6; };
  t(1000); const a = t(20000), b = t(5000);
  assert.ok(a < 100, '20,000 brackets took ' + a + ' ms'); assert.ok(b < 50, b + ' ms');
});
test('TC-QA-P05 extractTitle: the line that is not the link, cleaned, at most 140 characters', () => {
  const L = 'https://example.com/x';
  assert.equal(RL.extractTitle('A good title\n' + L), 'A good title');
  assert.equal(RL.extractTitle(L + '\nA good title'), 'A good title');
  assert.equal(RL.extractTitle('A good title ' + L), 'A good title');
  assert.equal(RL.extractTitle('A good title - ' + L), 'A good title');
  assert.equal(RL.extractTitle('“A good title”\n' + L), 'A good title');
  assert.equal(RL.extractTitle('  A   good\ttitle  \n\n' + L), 'A good title');
  assert.equal(RL.extractTitle(L), '');
  assert.equal(RL.extractTitle('A title with no link at all'), '');
  assert.equal(RL.extractTitle('\n\n' + L + '\n\n'), '');
  assert.equal(RL.extractTitle('x'.repeat(500) + '\n' + L).length, 140);
  assert.equal(RL.extractTitle('Bell\u0007 title\u0000\n' + L), 'Bell title');
  assert.equal(RL.extractTitle('<img src=x onerror=alert(1)>\n' + L), '<img src=x onerror=alert(1)>');   // text only; the page shows it with textContent and escapes it everywhere
});

/* QA-03 */
test('TC-QA-K01 suggestKind: Podcast for Spotify and Apple Podcasts only, by host and never by substring', () => {
  for (const u of ['https://open.spotify.com/episode/abc', 'https://spotify.com/x', 'https://podcasts.apple.com/us/podcast/x/id1', 'https://OPEN.SPOTIFY.COM/x']) assert.equal(RL.suggestKind(u), 'podcast', u);
  for (const u of ['https://www.youtube.com/watch?v=1', 'https://youtu.be/1', 'https://example.com/blog', 'https://spotify.com.evil.io/x', 'https://evilspotify.com/x', 'https://podcasts.apple.com.evil.io/x',
    'https://example.com/?u=https://open.spotify.com/x', 'https://music.apple.com/x', 'javascript:alert(1)', 'not a link', '', null, undefined, 5, {}])
    assert.equal(RL.suggestKind(u), 'read', String(u));
});

/* QA-08: when the address opens the sheet */
test('TC-QA-H02 isAddHash: exactly #add', () => {
  assert.equal(RL.isAddHash('#add'), true);
  for (const h of ['#add/anything', '#adds', '#add=https://example.com', '#add?x', '#ADD', '#add ', ' #add', '#', '', '#reads', '#blog', null, undefined, 5, {}]) assert.equal(RL.isAddHash(h), false, String(h));
});

/* QA-07: the draft. Only five text fields, never anything else */
test('TC-QA-D02 serializeDraft keeps link, title, take, tags and kind only; nothing else can ride along', () => {
  const s = RL.serializeDraft({ url: 'https://example.com/x', title: 'T', comment: 'C', tags: 'a, b', kind: 'podcast', token: 'github_pat_SECRET', pat: 'x', extra: 1, __proto__: { polluted: 1 } });
  const o = JSON.parse(s);
  assert.deepEqual(Object.keys(o).sort(), ['comment', 'kind', 'tags', 'title', 'url']);
  assert.ok(!/SECRET|polluted|extra/.test(s));
  assert.equal(RL.serializeDraft({}), ''); assert.equal(RL.serializeDraft({ url: '', title: '  ', comment: '', tags: '', kind: '' }), '');
  assert.equal(RL.serializeDraft(null), ''); assert.equal(RL.serializeDraft('x'), '');
});
test('TC-QA-D01 parseDraft round-trips what serializeDraft wrote and refuses everything else', () => {
  const d = { url: 'https://example.com/x', title: 'T', comment: 'C', tags: 'a, b', kind: 'read' };
  assert.deepEqual(RL.parseDraft(RL.serializeDraft(d)), d);
  assert.deepEqual(RL.parseDraft(RL.serializeDraft({ url: 'https://example.com/x' })), { url: 'https://example.com/x', title: '', comment: '', tags: '', kind: '' });
  for (const bad of [null, undefined, '', 'not json', '[]', '"x"', '5', 'null', '{}', '{"url":5}', '{"kind":"evil"}', 7, {}, [], '{"url":"' + 'a'.repeat(30000) + '"}']) assert.equal(RL.parseDraft(bad), null, String(bad).slice(0, 40));
});
test('TC-QA-D02 parseDraft ignores unknown and prototype keys, clamps oversize values, drops a bad kind', () => {
  const p = RL.parseDraft('{"url":"https://example.com/x","__proto__":{"polluted":1},"constructor":{"x":1},"token":"github_pat_SECRET","kind":"evil","title":"' + 'T'.repeat(5000) + '"}');
  assert.deepEqual(Object.keys(p).sort(), ['comment', 'kind', 'tags', 'title', 'url']);
  assert.equal(p.kind, ''); assert.ok(p.title.length <= 560); assert.equal({}.polluted, undefined); assert.ok(!JSON.stringify(p).includes('SECRET'));
});

/* QA-01, QA-04: the markup */
test('TC-QA-E05 the sheet is a labelled modal dialog with a closed set of controls', () => {
  const s = section(html, 'addBg'); assert.ok(s, 'no #addBg dialog in index.html');
  assert.match(s, /id="addSheet" role="dialog" aria-modal="true" aria-labelledby="addTitle"/);
  assert.match(s, /<h3 id="addTitle"[^>]*>Add to Studio<\/h3>/);
  for (const id of ['qa-url', 'qa-paste', 'qa-title', 'qa-comment', 'qa-tags', 'qa-show', 'qa-type', 'qa-publish', 'qa-draft', 'qa-cancel', 'qa-msg']) assert.ok(s.includes('id="' + id + '"'), id);
  assert.match(s, /id="qa-paste"[^>]*>Paste from clipboard</); assert.match(s, /id="qa-publish"[^>]*>Post and publish</); assert.match(s, /id="qa-draft"[^>]*>Post as draft</);
  assert.match(s, /value="read"[^>]*checked/); assert.ok(/value="podcast"/.test(s));
  assert.ok(!/<(iframe|script|img|object|embed)\b/i.test(s));
});
test('TC-QA-U05 the token prompt is a real login form: username (fixed, labelled), current-password, a submit, no autocomplete="off"', () => {
  const s = section(html, 'tokBg'); assert.ok(s, 'no #tokBg dialog in index.html');
  assert.match(s, /id="tokPrompt" role="dialog" aria-modal="true" aria-labelledby="tokTitle"/);
  assert.match(s, /<form id="tokForm"[^>]*>[\s\S]*<\/form>/);
  const user = s.match(/<input[^>]*id="tok-user"[^>]*>/); assert.ok(user, 'no username field');
  assert.match(user[0], /autocomplete="username"/); assert.match(user[0], /value="studio-admin"/); assert.match(user[0], /type="text"/); assert.match(user[0], /name="username"/);
  const pass = s.match(/<input[^>]*id="pat"[^>]*>/); assert.ok(pass, 'no password field');
  assert.match(pass[0], /type="password"/); assert.match(pass[0], /autocomplete="current-password"/); assert.match(pass[0], /name="password"/);
  assert.match(s, /<label for="tok-user">[^<]+<\/label>/); assert.match(s, /<label for="pat">[^<]+<\/label>/);
  assert.match(s, /<button type="submit"[^>]*id="tok-go"/);
  assert.ok(!/autocomplete\s*=\s*["']?off/i.test(s), 'autocomplete="off" in the token form');
  assert.equal((html.match(/value="studio-admin"/g) || []).length, 1, 'the sandbox patch needs exactly one such line');
  assert.ok(!/(placeholder|value)="[^"]*github_pat_[A-Za-z0-9]{10,}/.test(html));
});
test('TC-QA-E03 no visitor navigation links to the sheet; only the gear and the owner bar open it', () => {
  for (const nav of ['navlinks', 'navbottom']) { const m = html.match(new RegExp('<nav[^>]*id="' + nav + '"[\\s\\S]*?</nav>')); assert.ok(m, nav); assert.ok(!/#add|Add to Studio/i.test(m[0]), nav + ' links to the sheet'); }
  assert.ok(!/href="#add/.test(html), 'a link to #add in the page');
  assert.match(html, /<button id="gear"[^>]*aria-label="Add to Studio[^"]*"[^>]*aria-haspopup="dialog"/);
});
test('TC-QA-S03 the CSP is unchanged: same hosts, no new directive, no inline script or style, no cookie code', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(csp, "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com; base-uri 'none'; form-action 'none'");
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)); assert.ok(!/\sstyle="/.test(html)); assert.ok(!/\son[a-z]+="/i.test(html));
  assert.ok(!/document\.cookie/.test(app));
  const V = require('../scripts/validate-site.js');   // the budgets: one deliberate change (reads-lib 20 -> 26 KB, the Quick add helpers); the total and every other file are as before
  assert.deepEqual(V.BUDGETS, { 'index.html': 60 * 1024, 'css/site.css': 30 * 1024, 'js/app.js': 80 * 1024, 'js/reads-lib.js': 24 * 1024, 'js/podcast-lib.js': 10 * 1024, 'js/status-lib.js': 6 * 1024, 'js/quickadd-lib.js': 8 * 1024, 'js/safe-lib.js': 10 * 1024, 'js/token-store.js': 10 * 1024, 'js/image-lib.js': 10 * 1024, total: 160 * 1024 });
  const hosts = new Set((app.match(/https?:\/\/[a-z0-9.-]+/gi) || []).map(h => h.toLowerCase())); for (const h of hosts) assert.ok(/^https?:\/\/(api\.github\.com|github\.com|www\.linkedin\.com|open\.spotify\.com|example\.com)$/.test(h) || /^https?:\/\/(github\.com|www\.linkedin\.com)/.test(h), 'unexpected host ' + h);
});

/* QA-02, QA-07, QA-04: code shape that must hold (the behaviour is in the smoke cases) */
test('TC-QA-P07 the clipboard is read in exactly one place, the tap handler of the Paste button', () => {
  assert.equal((app.match(/clipboard\.readText/g) || []).length, 1);
  const at = app.indexOf('clipboard.readText'), before = app.slice(Math.max(0, at - 400), at);
  assert.ok(/qa-paste/.test(before) && /onclick|addEventListener\('click'/.test(before), 'readText is not inside the Paste click handler');
  assert.ok(!/clipboard\.read\(/.test(app));
});
test('TC-QA-D03 the page uses exactly two sessionStorage keys, the admin token and the owner draft; nothing new in localStorage', () => {
  assert.match(app, /const DRAFT_KEY = 'studio-quick-draft';/);
  assert.equal((app.match(/DRAFT_KEY\s*=/g) || []).length, 1);
  assert.equal((app.match(/window\.sessionStorage/g) || []).length, 2, 'expected the token store and the draft store only');
  assert.ok(!/[^.]sessionStorage\./.test(app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'direct sessionStorage access outside the two stores');
  assert.ok(/window\.TokenStore\.create\(\(\) => window\.sessionStorage, DRAFT_KEY\)/.test(app));
  const ls = (app.match(/ls(Get|Set|Del)\('([^']+)'/g) || []).map(s => s.replace(/^[a-zA-Z]+\('/, '').replace(/'$/, '')), allowed = ['studio-theme'];
  for (const k of ls) assert.ok(allowed.includes(k) || k === 'k', 'unexpected localStorage key ' + k);
  assert.ok(!/localStorage[^;\n]*DRAFT_KEY/.test(app));
});
test('TC-QA-U06 the token is never written to the DOM, the draft or any message: the code shape', () => {
  assert.ok(!/serializeDraft\([^)]*(tokenStore|pat\b)/.test(app));
  assert.ok(!/console\.(log|info|warn|debug)\([^)]*(tokenStore|\bpat\b)/.test(app));
  assert.ok(!/textContent\s*=[^;\n]*(tokenStore|\bpat\b)/.test(app));
  assert.ok(!/innerHTML\s*=[^;\n]*(tokenStore|\bpat\b)/.test(app));
});
test('TC-QA-L03 the app locks after a successful publish, in Quick add and in Publish changes', () => {
  assert.ok(/Published and locked/.test(app));
  const pub = app.slice(app.indexOf("$('#publishBtn').onclick")), end = pub.indexOf('window.addEventListener'), body = pub.slice(0, end);
  assert.ok(/lock\((true)?\)/.test(body), 'Publish changes does not lock');
  assert.ok(/qaPost|async function qaPost/.test(app));
  const qa = app.slice(app.indexOf('async function qaPost')); assert.ok(/lock\((true)?\)/.test(qa.slice(0, qa.indexOf('\n}\n'))), 'Quick add does not lock');
});
test('TC-QA-K05 Quick add reuses the existing validators (no rule is written twice)', () => {
  const qa = app.slice(app.indexOf('async function qaPost'), app.indexOf('async function qaPost') + 3000);
  assert.ok(/RL\.validateEntry\(/.test(qa) && /RL\.validatePodcastEntry\(/.test(qa));
  assert.ok(!/LIMITS\.(title|comment)/.test(qa) && !/normalizeUrl\(/.test(qa.replace(/qaDest/g, '')), 'Quick add repeats a validator rule');
  assert.ok(/publishContent\(/.test(qa), 'Quick add does not use the guarded publish');
});

/* QA-08: documentation */
test('TC-QA-H03 OPERATIONS and the LEARNING-GUIDE carry the iPhone recipe for Chrome', () => {
  for (const f of ['docs/OPERATIONS.md', 'docs/LEARNING-GUIDE.md']) {
    const d = read(f);
    for (const s of ['Default Browser', 'Add to Home Screen', 'googlechromes://', 'bookmark', '#add', 'studio-admin']) assert.ok(d.includes(s), f + ' lacks "' + s + '"');
    assert.ok(/Chrome/.test(d) && /Shortcut/.test(d), f + ' lacks the Chrome or Shortcut fallback');
  }
});
