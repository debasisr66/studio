'use strict';
// SPEC-PC Phase B: PC-02 (section), PC-03 (admin), PC-05 (retire the blog): the pure and structural parts.
// Browser behaviour is in scripts/smoke.js (TC-PC-U/A/R). Test IDs match docs/specs/podcast-links/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RL = require('../js/reads-lib.js');
const V = require('../scripts/validate-site.js');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html'), app = read('js/app.js');
const base = { url: 'https://open.spotify.com/show/abc', title: 'A show' };

/* PC-03: what the composer accepts */
test('TC-PC-A02 validatePodcastEntry: link and title are required, with plain-language errors', () => {
  const r = RL.validatePodcastEntry({});
  assert.equal(r.ok, false); assert.ok(r.errors.url); assert.ok(r.errors.title);
  assert.equal(RL.validatePodcastEntry({ ...base, url: 'javascript:alert(1)' }).ok, false);
  assert.equal(RL.validatePodcastEntry({ ...base, url: 'https://user:pw@example.com/x' }).ok, false);
  assert.equal(RL.validatePodcastEntry({ ...base, title: '   ' }).ok, false);
  assert.equal(RL.validatePodcastEntry({ ...base, title: 'x'.repeat(141) }).ok, false);
});
test('TC-PC-A02 limits: show 80, comment 280, tags 5 of 24; optional fields may be empty', () => {
  assert.ok(RL.validatePodcastEntry({ ...base, show: 's'.repeat(81) }).errors.show);
  assert.ok(RL.validatePodcastEntry({ ...base, comment: 'c'.repeat(281) }).errors.comment);
  const ok = RL.validatePodcastEntry({ ...base, show: 's'.repeat(80), comment: 'c'.repeat(280), tags: 'a, b, c, d, e, f, g' });
  assert.equal(ok.ok, true); assert.equal(ok.value.tags.length, 5);
  const min = RL.validatePodcastEntry(base);
  assert.deepEqual(min.value, { url: 'https://open.spotify.com/show/abc', title: 'A show', show: '', comment: '', tags: [] });
});
test('TC-PC-N01 the stored link is normalised (tracking parameters and fragment dropped, host lowercased)', () => {
  const r = RL.validatePodcastEntry({ ...base, url: 'HTTPS://Open.Spotify.com/show/abc?utm_source=x&si=keep#frag' });
  assert.equal(r.value.url, 'https://open.spotify.com/show/abc?si=keep');
});
test('TC-PC-A05 serializePodcasts writes the version first, then the list, and always the current version', () => {
  const out = RL.serializePodcasts({ schema_version: 99, podcasts: [{ id: 1, title: 'T', url: 'https://example.com/a' }] });
  assert.deepEqual(Object.keys(out), ['schema_version', 'podcasts']); assert.equal(out.schema_version, RL.PODCASTS_SCHEMA_VERSION);
  assert.deepEqual(RL.serializePodcasts(null), { schema_version: 1, podcasts: [] });
  assert.deepEqual(RL.serializePodcasts({ podcasts: 'x' }), { schema_version: 1, podcasts: [] });
  assert.deepEqual(V.validatePodcasts(out).errors, [], 'what the admin writes always passes CI');
});
test('TC-PC-U05 filterPodcasts and podcastTags: tag, search over title, show, comment, platform, link', () => {
  const l = [{ id: 1, title: 'Alpha', show: 'Lex', url: 'https://open.spotify.com/show/a', tags: ['ai'], comment: 'about minds' }, { id: 2, title: 'Beta', url: 'https://www.youtube.com/watch?v=b', tags: ['ai', 'history'] }, { id: 3, title: 'Gamma', url: 'https://example.org/c' }];
  const ids = o => RL.filterPodcasts(l, o).map(e => e.id);
  assert.deepEqual(ids({}), [1, 2, 3]); assert.deepEqual(ids({ tag: 'ai' }), [1, 2]); assert.deepEqual(ids({ tag: 'history' }), [2]);
  assert.deepEqual(ids({ q: 'lex' }), [1]); assert.deepEqual(ids({ q: 'youtube' }), [2]); assert.deepEqual(ids({ q: 'spotify' }), [1]); assert.deepEqual(ids({ q: 'MINDS' }), [1]); assert.deepEqual(ids({ q: 'zzz' }), []);
  assert.deepEqual(RL.podcastTags(l), ['ai', 'history']);
  assert.deepEqual(RL.filterPodcasts(null, {}), []); assert.deepEqual(RL.podcastTags(undefined), []);
});

/* PC-05: the blog URL */
test('TC-PC-R01 redirectHash sends #blog and #blog/... to #podcasts and nothing else', () => {
  for (const h of ['#blog', '#blog/', '#blog/x', '#blog/some-post-1']) assert.equal(RL.redirectHash(h), '#podcasts', h);
  for (const h of ['#blogger', '#blogs', '#reads', '#podcasts', '', '#products', null, undefined, 42, '#BLOG']) assert.equal(RL.redirectHash(h), '', String(h));
});

/* structure: Blog is gone, Podcasts is in both navs */
test('TC-PC-U01 index.html has a Podcasts section and no Blog section, with Podcasts in the header and bottom nav', () => {
  assert.ok(/<section[^>]*id="podcasts"/.test(html)); assert.ok(!/id="blog"|id="blogFeed"|id="addPost"|href="#blog"/.test(html));
  const header = html.match(/<nav class="links"[\s\S]*?<\/nav>/)[0], bottom = html.match(/<nav class="bottom"[\s\S]*?<\/nav>/)[0];
  for (const n of [header, bottom]) { assert.ok(/href="#podcasts"/.test(n)); assert.ok(!/Blog/.test(n)); }
  assert.ok(/<h2 id="h-podcasts">Podcasts<\/h2>/.test(html));
});
test('TC-PC-U07 the section contains no iframe, audio, video, embed, object or image element', () => {
  const sec = html.match(/<section[^>]*id="podcasts"[\s\S]*?<\/section>/)[0];
  assert.ok(!/<(iframe|audio|video|embed|object|img|source)\b/i.test(sec));
  assert.ok(!/(iframe|<audio|<video|<embed)/i.test(app.match(/function podcastCard[\s\S]*?\n}\n/)[0]));
});
test('TC-PC-R04 no dead blog code remains: renderBlog, the post editor schema, #addPost, state.blog, the blog fetch and the blog publish entry', () => {
  for (const s of ['renderBlog', 'addPost', 'blogFeed', "kind === 'post'", 'state.blog', 'content/blog.json', "post: {title:'Blog post'", "tools('post'"]) assert.ok(!app.includes(s), 'app.js still contains ' + s);
});
test('TC-PC-R02 the page loads podcasts.json (not blog.json) and publishes only through the safe flow', () => {
  assert.ok(app.includes("loadJson('content/podcasts.json')"));
  assert.ok(app.includes("'content/podcasts.json'") && app.includes('RL.serializePodcasts(state.podcasts)'));
  assert.ok(app.includes('RL.isSupportedPodcastsVersion'), 'a newer podcasts.json is refused like a newer reads.json');
  assert.ok(app.includes('publishFile('), 'uses the existing GET sha, validate, skip identical, PUT flow');
});
test('TC-PC-R03 the health check still checks that blog.json is served, and now also podcasts.json', () => {
  const h = read('scripts/health-check.js');
  assert.ok(h.includes('/content/blog.json') && h.includes('/content/podcasts.json'));
});
test('TC-PC-R02 blog.json stays in the repo as an unrendered archive and keeps validating', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'content/blog.json')));
  assert.deepEqual(V.validateBlog(JSON.parse(read('content/blog.json'))), []);
});
test('TC-PC-A06 the Reads composer and the generic editor no longer know about posts', () => {
  assert.ok(!/\+ New post/.test(html));
  assert.ok(/SCHEMAS = \{[\s\S]*podcast:/.test(app), 'the generic delete handler knows the podcast list');
});

/* review PC-B findings 4 and 5 */
test('review PC-B #4 validatePodcastsFile (the browser, before every publish) gives the same answers as CI for every rule fixture', () => {
  assert.equal(typeof RL.validatePodcastsFile, 'function');
  for (const rule of V.RULES.filter(r => r.fn === 'validatePodcasts')) {
    const fx = JSON.parse(read(`tests/fixtures/${rule.id}.json`)).input;
    assert.deepEqual(RL.validatePodcastsFile(fx), V.validatePodcasts(fx), rule.id);
  }
  assert.deepEqual(RL.validatePodcastsFile(RL.serializePodcasts({ podcasts: [{ id: 1, title: 'T', url: 'https://example.com/a' }] })), { errors: [], warnings: [] });
  assert.ok(RL.validatePodcastsFile(null).errors.length);
});
test('review PC-B #5 tags named like object prototype members are counted and listed like any other tag', () => {
  const l = [{ title: 'a', url: 'https://e.com/a', tags: ['__proto__', 'constructor', 'toString', 'ai'] }, { title: 'b', url: 'https://e.com/b', tags: ['ai', 'constructor'] }];
  assert.deepEqual(RL.podcastTags(l), ['ai', 'constructor', '__proto__', 'toString']);
  assert.deepEqual(RL.allTags(l), ['ai', 'constructor', '__proto__', 'toString']);
});
