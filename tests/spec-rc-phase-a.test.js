'use strict';
// SPEC-RC Phase A: RC-01 (data model), RC-05 (migration), RC-06 (validation). Test IDs match docs/specs/reads-categories/test.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../scripts/validate-site.js');
const RL = require('../js/reads-lib.js');

const ROOT = path.resolve(__dirname, '..');
const json = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const article = (o = {}) => ({ id: 1, added: '2026-10-19', title: 'T', url: 'https://example.com/a', kind: 'article', tags: [], category: 'technical', ...o });
const reads = (o = {}) => ({ schema_version: 2, books: [], articles: [article()], ...o });
const errs = r => V.validateReads(r).errors;

/* RC-01: the closed list and the browser default */
test('TC-RC-D01 categoryOf: missing, unknown, wrong type and null all become "other"', () => {
  for (const v of [{}, null, undefined, { category: 'memes' }, { category: '' }, { category: 7 }, { category: 'Technical' }, { category: '__proto__' }, { category: ['technical'] }])
    assert.equal(RL.categoryOf(v), 'other', JSON.stringify(v));
});
test('TC-RC-D02 categoryOf keeps a known value', () => {
  assert.equal(RL.categoryOf({ category: 'technical' }), 'technical');
  assert.equal(RL.categoryOf({ category: 'other' }), 'other');
  assert.deepEqual(RL.CATEGORIES, ['technical', 'other']);
  assert.equal(RL.entryView({ category: 'technical' }).category, 'technical');
  assert.equal(RL.entryView({}).category, 'other');
});
test('TC-RC-D03 filterReads respects category, tag and search together', () => {
  const list = [
    article({ id: 1, title: 'Alpha', tags: ['ai'], category: 'technical' }),
    article({ id: 2, title: 'Alpha two', tags: ['ai'], category: 'other' }),
    article({ id: 3, title: 'Beta', tags: ['ai', 'x'], category: 'technical' }),
    { id: 4, title: 'Legacy alpha', url: 'https://example.com/l', tags: ['ai'] },   // no category: counts as "other"
  ];
  const ids = o => RL.filterReads(list, o).map(e => e.id);
  assert.deepEqual(ids({}), [1, 2, 3, 4], 'no category given: unchanged behaviour');
  assert.deepEqual(ids({ category: 'technical' }), [1, 3]);
  assert.deepEqual(ids({ category: 'other' }), [2, 4]);
  assert.deepEqual(ids({ category: 'technical', tag: 'x' }), [3]);
  assert.deepEqual(ids({ category: 'technical', q: 'alpha' }), [1]);
  assert.deepEqual(ids({ category: 'other', q: 'alpha', tag: 'ai' }), [2, 4]);
  assert.deepEqual(ids({ category: 'other', tag: 'x' }), []);
});
test('TC-RC-D04 category counts ignore tag and search filters and cover every list entry', () => {
  const list = [article({ id: 1 }), article({ id: 2 }), article({ id: 3, category: 'other' }), { id: 4, title: 'no cat', url: 'https://e.com/z' }];
  assert.deepEqual(RL.categoryCounts(list), { technical: 2, other: 2 });
  assert.deepEqual(RL.categoryCounts([]), { technical: 0, other: 0 });
  assert.deepEqual(RL.categoryCounts(null), { technical: 0, other: 0 });
});
test('TC-RC-X01 (library half) a value added to CATEGORIES is understood with no other code change', () => {
  RL.CATEGORIES.push('news');
  try {
    assert.equal(RL.categoryOf({ category: 'news' }), 'news');
    assert.deepEqual(RL.categoryCounts([article({ category: 'news' }), article({ category: 'technical' })]), { technical: 1, other: 0, news: 1 });
    assert.deepEqual(errs(reads({ articles: [article({ category: 'news' })] })), []);
    assert.deepEqual(RL.filterReads([article({ id: 1, category: 'news' })], { category: 'news' }).map(e => e.id), [1]);
  } finally { RL.CATEGORIES.pop(); }
  assert.equal(RL.categoryOf({ category: 'news' }), 'other');
});

/* the composer: new reads carry a category (Technical until the Section choice ships in RC Phase B) */
test('TC-RC-E00 validateEntry accepts a known category, rejects an unknown one, and leaves it out when not given', () => {
  assert.equal(RL.DEFAULT_NEW_CATEGORY, 'technical');
  const base = { url: 'https://example.com/a', title: 'T' };
  const none = RL.validateEntry(base);
  assert.ok(none.ok); assert.equal('category' in none.value, false, 'an edit must not overwrite an existing category');
  assert.equal(RL.validateEntry({ ...base, category: 'other' }).value.category, 'other');
  const bad = RL.validateEntry({ ...base, category: 'memes' });
  assert.equal(bad.ok, false); assert.ok(bad.errors.category);
});
test('TC-RC-E00 serializeReads writes the current version and fills a missing or unknown category for admin saves', () => {
  const out = RL.serializeReads({ books: [{ title: 'B' }, { title: 'C', category: 'other' }], articles: [article({ category: 'memes' }), article({ id: 2, category: 'other' }), { id: 3, title: 'x', url: 'https://e.com/q' }] });
  assert.equal(out.schema_version, 2);
  assert.deepEqual(out.books.map(b => b.category), ['technical', 'other']);
  assert.deepEqual(out.articles.map(a => a.category), ['technical', 'other', 'technical']);
});

/* RC-06: validation */
test('TC-RC-V01 an article or book with no category is a CI error naming the entry', () => {
  const a = article(); delete a.category;
  assert.ok(errs(reads({ articles: [a] })).some(m => /articles\[0\].*category must be one of technical, other/.test(m)));
  assert.ok(errs(reads({ books: [{ title: 'B' }] })).some(m => /books\[0\].*category must be one of technical, other/.test(m)));
});
test('TC-RC-V02 an unknown or non-string category is a CI error', () => {
  for (const c of ['memes', '', 'Technical', 7, null, ['technical']]) {
    assert.ok(errs(reads({ articles: [article({ category: c })] })).some(m => /category must be one of/.test(m)), 'article ' + JSON.stringify(c));
    assert.ok(errs(reads({ books: [{ title: 'B', category: c }] })).some(m => /category must be one of/.test(m)), 'book ' + JSON.stringify(c));
  }
});
test('TC-RC-V02 known categories are accepted for articles and books', () => {
  assert.deepEqual(errs(reads({ books: [{ title: 'B', category: 'other' }], articles: [article(), article({ id: 2, url: 'https://example.com/b', category: 'other' })] })), []);
});
test('TC-RC-V03 version 2 passes; version 1 and a missing version are CI errors', () => {
  assert.equal(RL.READS_SCHEMA_VERSION, 2);
  assert.deepEqual(errs(reads()), []);
  for (const v of [1, 3, 0, '2', null, undefined]) {
    const r = reads({ schema_version: v }); if (v === undefined) delete r.schema_version;
    assert.ok(errs(r).some(m => /schema_version must be 2/.test(m)), String(v));
  }
});
test('TC-RC-V03 the browser accepts versions 1 and 2 and refuses only a newer one', () => {
  assert.equal(RL.isSupportedReadsVersion(1), true);
  assert.equal(RL.isSupportedReadsVersion(2), true);
  assert.equal(RL.isSupportedReadsVersion(3), false);
  assert.equal(RL.isSupportedReadsVersion(undefined), true);
});
test('TC-RC-V04 the rule reads-category is enumerated, has a fixture, a contract entry and a runbook row', () => {
  const rule = V.RULES.find(r => r.id === 'reads-category');
  assert.ok(rule, 'reads-category is in RULES');
  assert.equal(rule.fn, 'validateReads'); assert.equal(rule.level, 'error');
  const fx = json('tests/fixtures/reads-category.json');
  assert.ok(V.runRule(rule, fx).errors.some(m => rule.match.test(m)));
  assert.deepEqual(V.checkContractDoc(fs.readFileSync(path.join(ROOT, 'docs/CONTRACT.md'), 'utf8'), [], ['reads-category']), []);
  assert.ok(fs.readFileSync(path.join(ROOT, 'docs/RUNBOOK.md'), 'utf8').includes(rule.doc));
});

/* RC-05: the migration, proven against a snapshot of the file as it was before (tests/fixtures/reads-before-rc-a.json, schema_version 1) */
const before = () => json('tests/fixtures/reads-before-rc-a.json');
const after = () => json('content/reads.json');
const strip = o => { const c = { ...o }; delete c.category; return c; };
test('TC-RC-M01 nothing is lost: every field of every read and book is identical apart from the added category', () => {
  const b = before(), a = after();
  assert.equal(b.schema_version, 1); assert.equal(a.schema_version, 2);
  assert.equal(a.articles.length, 5); assert.equal(b.articles.length, 5);
  assert.equal(a.books.length, 1); assert.equal(b.books.length, 1);
  assert.deepEqual(a.articles.map(strip), b.articles);       // ids, urls, titles, comments, tags, kinds, added, order
  assert.deepEqual(a.books.map(strip), b.books);
  assert.deepEqual(a.articles.map(x => x.id), b.articles.map(x => x.id));
  assert.deepEqual(Object.keys(a), ['schema_version', 'books', 'articles'].filter(k => k in a), 'top-level keys unchanged');
});
test('TC-RC-M02 all 5 reads and the book carry the owner-confirmed category: technical', () => {
  const a = after();
  assert.deepEqual(a.articles.map(x => x.category), Array(5).fill('technical'));
  assert.deepEqual(a.books.map(x => x.category), ['technical']);
});
test('TC-RC-M03 the migration is additive: v1.5 code reads only the old keys, so the migrated file still renders there', () => {
  const b = before(), a = after();
  const added = new Set();
  [...a.articles.map((x, i) => [x, b.articles[i]]), ...a.books.map((x, i) => [x, b.books[i]])].forEach(([n, o]) => Object.keys(n).forEach(k => { if (!(k in o)) added.add(k); }));
  assert.deepEqual([...added], ['category']);
  assert.equal(V.validateReads(a).errors.length, 0);
});
test('TC-RC-M03 the real content/reads.json passes the validator and carries the current version', () => {
  assert.deepEqual(V.validateReads(after()).errors, []);
  assert.equal(after().schema_version, RL.READS_SCHEMA_VERSION);
});
