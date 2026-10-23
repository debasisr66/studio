'use strict';
// SPEC-PC Phase A: PC-01 (data model) and PC-04 (validation); the section is not visible yet. Test IDs match docs/specs/podcast-links/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../scripts/validate-site.js');
const RL = require('../js/reads-lib.js');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const pod = (o = {}) => ({ id: 1, added: '2026-10-22', title: 'Ep 1', url: 'https://example.com/ep1', show: 'Show', comment: 'c', tags: ['ai'], ...o });
const file = (podcasts = [pod()], o = {}) => ({ schema_version: 1, podcasts, ...o });
const val = f => V.validatePodcasts(f);
const errs = f => val(f).errors;

/* PC-01: helpers shared with the later section */
test('TC-PC-D01 platformOf labels Spotify, Apple Podcasts and YouTube hosts (and their subdomains)', () => {
  const p = RL.platformOf;
  assert.equal(p('https://open.spotify.com/show/abc'), 'Spotify');
  assert.equal(p('https://podcasts.apple.com/us/podcast/x/id1'), 'Apple Podcasts');
  assert.equal(p('https://www.youtube.com/watch?v=abc'), 'YouTube');
  assert.equal(p('https://m.youtube.com/watch?v=abc'), 'YouTube');
  assert.equal(p('https://youtu.be/abc'), 'YouTube');
});
test('TC-PC-D02 an unknown host shows the plain domain; look-alikes and bad input never get a platform label', () => {
  assert.equal(RL.platformOf('https://www.lexfridman.com/podcast'), 'lexfridman.com');
  assert.equal(RL.platformOf('https://evilspotify.com/x'), 'evilspotify.com');
  assert.equal(RL.platformOf('https://spotify.com.evil.io/x'), 'spotify.com.evil.io');
  assert.equal(RL.platformOf('https://notyoutube.com/x'), 'notyoutube.com');
  for (const bad of ['', null, undefined, 'javascript:alert(1)', '<img src=x onerror=alert(1)>', 42]) assert.equal(RL.platformOf(bad), '', String(bad));
});
test('TC-PC-D03 podcastView fills defaults for missing optional fields and never returns undefined or a non-array', () => {
  assert.deepEqual(RL.podcastView({ title: 'T', url: 'https://example.com/a' }), { title: 'T', url: 'https://example.com/a', show: '', comment: '', tags: [], added: '', platform: 'example.com' });
  assert.deepEqual(RL.podcastView(null), { title: '', url: '', show: '', comment: '', tags: [], added: '', platform: '' });
  assert.deepEqual(RL.podcastView({ tags: 'ai', show: 5, comment: null }).tags, []);
  assert.equal(RL.podcastView(pod()).platform, 'example.com');
});
test('PC-01 the version constants: podcasts schema is 1; the browser refuses only a newer one', () => {
  assert.equal(RL.PODCASTS_SCHEMA_VERSION, 1);
  assert.equal(RL.isSupportedPodcastsVersion(1), true);
  assert.equal(RL.isSupportedPodcastsVersion(undefined), true);
  assert.equal(RL.isSupportedPodcastsVersion(2), false);
  assert.equal(RL.isSupportedPodcastsVersion('x'), true);
  assert.equal(RL.PODCAST_LIMITS.show, 80);
});

/* PC-04: validation */
test('TC-PC-V01 an unsafe or malformed URL is a CI error naming the entry', () => {
  for (const u of ['https://example.com/a b', ' https://example.com/a', 'javascript:alert(1)', 'https://user:pw@example.com/a', 'ftp://example.com/a', 'https:///x', undefined, 5]) {
    assert.ok(errs(file([pod({ url: u })])).some(m => /podcasts\[0\]: podcast url must be a clean/.test(m)), String(u));
  }
});
test('TC-PC-V02 a missing, blank or over-long title is a CI error', () => {
  for (const t of [undefined, '', '   ', 'x'.repeat(141), 7]) assert.ok(errs(file([pod({ title: t })])).some(m => /podcasts\[0\]: podcast title is required/.test(m)), String(t));
  assert.deepEqual(errs(file([pod({ title: 'x'.repeat(140) })])), []);
});
test('TC-PC-V03 a missing or unknown schema_version is a CI error naming the file', () => {
  for (const v of [2, 0, '1', null, 1.5, undefined]) {
    const f = file(); if (v === undefined) delete f.schema_version; else f.schema_version = v;
    assert.ok(errs(f).some(m => /podcasts\.json: schema_version must be 1/.test(m)), String(v));
  }
  assert.deepEqual(errs(file()), []);
});
test('TC-PC-V04 a duplicate URL only warns (query strings keep different videos apart)', () => {
  const r = val(file([pod({ id: 1 }), pod({ id: 2, url: 'https://www.example.com/ep1/' })]));
  assert.deepEqual(r.errors, []); assert.equal(r.warnings.length, 1); assert.match(r.warnings[0], /podcasts\[1\].*same link as an earlier podcast/);
  const yt = val(file([pod({ id: 1, url: 'https://www.youtube.com/watch?v=aaa' }), pod({ id: 2, url: 'https://www.youtube.com/watch?v=bbb' })]));
  assert.deepEqual(yt.warnings, []);
});
test('TC-PC-V05 too many or too long tags, a comment over 280, a show over 80, a duplicate id are CI errors', () => {
  assert.ok(errs(file([pod({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] })])).some(m => /podcast tags must be/.test(m)));
  assert.ok(errs(file([pod({ tags: ['x'.repeat(25)] })])).some(m => /podcast tags must be/.test(m)));
  assert.ok(errs(file([pod({ tags: 'ai' })])).some(m => /podcast tags must be/.test(m)));
  assert.ok(errs(file([pod({ comment: 'x'.repeat(281) })])).some(m => /podcast comment must be/.test(m)));
  assert.ok(errs(file([pod({ show: 's'.repeat(81) })])).some(m => /podcast show must be/.test(m)));
  assert.ok(errs(file([pod({ id: 1 }), pod({ id: 1, url: 'https://example.com/ep2' })])).some(m => /duplicate id 1/.test(m)));
  assert.ok(errs(file([pod({ added: 'yesterday' })])).some(m => /added must be YYYY-MM-DD/.test(m)));
  assert.deepEqual(errs(file([pod({ tags: ['x'.repeat(24)], comment: 'x'.repeat(280), show: 's'.repeat(80) })])), []);
});
test('TC-PC-V05 only the optional fields are optional; a non-object entry or a missing list fails without throwing', () => {
  assert.deepEqual(errs(file([{ title: 'T', url: 'https://example.com/a' }])), []);
  assert.ok(errs(file([null])).length > 0);
  assert.ok(errs({ schema_version: 1 }).some(m => /podcasts array/.test(m)));
  assert.ok(errs(null).length > 0);
  assert.ok(errs([]).length > 0);
});
test('TC-PC-V06 every new rule is enumerated with a fixture, a contract entry and a runbook row', () => {
  const ids = ['podcast-url-clean', 'podcast-title', 'podcast-schema-version', 'podcast-duplicate-url', 'podcast-tags', 'podcast-comment', 'podcast-show', 'podcast-duplicate-id'];
  for (const id of ids) {
    const rule = V.RULES.find(r => r.id === id);
    assert.ok(rule, id + ' is in RULES'); assert.equal(rule.fn, 'validatePodcasts');
    assert.equal(rule.level, id === 'podcast-duplicate-url' ? 'warning' : 'error');
    const r = V.runRule(rule, JSON.parse(read(`tests/fixtures/${id}.json`)));
    assert.ok((rule.level === 'warning' ? r.warnings : r.errors).some(m => rule.match.test(m)), id + ': fixture does not raise it');
    assert.ok(read('docs/RUNBOOK.md').includes(rule.doc), id + ': runbook phrase');
  }
  assert.deepEqual(V.checkContractDoc(read('docs/CONTRACT.md'), ['podcasts.json'], ids), []);
});
test('TC-PC-V07 the real content/podcasts.json exists and passes (it is shown by the page from Phase B on)', () => {
  const real = JSON.parse(read('content/podcasts.json'));
  assert.deepEqual(val(real).errors, []);
  assert.equal(real.schema_version, RL.PODCASTS_SCHEMA_VERSION);
  assert.ok(Array.isArray(real.podcasts));
});
test('TC-PC-V07 run() validates podcasts.json (a bad file would fail CI)', () => {
  assert.equal(V.run === undefined, false);
  const r = V.run();
  assert.ok(!r.errors.some(e => /podcast/.test(e)), JSON.stringify(r.errors));
});
